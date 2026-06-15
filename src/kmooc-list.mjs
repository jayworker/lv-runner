// kmooc-list.mjs — K-MOOC(Moodle) 수강 강좌/모듈 탐색 도구.
//
// 사용:
//   node src/kmooc-list.mjs              → 내 강의실(lms.kmooc.kr)의 수강 강좌 목록(id 포함)
//   node src/kmooc-list.mjs <courseId>   → 해당 강좌의 VOD(완료상태)·퀴즈(cmid)·과제 목록
//
// 전제: launch로 띄운 Edge(포트 9222)에 lms.kmooc.kr 로그인돼 있어야 함.
import { chromium } from 'playwright';

const COURSE = process.argv[2];
const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.connectOverCDP(`http://localhost:${PORT}`);
const ctx = browser.contexts()[0];
const page = ctx.pages().find((x) => /kmooc\.kr/.test(x.url())) || ctx.pages()[0];

if (!COURSE) {
  await page.goto('https://lms.kmooc.kr/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2500);
  const courses = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('a[href*="/course/view.php"]')]
      .map((a) => ({ text: norm(a.innerText) || norm(a.title), id: (a.href.match(/id=(\d+)/) || [])[1] }))
      .filter((x, i, arr) => x.id && x.text && arr.findIndex((y) => y.id === x.id) === i);
  });
  console.log('수강 강좌:');
  for (const c of courses) console.log(`  id=${c.id}  ${c.text.slice(0, 60)}`);
} else {
  await page.goto(`https://lms.kmooc.kr/course/view.php?id=${COURSE}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(2500);
  const data = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const grab = (type, hrefkey) => [...document.querySelectorAll(`li[class*="modtype_${type}"]`)].map((li) => {
      const a = li.querySelector(`a[href*="${hrefkey}"]`);
      const id = a ? (a.href.match(/id=(\d+)/) || [])[1] : '';
      const title = norm((a || li).innerText).replace(/동영상.*$/, '').slice(0, 50);
      const img = li.querySelector('.autocompletion img, [class*="completion"] img');
      const done = img ? /completion-auto-y|-y$/.test(img.getAttribute('src') || '') : null;
      return { id, title, done };
    });
    return { title: norm((document.querySelector('h1, .page-header-headings') || {}).innerText).slice(0, 60),
      vod: grab('vod', 'vod/view.php'), quiz: grab('quiz', 'quiz/view.php'), assign: grab('assign', 'assign/view.php') };
  });
  console.log('강좌:', data.title);
  console.log('\nVOD (영상):');
  for (const v of data.vod) console.log(`  ${v.done ? '✅' : '❌'} id=${v.id}  ${v.title}`);
  console.log('\n퀴즈:');
  for (const q of data.quiz) console.log(`  cmid=${q.id}  ${q.title}`);
  if (data.assign.length) { console.log('\n과제(서술형, 수동):'); for (const a of data.assign) console.log(`  id=${a.id}  ${a.title}`); }
}
await browser.close();
process.exit(0);
