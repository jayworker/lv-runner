// kmooc-quiz-read.mjs — 퀴즈 응시를 시작하고 문항/보기 추출 → JSON 저장. (제출 안 함)
import { chromium } from 'playwright';
import fs from 'fs';
const QID = process.argv[2] || '2156156';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /lms\.kmooc\.kr/.test(p.url())) || ctx.pages()[0];
page.on('dialog', async (d) => { try { await d.accept(); } catch {} }); // 응시 시작 확인 수락

await page.goto(`https://lms.kmooc.kr/mod/quiz/view.php?id=${QID}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(1500);
// '바로 퀴즈에 응시' 또는 '퀴즈 계속 응시' 클릭
await page.click('input[type=submit][value*="응시"], button:has-text("응시"), a:has-text("응시")').catch(async () => {
  await page.evaluate(() => { const b = [...document.querySelectorAll('button,input[type=submit],a')].find((e)=>/응시/.test(e.innerText||e.value)); b&&b.click(); });
});
await page.waitForTimeout(2500);
// 시작 확인 페이지가 또 있으면(시간제한 안내) 한번 더
await page.click('input[type=submit][value*="응시 시작"], button:has-text("응시 시작")').catch(() => {});
await page.waitForTimeout(2500);
console.log('ATTEMPT URL:', page.url());

const data = await page.evaluate(() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const qs = [...document.querySelectorAll('.que')].map((q) => {
    const num = norm((q.querySelector('.qno, .info .no') || {}).innerText);
    const qtext = norm((q.querySelector('.qtext') || {}).innerText);
    const type = (q.className.match(/que (\w+)/) || [])[1] || '';
    const options = [...q.querySelectorAll('.answer .r0, .answer .r1, .answer > div')].map((opt) => {
      const inp = opt.querySelector('input');
      const lbl = norm(opt.innerText);
      return { label: lbl, name: inp ? inp.name : '', value: inp ? inp.value : '', inputType: inp ? inp.type : '' };
    }).filter((o) => o.label);
    // 주관식/단답
    const textInput = q.querySelector('input[type=text], textarea');
    return { num, type, qtext, options, hasText: !!textInput, textName: textInput ? textInput.name : '' };
  });
  return { count: qs.length, questions: qs };
});
console.log('QUESTIONS:', data.count);
fs.writeFileSync(`C:/computeruse/.state/quiz-${QID}.json`, JSON.stringify(data, null, 2));
data.questions.forEach((q) => {
  console.log(`\n[${q.num}] (${q.type}) ${q.qtext}`);
  q.options.forEach((o, i) => console.log(`   ${String.fromCharCode(97+i)}) ${o.label}  {name=${o.name} val=${o.value}}`));
  if (q.hasText) console.log(`   [단답: ${q.textName}]`);
});
await page.screenshot({ path: `C:/computeruse/.state/quiz-attempt-${QID}.png`, fullPage: true }).catch(() => {});
await browser.close();
process.exit(0);
