// kmooc-quiz-submit.mjs v2 — 페이지별 답 입력→저장(name=next)→요약→최종 제출.
// 사용: node kmooc-quiz-submit.mjs <attempt> <cmid> <answers>
//   answers = 페이지순 콤마목록. 라디오/체크는 input value, 단답은 'T:텍스트'.
import { chromium } from 'playwright';
const ATT = process.argv[2], CMID = process.argv[3];
const ANS = (process.argv[4] || '').split(',').map((s) => s.trim());
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /lms\.kmooc\.kr/.test(p.url())) || ctx.pages()[0];
page.on('dialog', async (d) => { try { await d.accept(); } catch {} });
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

await page.goto(`https://lms.kmooc.kr/mod/quiz/attempt.php?attempt=${ATT}&cmid=${CMID}&page=0`, { waitUntil:'domcontentloaded' }).catch(()=>{});
await sleep(1000);

for (let pg = 0; pg < ANS.length; pg++) {
  const a = ANS[pg];
  const res = await page.evaluate((ans) => {
    const q = document.querySelector('.que'); if (!q) return 'no-que';
    if (ans.startsWith('T:')) {
      const t = q.querySelector('input[type=text], textarea');
      if (t) { t.value = ans.slice(2); t.dispatchEvent(new Event('change',{bubbles:true})); return 'text-set'; }
      return 'no-text';
    }
    const inp = [...q.querySelectorAll('input[type=radio], input[type=checkbox]')].find((i)=>i.value===ans);
    if (inp) { inp.checked = true; inp.click(); inp.dispatchEvent(new Event('change',{bubbles:true})); return 'picked '+ans; }
    return 'no-match '+ans;
  }, a);
  console.log(`page ${pg}: ${res}`);
  // 저장+이동: name=next 버튼(마지막 페이지는 '끝내기')
  await page.evaluate(() => { const n = document.querySelector('input[name="next"], button[name="next"]'); if (n) n.click(); });
  await sleep(2000);
  if (/summary\.php/.test(page.url())) { console.log('  → 요약 페이지 도달'); break; }
}

// 요약 페이지 보장
if (!/summary\.php/.test(page.url())) {
  await page.goto(`https://lms.kmooc.kr/mod/quiz/summary.php?attempt=${ATT}&cmid=${CMID}`, { waitUntil:'domcontentloaded' }).catch(()=>{});
  await sleep(1200);
}
const summary = await page.evaluate(()=>{
  const norm=(s)=>(s||'').replace(/\s+/g,' ').trim();
  return [...document.querySelectorAll('table.quizsummaryofattempt tr, table.generaltable tr')].map((r)=>norm(r.innerText)).filter(Boolean).slice(0,12);
});
console.log('SUMMARY:', JSON.stringify(summary));

// '모두 제출하고 마침' → 폼 제출(form action에 finishattempt)
await page.evaluate(()=>{
  const b=[...document.querySelectorAll('button,input[type=submit],a.btn')].find((e)=>/모두 제출하고 마침|제출하고 마침|제출 및 종료/.test(e.value||e.innerText));
  if (b) b.click();
});
await sleep(1500);
// 확인 모달의 제출 버튼
await page.evaluate(()=>{
  const b=[...document.querySelectorAll('.modal-footer button, .moodle-dialogue-ft button, .confirmation-dialogue input[type=submit], button, input[type=submit]')]
    .find((e)=>/제출하고 마침|확인/.test(e.value||e.innerText));
  if (b) b.click();
});
await sleep(2800);
console.log('AFTER SUBMIT URL:', page.url());
const grade = await page.evaluate(()=>{
  const norm=(s)=>(s||'').replace(/\s+/g,' ').trim();
  return [...document.querySelectorAll('.generaltable tr, .quizgradefeedback, .grade, .feedbacktext')].map((e)=>norm(e.innerText)).filter((t)=>t&&t.length<80).slice(0,15);
});
console.log('RESULT:', JSON.stringify(grade));
await page.screenshot({ path:`C:/computeruse/.state/quiz-result-${CMID}.png`, fullPage:true }).catch(()=>{});
await browser.close();
process.exit(0);
