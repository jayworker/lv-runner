// kmooc-quiz-info.mjs — 퀴즈 정보 페이지(mod/quiz/view.php?id)에서 응시조건/상태 파악(응시 시작 안 함).
import { chromium } from 'playwright';
const QID = process.argv[2] || '2156156';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /lms\.kmooc\.kr/.test(p.url())) || ctx.pages()[0];
page.on('dialog', async (d) => { try { await d.dismiss(); } catch {} }); // 시작 안 하므로 dismiss
await page.goto(`https://lms.kmooc.kr/mod/quiz/view.php?id=${QID}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2000);
console.log('TITLE:', await page.title());
const r = await page.evaluate(() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const bodyText = norm(document.querySelector('[role=main], #region-main, .quizinfo, .box') ? (document.querySelector('#region-main') || document.body).innerText : document.body.innerText);
  // 응시 버튼
  const btn = [...document.querySelectorAll('button, input[type=submit], a.btn')].map((b) => norm(b.innerText || b.value)).filter(Boolean);
  // 이미 응시한 기록 테이블
  const grades = [...document.querySelectorAll('table.generaltable td, .grade, .gradedhighest')].map((t) => norm(t.innerText)).filter((t) => t && t.length < 40).slice(0, 20);
  // 응시 제한/조건 안내
  const info = [...document.querySelectorAll('.quizattempt, .quizinfo, .quizattemptsummary, table.quizattemptsummary td, .box.py-3, dl, .alert')].map((e) => norm(e.innerText)).filter((t) => t && t.length < 200).slice(0, 15);
  return { bodyText: bodyText.slice(0, 900), buttons: [...new Set(btn)], grades, info };
});
console.log('\nBUTTONS:', JSON.stringify(r.buttons));
console.log('\nINFO:'); r.info.forEach((x) => console.log('  -', x));
console.log('\nGRADES/CELLS:', JSON.stringify(r.grades));
console.log('\nBODY(900):\n', r.bodyText);
await page.screenshot({ path: `C:/computeruse/.state/kmooc-quiz-${QID}.png`, fullPage: true }).catch(() => {});
await browser.close();
process.exit(0);
