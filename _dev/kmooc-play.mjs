// kmooc-play.mjs — '동영상 보기' 클릭 → 팝업/플레이어 창 구조 파악.
import { chromium } from 'playwright';

const VID = process.argv[2] || '2156152';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /kmooc\.kr/.test(p.url())) || ctx.pages()[0];
await page.bringToFront().catch(() => {});
await page.goto(`https://lms.kmooc.kr/mod/vod/view.php?id=${VID}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2500);

const before = ctx.pages().length;
// '동영상 보기' 버튼/링크 찾기
const btn = await page.evaluate(() => {
  const el = [...document.querySelectorAll('a,button,input[type=button]')]
    .find((e) => /동영상\s*보기|학습하기|재생/.test(e.innerText || e.value || ''));
  if (!el) return null;
  return { tag: el.tagName, onclick: el.getAttribute('onclick') || '', href: el.getAttribute('href') || '', text: (el.innerText || el.value || '').trim() };
});
console.log('BUTTON:', JSON.stringify(btn));

// 새 창 대기하며 클릭
const popupP = ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null);
await page.click('a:has-text("동영상 보기"), button:has-text("동영상 보기")').catch(async () => {
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('a,button,input[type=button]')].find((e) => /동영상\s*보기/.test(e.innerText || e.value || ''));
    el && el.click();
  });
});
const popup = await popupP;
await page.waitForTimeout(4000);

const target = popup || ctx.pages().find((p) => p !== page && /vod|player|view/.test(p.url())) || page;
await target.bringToFront().catch(() => {});
await target.waitForTimeout(2000);
console.log('\nPLAYER URL:', target.url());
console.log('PLAYER TITLE:', await target.title().catch(() => ''));
console.log('total pages now:', ctx.pages().length, '(was', before, ')');

console.log('\nFRAMES:');
for (const f of target.frames()) console.log('  -', f.url().slice(0, 130));

async function probe(fr, label) {
  try {
    const r = await fr.evaluate(() => {
      const v = document.querySelector('video');
      const iframes = [...document.querySelectorAll('iframe')].map((f) => f.src).filter(Boolean);
      return {
        hasVideo: !!v,
        video: v ? { src: v.currentSrc || v.src || (v.querySelector('source')||{}).src || '', dur: v.duration, ct: v.currentTime, paused: v.paused, rate: v.playbackRate } : null,
        videojs: !!window.videojs,
        iframes,
      };
    });
    if (r.hasVideo || r.iframes.length) {
      console.log(`[${label}] video=${r.hasVideo} videojs=${r.videojs}`);
      if (r.video) console.log('   ', JSON.stringify(r.video));
      if (r.iframes.length) console.log('   iframes:', JSON.stringify(r.iframes));
    }
  } catch (e) {}
}
await probe(target.mainFrame(), 'main');
for (const f of target.frames()) if (f !== target.mainFrame()) await probe(f, 'frame:' + f.url().slice(8, 45));

await target.screenshot({ path: 'C:/computeruse/.state/kmooc-player.png' }).catch(() => {});
await browser.close();
process.exit(0);
