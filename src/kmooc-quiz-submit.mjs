// kmooc-quiz-submit.mjs — 진행중 attempt에 페이지별 답을 입력·저장하고 최종 제출한다.
//
// 사용: node src/kmooc-quiz-submit.mjs <attempt> <cmid> <answers>
//   <answers> = 페이지(문항) 순서대로 콤마로 구분.
//     - 라디오/체크(객관식·참거짓): 선택할 input 의 value (kmooc-quiz-start 출력의 {val=...})
//       예) 참거짓 "1,0,1"  /  객관식 "2,3,0,1"
//     - 단답형: 'T:정답텍스트'  예) "2,T:5축,1"
//
// 동작: 각 페이지에서 답 선택 → input[name="next"] 클릭(저장+다음). 마지막엔 요약 폼을
//       form.submit()로 직접 제출(finishattempt=1 hidden 포함 → JS 확인모달 우회). 채점은 review.php.
//
// 주의(비가역): 최종 제출은 채점되는 비가역 행위다. 반드시 사용자 명시 승인 후 실행.
//       (auto-mode classifier가 차단할 수 있음 — 그 경우 사용자 승인을 받아 재시도.)
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(__dirname, '..', '.state');

const ATT = process.argv[2], CMID = process.argv[3];
const ANS = (process.argv[4] || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!ATT || !CMID || !ANS.length) { console.error('사용법: node src/kmooc-quiz-submit.mjs <attempt> <cmid> "<답,콤마>"'); process.exit(1); }
const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.connectOverCDP(`http://localhost:${PORT}`);
const ctx = browser.contexts()[0];
const page = ctx.pages().find((x) => /lms\.kmooc\.kr/.test(x.url())) || ctx.pages()[0];
page.on('dialog', async (d) => { try { await d.accept(); } catch {} });

await page.goto(`https://lms.kmooc.kr/mod/quiz/attempt.php?attempt=${ATT}&cmid=${CMID}&page=0`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await sleep(900);

for (let pg = 0; pg < ANS.length; pg++) {
  const a = ANS[pg];
  const res = await page.evaluate((ans) => {
    const q = document.querySelector('.que'); if (!q) return 'no-que';
    if (ans.startsWith('T:')) {
      const t = q.querySelector('input[type=text], textarea');
      if (t) { t.value = ans.slice(2); t.dispatchEvent(new Event('change', { bubbles: true })); return 'text-set'; }
      return 'no-text';
    }
    const inp = [...q.querySelectorAll('input[type=radio], input[type=checkbox]')].find((i) => i.value === ans);
    if (inp) { inp.checked = true; inp.click(); inp.dispatchEvent(new Event('change', { bubbles: true })); return 'picked ' + ans; }
    return 'no-match ' + ans;
  }, a);
  console.log(`page ${pg}: ${res}`);
  await page.evaluate(() => { const n = document.querySelector('input[name="next"], button[name="next"]'); if (n) n.click(); });
  await sleep(1900);
  if (/summary\.php/.test(page.url())) { console.log('  → 요약 도달'); break; }
}

if (!/summary\.php/.test(page.url())) {
  await page.goto(`https://lms.kmooc.kr/mod/quiz/summary.php?attempt=${ATT}&cmid=${CMID}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(1000);
}
const sum = await page.evaluate(() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  return [...document.querySelectorAll('table.quizsummaryofattempt tr')].map((r) => norm(r.innerText)).filter(Boolean);
});
console.log('SUMMARY:', JSON.stringify(sum));

// 최종 제출 (form.submit으로 확인모달 우회)
await page.evaluate(() => { const f = document.querySelector('form[action*="processattempt"]'); if (f) f.submit(); });
await sleep(3500);
console.log('AFTER URL:', page.url());
const r = await page.evaluate(() => {
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const g = norm((document.querySelector('.quizreviewsummary, .grade, table.generaltable') || {}).innerText || '');
  const states = [...document.querySelectorAll('.que .state')].map((e) => norm(e.innerText));
  return { grade: g.slice(0, 260), states };
});
console.log('RESULT:', JSON.stringify(r, null, 1));
await page.screenshot({ path: path.join(STATE, `quiz-review-${CMID}.png`), fullPage: true }).catch(() => {});
await browser.close();
process.exit(0);
