// kmooc-explore.mjs — K-MOOC 내 강의실에서 MJP 강의를 찾고 구조를 파악한다.
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const pages = ctx.pages();
let page = pages.find((p) => /kmooc\.kr/.test(p.url())) || pages[0];
await page.bringToFront().catch(() => {});

// 내 강의실(대시보드)로 이동
await page.goto('https://www.kmooc.kr/dashboard', { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2500);
console.log('URL:', page.url());
console.log('TITLE:', await page.title());

const info = await page.evaluate(() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  // 로그인 상태 추정
  const loggedIn = !!document.querySelector('.user-dropdown, .username, a[href*="logout"], [href*="dashboard"]');
  // 수강 강좌 카드/링크 수집
  const courseLinks = [...document.querySelectorAll('a[href*="/courses/"]')]
    .map((a) => ({ text: norm(a.innerText), href: a.href }))
    .filter((x) => x.href.includes('/courses/'));
  // 대시보드 카드 제목들
  const cards = [...document.querySelectorAll('.course, .course-card, .my-course, article, li')]
    .map((el) => norm(el.innerText)).filter((t) => t && t.length < 300);
  return { loggedIn, courseLinks, bodyHasMJP: /mjp/i.test(document.body.innerText), sampleCards: cards.slice(0, 30) };
});
console.log('LOGGED_IN:', info.loggedIn, '| bodyHasMJP:', info.bodyHasMJP);
console.log('COURSE_LINKS:');
for (const c of info.courseLinks) console.log('  -', JSON.stringify(c));
console.log('CARDS(sample):');
for (const c of info.sampleCards) console.log('  *', c.slice(0, 120));

await page.screenshot({ path: 'C:/computeruse/.state/kmooc-dashboard.png', fullPage: true }).catch(() => {});
await browser.close();
process.exit(0);
