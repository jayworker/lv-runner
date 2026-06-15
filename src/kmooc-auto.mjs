// kmooc-auto.mjs — K-MOOC(lms.kmooc.kr, Moodle) 강좌의 미완료 VOD를 자동재생/진도처리.
//
// 동작: course/view.php?id=COURSE 에서 vod 모듈 목록과 완료상태(completion-auto-y/n)를 읽고,
//       미완료 항목을 순서대로 viewer.php?id=N 으로 열어 muted+지정배속으로 끝까지 재생한다.
//       video.js 플레이어가 재생 중 mod/vod/action.php(trackDetail)로 시청구간을 자동 보고 → 진도 인정.
//
// 사용: node src/kmooc-auto.mjs <courseId> [speed]
//   예) node src/kmooc-auto.mjs 18736 2
//
// 전제: npm run launch 로 띄운 Edge(포트 9222)에 이미 lms.kmooc.kr 로그인돼 있어야 함.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(__dirname, '..', '.state');
fs.mkdirSync(STATE, { recursive: true });

const COURSE = process.argv[2] || '18736';
const SPEED = Number(process.argv[3] || 2);
const PORT = 9222;
const COURSE_URL = `https://lms.kmooc.kr/course/view.php?id=${COURSE}`;
const VIEWER = (id) => `https://lms.kmooc.kr/mod/vod/viewer.php?id=${id}`;
const progressFile = path.join(STATE, `kmooc-progress-${COURSE}.json`);
const currentFile = path.join(STATE, `kmooc-current-${COURSE}.json`);

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const loadJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const saveJSON = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2));

const browser = await chromium.connectOverCDP(`http://localhost:${PORT}`);
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /lms\.kmooc\.kr/.test(p.url()))
  || ctx.pages().find((p) => /kmooc\.kr/.test(p.url()))
  || ctx.pages()[0];
await page.bringToFront().catch(() => {});

// viewer.php는 '이어서 보시겠습니까?' 등 네이티브 confirm/alert를 띄움 → 자동 수락(이어보기).
// 핸들러를 직접 달아야 Playwright 기본 자동-dismiss와의 경쟁으로 인한 크래시를 막는다.
const attachDialogHandler = (pg) => {
  pg.on('dialog', async (d) => { try { await d.accept(); } catch {} });
};
attachDialogHandler(page);
// 작업 중 새 페이지가 생겨도 동일 처리
ctx.on('page', attachDialogHandler);
// 프로세스 전체 안전망: 예기치 못한 거부도 흡수
process.on('unhandledRejection', (e) => { console.log('  (unhandledRejection 무시)', String(e).slice(0, 80)); });

// --- 강좌 VOD 목록 + 완료상태 읽기 ---
async function readModules() {
  await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2500);
  return page.evaluate(() => {
    const out = [];
    document.querySelectorAll('li.activity.modtype_vod, li[class*="modtype_vod"]').forEach((li) => {
      const a = li.querySelector('a[href*="vod/view.php"]');
      if (!a) return;
      const id = (a.href.match(/id=(\d+)/) || [])[1];
      const title = a.innerText.replace(/\s+/g, ' ').replace(/동영상.*$/, '').trim();
      const img = li.querySelector('.autocompletion img, [class*="completion"] img');
      const done = img ? /completion-auto-y|-y$/.test(img.getAttribute('src') || '') : false;
      out.push({ id, title, done });
    });
    return out;
  });
}

