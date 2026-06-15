// kmooc-links.mjs — 홈에서 로그인 상태와 네비게이션 링크를 수집해 '내 강의실' 경로를 찾는다.
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const pages = ctx.pages();
let page = pages.find((p) => /kmooc\.kr/.test(p.url())) || pages[0];
await page.bringToFront().catch(() => {});
await page.goto('https://www.kmooc.kr/', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2000);
console.log('URL:', page.url(), '| TITLE:', await page.title());

const info = await page.evaluate(() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const links = [...document.querySelectorAll('a[href]')]
    .map((a) => ({ text: norm(a.innerText), href: a.href }))
    .filter((x) => x.text || /dashboard|mypage|my_courses|mycourse|learn|courseware|logout|강의실/i.test(x.href));
  // 로그인 흔적
  const logout = links.find((l) => /logout/i.test(l.href));
  const myroom = links.filter((l) => /강의실|mypage|dashboard|mycourse|my_course|학습/i.test(l.text + l.href));
  return {
    loggedIn: !!logout,
    logout: logout || null,
    myroom,
    allNav: links.filter((l) => l.text && l.text.length < 25).slice(0, 60),
  };
});
console.log('LOGGED_IN:', info.loggedIn, '| logout:', JSON.stringify(info.logout));
console.log('MY-ROOM candidates:');
for (const l of info.myroom) console.log('  >', JSON.stringify(l));
console.log('NAV links:');
for (const l of info.allNav) console.log('  -', l.text, '=>', l.href);

await browser.close();
process.exit(0);
