// kmooc-completion.mjs — 강좌 페이지에서 vod 모듈의 실제 완료 표시 마크업 확인.
import { chromium } from 'playwright';
const COURSE = process.argv[2] || '18736';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /kmooc\.kr/.test(p.url()) && !/viewer/.test(p.url())) || ctx.pages()[0];
await page.goto(`https://lms.kmooc.kr/course/view.php?id=${COURSE}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2500);
const r = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('li.activity.modtype_vod, li[class*="modtype_vod"]').forEach((li) => {
    const a = li.querySelector('a[href*="vod/view.php"]');
    const id = a ? (a.href.match(/id=(\d+)/) || [])[1] : '';
    const title = (a ? a.innerText : li.innerText).replace(/\s+/g, ' ').trim().slice(0, 45);
    // 완료표시 후보 HTML
    const comp = li.querySelector('.completion, .autocompletion, [class*="completion"], .ubcompletion');
    out.push({ id, title, compHTML: comp ? comp.outerHTML.replace(/\s+/g, ' ').slice(0, 260) : '(none)' });
  });
  return out;
});
for (const x of r) { console.log('VOD', x.id, '|', x.title); console.log('   ', x.compHTML, '\n'); }
await browser.close();
process.exit(0);