// --- 단일 VOD 재생 (끝까지) ---
async function playOne(mod) {
  log(`▶ 재생 시작: ${mod.title} (id=${mod.id})`);
  saveJSON(currentFile, { id: mod.id, title: mod.title, startedAt: new Date().toISOString() });
  // video 로드 (실패 시 새로고침 재시도). HLS 초기화가 느릴 수 있어 넉넉히 대기.
  let ok = false;
  for (let attempt = 0; attempt < 3 && !ok; attempt++) {
    if (attempt > 0) log(`  ↻ video 미로드 → 새로고침 재시도 ${attempt}`);
    await page.goto(VIEWER(mod.id), { waitUntil: 'domcontentloaded' }).catch(() => {});
    for (let i = 0; i < 40; i++) {
      ok = await page.evaluate(() => !!document.querySelector('video') && document.querySelector('video').readyState > 0).catch(() => false);
      if (ok) break;
      await sleep(1000);
    }
  }
  if (!ok) { log('  ⚠ video 로드 실패 → 스킵'); return false; }

  // 재생 개시
  const meta = await page.evaluate((rate) => {
    const v = document.querySelector('video');
    v.muted = true; v.playbackRate = rate;
    try { v.currentTime = 0; } catch {} // 이어보기 위치 무시, 처음부터 → 전체구간 커버
    const p = v.play(); if (p && p.catch) p.catch(() => {});
    return { dur: v.duration };
  }, SPEED);
  log(`  duration=${Math.round(meta.dur)}s, ${SPEED}배속 → 예상 ${Math.round(meta.dur / SPEED / 60)}분`);

  let lastCt = -1, stallPolls = 0;
  const POLL = 5000;            // 5초 간격
  const STALL_GIVEUP = 36;      // 약 3분(36*5s) 무진행이면 포기
  while (true) {
    await sleep(POLL);
    const s = await page.evaluate((rate) => {
      const v = document.querySelector('video');
      if (!v) return null;
      if (Math.abs(v.playbackRate - rate) > 0.01) v.playbackRate = rate; // 배속 유지
      if (v.paused && !v.ended) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      return { ct: v.currentTime, dur: v.duration, ended: v.ended, paused: v.paused };
    }, SPEED).catch(() => null);
    if (!s) { log('  ⚠ video 사라짐 → 종료'); break; }

    const pct = s.dur ? Math.floor((s.ct / s.dur) * 100) : 0;
    saveJSON(currentFile, { id: mod.id, title: mod.title, ct: Math.round(s.ct), dur: Math.round(s.dur), pct });

    if (s.ended || (s.dur && s.ct >= s.dur - 2)) { log(`  ✓ 재생 완료 (${pct}%)`); break; }

    if (Math.abs(s.ct - lastCt) < 0.5) {
      stallPolls++;
      if (stallPolls % 3 === 0) {
        // 버퍼 막힘 → 살짝 seek해서 뚫기
        await page.evaluate(() => { const v = document.querySelector('video'); if (v) { v.currentTime = Math.min(v.duration - 1, v.currentTime + 5); v.play().catch(() => {}); } }).catch(() => {});
        log(`  … stall ${stallPolls}회, +5s seek로 버퍼 뚫기 (${pct}%)`);
      }
      if (stallPolls >= STALL_GIVEUP) { log(`  ⚠ 장시간 정지 → 다음 항목으로 (${pct}%)`); break; }
    } else {
      stallPolls = 0;
      if (Math.floor(s.ct) % 60 < (SPEED * POLL) / 1000 + 1) log(`  진행 ${pct}% (${Math.round(s.ct)}/${Math.round(s.dur)}s)`);
    }
    lastCt = s.ct;
  }
  // 최종 보고 POST 여유 (랜덤)
  await sleep(3000 + Math.floor(Math.random() * 5000));
  return true;
}

// 사람처럼 보이게 영상 사이 랜덤 대기 (기본 25~140초, 가끔 길게)
function humanGap() {
  let base = 25000 + Math.floor(Math.random() * 115000); // 25~140s
  if (Math.random() < 0.15) base += 60000 + Math.floor(Math.random() * 120000); // 15% 확률로 +1~3분
  return base;
}

// --- 메인 루프 ---
let mods = await readModules();
const totalVod = mods.length;
log(`강좌 ${COURSE}: VOD ${totalVod}개 (완료 ${mods.filter((m) => m.done).length} / 미완료 ${mods.filter((m) => !m.done).length})`);
const progress = loadJSON(progressFile, { course: COURSE, played: [] });

for (let i = 0; i < mods.length; i++) {
  const m = mods[i];
  if (m.done) { log(`⏭  이미 완료: ${m.title}`); continue; }
  await playOne(m);
  progress.played.push({ id: m.id, title: m.title, at: new Date().toISOString() });
  saveJSON(progressFile, progress);
  // 완료 반영 확인 위해 목록 갱신
  mods = await readModules();
  const now = mods.find((x) => x.id === m.id);
  log(`   완료상태 확인: ${now && now.done ? '✅ 완료처리됨' : '⏳ 아직 미반영(서버 지연 가능)'}`);
  // 다음 미완료 영상이 남았으면 사람처럼 랜덤 대기 후 진행
  const moreLeft = mods.slice(i + 1).some((x) => !x.done);
  if (moreLeft) {
    const gap = humanGap();
    log(`   ⏲ 다음 영상까지 ${Math.round(gap / 1000)}초 랜덤 대기`);
    await sleep(gap);
  }
}

// 최종 요약
mods = await readModules();
const done = mods.filter((m) => m.done).length;
log(`\n=== 완료 요약: ${done}/${mods.length} VOD 완료 ===`);
for (const m of mods) log(`  ${m.done ? '✅' : '❌'} ${m.title}`);
await page.screenshot({ path: path.join(STATE, `kmooc-final-${COURSE}.png`), fullPage: true }).catch(() => {});
saveJSON(currentFile, { done: true, finishedAt: new Date().toISOString(), completed: done, total: mods.length });
await browser.close();
process.exit(0);
