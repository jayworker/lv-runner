// player.js — 떠 있는 Edge(CDP)에 연결해 강의 비디오를 제어한다.
// 사용: node src/player.js status        (읽기 전용: 현재 영상 상태 출력)
//       node src/player.js play [speed]   (현재 영상을 speed 배속으로 끝까지 재생, 기본 2)
//
// 부작용(출석 등)이 있는 동작은 별도 단계에서만 수행한다.

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', '.state');
fs.mkdirSync(STATE_DIR, { recursive: true });

const cmd = process.argv[2] || 'status';
const speed = Number(process.argv[3] || 2);

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];

// eCampus 강의 페이지 찾기 (Gmail 등 제외)
const page = ctx.pages().find((p) => p.url().includes('online_view_form.acl'))
  || ctx.pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr'));
if (!page) {
  console.log('ERROR: eCampus 강의 페이지를 찾지 못했습니다. 열린 페이지:');
  ctx.pages().forEach((p) => console.log('  -', p.url()));
  await browser.close();
  process.exit(1);
}

// 비디오가 들어있는 프레임 찾기
function videoFrame() {
  return page.frames().find((f) => f.url().includes('online_view.acl'))
    || page.frames().find((f) => f.url().includes('.mp4'));
}

async function readState() {
  const f = videoFrame();
  if (!f) return { error: 'video frame not found', frames: page.frames().map((x) => x.url()) };
  return await f.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return { error: 'no <video> element' };
    return {
      currentTime: Math.round(v.currentTime),
      duration: Math.round(v.duration),
      paused: v.paused,
      ended: v.ended,
      muted: v.muted,
      playbackRate: v.playbackRate,
      readyState: v.readyState, // 4 = 충분히 로드됨
    };
  });
}

if (cmd === 'status') {
  const s = await readState();
  console.log('VIDEO STATE:', JSON.stringify(s, null, 2));
  await browser.close();
  process.exit(0);
}

if (cmd === 'play') {
  const f = videoFrame();
  if (!f) { console.log('ERROR: video frame not found'); await browser.close(); process.exit(1); }

  // 재생 시작 + 배속 + 음소거(자동재생 정책 회피)
  await f.evaluate((spd) => {
    const v = document.querySelector('video');
    if (!v) return;
    v.muted = true;
    v.playbackRate = spd;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }, speed);

  console.log(`[play] started at ${speed}x. polling...`);
  let last = -1;
  for (;;) {
    await page.waitForTimeout(10000);
    const s = await readState();
    if (s.error) { console.log('state error:', s.error); break; }
    // 배속이 풀리면 다시 적용
    if (s.playbackRate !== speed) {
      await f.evaluate((spd) => { const v = document.querySelector('video'); if (v) v.playbackRate = spd; }, speed);
    }
    const pct = s.duration ? ((s.currentTime / s.duration) * 100).toFixed(1) : '?';
    console.log(`  ${s.currentTime}s / ${s.duration}s (${pct}%) rate=${s.playbackRate} paused=${s.paused} ended=${s.ended}`);
    fs.writeFileSync(path.join(STATE_DIR, 'play-status.json'), JSON.stringify({ ...s, pct, time: new Date().toISOString() }, null, 2));

    if (s.ended || (s.duration && s.currentTime >= s.duration - 1)) {
      console.log('[play] 영상 끝까지 재생 완료.');
      break;
    }
    // 멈춰있으면(버퍼링 외) 다시 재생 시도
    if (s.paused && !s.ended) {
      await f.evaluate(() => { const v = document.querySelector('video'); if (v) v.play().catch(() => {}); });
    }
    if (s.currentTime === last) { /* 정지 감지용, 일단 계속 */ }
    last = s.currentTime;
  }
  await browser.close();
  process.exit(0);
}

console.log('unknown command:', cmd);
await browser.close();
process.exit(1);
