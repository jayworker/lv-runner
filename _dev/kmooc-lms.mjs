// kmooc-lms.mjs — lms.kmooc.kr(Moodle) 내 강의실에서 수강 강좌 목록 수집, MJP 강좌 탐색.
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const pages = ctx.pages();
let page = pages.find((p) => /kmooc\.kr/.test(p.url())) || pages[0];
await page.bringToFront().catch(() => {});
await page.goto('https://lms.kmooc.kr/', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2500);
console.log('URL:', page.url(), '| TITLE:', await page.title());

const info = await page.evaluate(() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const loggedIn = !!document.querySelector('a[href*="logout"], .usermenu, .userpicture');
  const userName = norm((document.querySelector('.usermenu, .userbutton, .user-info') || {}).innerText || '');
  // Moodle 강좌 링크: /course/view.php?id=N
  const courseLinks = [...document.querySelectorAll('a[href*="/course/view.php"]')]
    .map((a) => ({ text: norm(a.innerText) || norm(a.title), href: a.href }))
    .filter((x, i, arr) => x.text && arr.findIndex((y) => y.href === x.href) === i);
  return { loggedIn, userName, courseLinks };
});
console.log('LOGGED_IN:', info.loggedIn, '| USER:', info.userName.slice(0, 60));
console.log('COURSES (' + info.courseLinks.length + '):');
for (const c of info.courseLinks) {
  const mark = /mjp/i.test(c.text + c.href) ? '  <<< MJP?' : '';
  console.log('  -', c.text, '=>', c.href, mark);
}
await page.screenshot({ path: 'C:/computeruse/.state/kmooc-lms.png', fullPage: true }).catch(() => {});
await browser.close();
process.exit(0);
