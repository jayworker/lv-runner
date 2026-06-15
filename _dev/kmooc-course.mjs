// kmooc-course.mjs — MJP 강좌(id=18736) 안의 섹션/활동(영상)·진도 구조 파악.
import { chromium } from 'playwright';
import fs from 'fs';

const COURSE_ID = process.argv[2] || '18736';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const pages = ctx.pages();
let page = pages.find((p) => /kmooc\.kr/.test(p.url())) || pages[0];
await page.bringToFront().catch(() => {});
await page.goto(`https://lms.kmooc.kr/course/view.php?id=${COURSE_ID}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2500);
console.log('URL:', page.url(), '| TITLE:', await page.title());

const info = await page.evaluate(() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  // Moodle 활동 모듈
  const mods = [...document.querySelectorAll('li.activity, .activity-item, li[class*="modtype_"]')].map((li) => {
    const a = li.querySelector('a[href]');
    const cls = li.className;
    const typeM = cls.match(/modtype_(\w+)/);
    // 진도/완료 표시
    const completion = norm((li.querySelector('.completion, .autocompletion, [class*="completion"]') || {}).getAttribute?.('data-state') || '');
    const completed = !!li.querySelector('.complete, .completion-icon-completed, img[alt*="완료"], [data-toggletype]');
    return {
      type: typeM ? typeM[1] : '',
      text: norm(li.innerText).slice(0, 100),
      href: a ? a.href : '',
      completed,
    };
  }).filter((m) => m.text || m.href);
  // 섹션 제목
  const sections = [...document.querySelectorAll('.section .sectionname, h3.sectionname, .content > h3')].map((e) => norm(e.innerText)).filter(Boolean);
  return { sections, mods };
});
console.log('SECTIONS:', JSON.stringify(info.sections));
console.log('\nMODULES (' + info.mods.length + '):');
const types = {};
for (const m of info.mods) {
  types[m.type] = (types[m.type] || 0) + 1;
  console.log(`  [${m.type}]${m.completed ? '✓' : ' '} ${m.text} => ${m.href}`);
}
console.log('\nTYPE COUNTS:', JSON.stringify(types));
fs.writeFileSync('C:/computeruse/.state/kmooc-course-' + COURSE_ID + '.json', JSON.stringify(info, null, 2));
await page.screenshot({ path: 'C:/computeruse/.state/kmooc-course-' + COURSE_ID + '.png', fullPage: true }).catch(() => {});
await browser.close();
process.exit(0);
