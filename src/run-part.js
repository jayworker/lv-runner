// run-part.js — 특정 파트를 열고(모드 open) 또는 끝까지 1배속 재생 후 출석종료(mode full)
// 사용: node src/run-part.js <week> <item_id> <open|full> [speed]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', '.state');
fs.mkdirSync(STATE_DIR, { recursive: true });

const week = process.argv[2];
const itemId = process.argv[3];
const mode = process.argv[4] || 'open';
const speed = Number(process.argv[5] || 1);
const LIST = `https://ecampus.konkuk.ac.kr/ilos/st/course/online_list_form.acl?WEEK_NO=${week}`;

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr'));
if (!page) { console.log('no ecampus page'); await browser.close(); process.exit(1); }
await page.bringToFront().catch(() => {});

async function snap(name) {
  await page.screenshot({ path: path.join(STATE_DIR, name) }).catch(() => {});
}

// 인증 모달이 보이는지(오버레이 visible) 검사
async function authVisible() {
  return await page.evaluate(() => {
    const cands = [...document.querySelectorAll('*')].filter((el) => /2차 본인인증|인증번호.*입력/.test((el.textContent || '')) && el.offsetParent !== null);
    // offsetParent !== null 이면 화면에 표시됨
    return cands.length > 0;
  }).catch(() => false);
}

// 목록으로 가서 해당 파트 클릭
console.log('goto', LIST);
await page.goto(LIST, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const clicked = await page.evaluate((id) => {
  const el = [...document.querySelectorAll('[onclick*="viewGo"]')].find((e) => (e.getAttribute('onclick') || '').includes(id) && (e.innerText || '').trim());
  if (el) { el.click(); return el.getAttribute('onclick'); }
  return null;
}, itemId);
console.log('clicked onclick =', clicked);
await page.waitForTimeout(4000);

const auth = await authVisible();
console.log('auth modal visible?', auth);
console.log('page url now:', page.url());
const frameUrls = page.frames().map((f) => f.url());
console.log('frames:', JSON.stringify(frameUrls, null, 2));
await snap('part-open.png');

if (mode === 'open') {
  console.log('[open mode] stopping here.');
  await browser.close();
  process.exit(auth ? 2 : 0); // exit 2 = 인증 필요
}

// ---- full mode: 재생 ----
function videoFrame() {
  return page.frames().find((f) => f.url().includes('online_view.acl')) || page.frames().find((f) => f.url().includes('.mp4'));
}
async function readState() {
  const f = videoFrame();
  if (!f) return { error: 'no video frame' };
  return await f.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return { error: 'no video' };
    return { currentTime: Math.round(v.currentTime), duration: Math.round(v.duration), paused: v.paused, ended: v.ended, rate: v.playbackRate };
  }).catch((e) => ({ error: String(e).slice(0, 80) }));
}

const vf = videoFrame();
if (!vf) { console.log('ERROR: no video frame after open'); await browser.close(); process.exit(1); }
await vf.evaluate((spd) => { const v = document.querySelector('video'); if (v) { v.muted = true; v.playbackRate = spd; const p = v.play(); if (p && p.catch) p.catch(() => {}); } }, speed);
console.log(`[full] playing at ${speed}x ...`);

for (;;) {
  await page.waitForTimeout(15000);
  const s = await readState();
  if (s.error) { console.log('state err:', s.error); break; }
  const pct = s.duration ? ((s.currentTime / s.duration) * 100).toFixed(1) : '?';
  console.log(`  ${s.currentTime}/${s.duration} (${pct}%) paused=${s.paused} ended=${s.ended} rate=${s.rate}`);
  fs.writeFileSync(path.join(STATE_DIR, 'run-status.json'), JSON.stringify({ week, itemId, ...s, pct, time: new Date().toISOString() }, null, 2));
  if (s.rate !== speed) await vf.evaluate((spd) => { const v = document.querySelector('video'); if (v) v.playbackRate = spd; }, speed);
  if (s.paused && !s.ended) await vf.evaluate(() => { const v = document.querySelector('video'); if (v) v.play().catch(() => {}); });
  if (s.ended || (s.duration && s.currentTime >= s.duration - 1)) { console.log('[full] video finished'); break; }
}

// 출석(종료) 클릭 — 외부 프레임에서 텍스트로 탐색
await snap('before-attend.png');
const attendResult = await (async () => {
  for (const f of page.frames()) {
    const r = await f.evaluate(() => {
      const el = [...document.querySelectorAll('a,button,span,div,input')].find((e) => /출석\(종료\)|출석종료/.test((e.innerText || e.value || '').trim()));
      if (el) { el.click(); return (el.innerText || el.value || '').trim(); }
      return null;
    }).catch(() => null);
    if (r) return r;
  }
  return null;
})();
console.log('출석종료 클릭 결과:', attendResult);
await page.waitForTimeout(3000);
await snap('after-attend.png');
console.log('final url:', page.url());

await browser.close();
process.exit(0);
