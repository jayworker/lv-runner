// kmooc-test-play.mjs — viewer.php 직접 열어 재생 진행/진도보고 메커니즘 확인 (약 25초만).
import { chromium } from 'playwright';

const VID = process.argv[2] || '2156152';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];

// 기존 팝업 정리
for (const p of ctx.pages()) {
  if (/viewer\.php/.test(p.url())) { await p.close().catch(() => {}); }
}
let page = ctx.pages().find((p) => /kmooc\.kr/.test(p.url())) || ctx.pages()[0];

// 진도보고 AJAX 관찰
const posts = [];
page.on('request', (req) => {
  const u = req.url();
  if (/vod|progress|log|complete|view|track|heartbeat|ajax/i.test(u) && req.method() === 'POST') {
    posts.push({ url: u.slice(0, 110), data: (req.postData() || '').slice(0, 200) });
  }
});

await page.goto(`https://lms.kmooc.kr/mod/vod/viewer.php?id=${VID}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(3500);

// 재생 시작
const start = await page.evaluate(() => {
  const v = document.querySelector('video');
  if (!v) return 'no video';
  v.muted = true; v.playbackRate = 1;
  const p = v.play();
  if (p && p.catch) p.catch(() => {});
  return { dur: v.duration, ct: v.currentTime };
});
console.log('START:', JSON.stringify(start));

// 20초간 4번 샘플링
for (let i = 0; i < 4; i++) {
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? { ct: +v.currentTime.toFixed(1), paused: v.paused, rate: v.playbackRate, buffered: v.buffered.length ? +v.buffered.end(v.buffered.length-1).toFixed(0) : 0 } : null;
  });
  console.log(`  t+${(i+1)*5}s:`, JSON.stringify(s));
}

// 일시정지(테스트 종료, 진도 너무 안 쌓이게)
await page.evaluate(() => { const v = document.querySelector('video'); v && v.pause(); });
console.log('\nPROGRESS POSTs observed:', posts.length);
for (const p of posts.slice(0, 10)) console.log('  POST', p.url, '|', p.data);

// 전역 진도/플레이어 객체 단서
const globals = await page.evaluate(() => {
  const keys = Object.keys(window).filter((k) => /vod|player|progress|log|complete|track|mod|view/i.test(k)).slice(0, 25);
  return keys;
});
console.log('\nwindow globals:', JSON.stringify(globals));
await browser.close();
process.exit(0);
