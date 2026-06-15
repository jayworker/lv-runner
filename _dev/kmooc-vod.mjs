// kmooc-vod.mjs — VOD 플레이어(mod/vod/view.php?id=N) 내부 구조 파악.
import { chromium } from 'playwright';

const VID = process.argv[2] || '2156152';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const pages = ctx.pages();
let page = pages.find((p) => /kmooc\.kr/.test(p.url())) || pages[0];
await page.bringToFront().catch(() => {});
await page.goto(`https://lms.kmooc.kr/mod/vod/view.php?id=${VID}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(3500);
console.log('URL:', page.url(), '| TITLE:', await page.title());

// 프레임 구조
console.log('\nFRAMES:');
for (const f of page.frames()) console.log('  -', f.url().slice(0, 120));

// 메인 + 각 프레임에서 video/player 탐색
async function probe(fr, label) {
  try {
    const r = await fr.evaluate(() => {
      const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const vids = [...document.querySelectorAll('video')].map((v) => ({
        src: v.currentSrc || v.src || (v.querySelector('source') || {}).src || '',
        dur: v.duration, ct: v.currentTime, paused: v.paused, rate: v.playbackRate,
      }));
      const iframes = [...document.querySelectorAll('iframe')].map((f) => f.src);
      // 진도/시간 표시 후보
      const prog = [...document.querySelectorAll('[class*="progress"],[class*="time"],[id*="progress"]')]
        .map((e) => norm(e.innerText)).filter((t) => t && t.length < 60).slice(0, 8);
      const players = [...document.querySelectorAll('[id*="player"],[class*="player"],[class*="video"]')]
        .map((e) => e.tagName + '#' + e.id + '.' + (e.className || '').toString().slice(0, 40)).slice(0, 8);
      return { vids, iframes, prog, players, hasVideoJs: !!window.videojs, bodyLen: document.body.innerText.length };
    });
    console.log(`\n[${label}] videos=${r.vids.length} iframes=${r.iframes.length} videojs=${r.hasVideoJs}`);
    r.vids.forEach((v, i) => console.log(`   video#${i}:`, JSON.stringify(v)));
    if (r.iframes.length) console.log('   iframes:', JSON.stringify(r.iframes));
    if (r.players.length) console.log('   players:', JSON.stringify(r.players));
    if (r.prog.length) console.log('   prog:', JSON.stringify(r.prog));
  } catch (e) { console.log(`[${label}] err`, e.message.slice(0, 80)); }
}
await probe(page.mainFrame(), 'main');
for (const f of page.frames()) if (f !== page.mainFrame()) await probe(f, 'frame:' + f.url().slice(8, 50));

await page.screenshot({ path: 'C:/computeruse/.state/kmooc-vod.png', fullPage: true }).catch(() => {});
await browser.close();
process.exit(0);
