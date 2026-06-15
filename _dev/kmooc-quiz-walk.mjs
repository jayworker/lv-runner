// kmooc-quiz-walk.mjs — 진행중 attempt를 모든 페이지 순회하며 전체 문항 추출(제출 안 함).
// 사용: node kmooc-quiz-walk.mjs <cmid>  (진행중 attempt가 있으면 이어서, 없으면 시작)
import { chromium } from 'playwright';
import fs from 'fs';
const CMID = process.argv[2] || '2156156';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /lms\.kmooc\.kr/.test(p.url())) || ctx.pages()[0];
page.on('dialog', async (d) => { try { await d.accept(); } catch {} });

await page.goto(`https://lms.kmooc.kr/mod/quiz/view.php?id=${CMID}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(1200);
await page.evaluate(() => { const b = [...document.querySelectorAll('button,input[type=submit],a')].find((e)=>/응시/.test(e.innerText||e.value)); b&&b.click(); });
await page.waitForTimeout(2500);
await page.evaluate(() => { const b = [...document.querySelectorAll('button,input[type=submit]')].find((e)=>/응시 시작|시작/.test(e.innerText||e.value)); b&&b.click(); });
await page.waitForTimeout(2000);

// 퀴즈 네비게이션에서 전체 문항 수
const navInfo = await page.evaluate(() => {
  const dots = [...document.querySelectorAll('.qnbutton')].map((b)=>b.getAttribute('href')||b.innerText.trim());
  return { totalButtons: dots.length };
});
console.log('NAV question buttons:', navInfo.totalButtons, '| start url:', page.url());

const all = [];
const seen = new Set();
for (let pageNo = 0; pageNo < 30; pageNo++) {
  await page.waitForTimeout(800);
  const part = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    return [...document.querySelectorAll('.que')].map((q) => {
      const type = (q.className.match(/que (\w+)/) || [])[1] || '';
      const slot = (q.id||'').replace('question-','');
      const qtext = norm((q.querySelector('.qtext') || {}).innerText);
      const options = [...q.querySelectorAll('.answer > div, .answer .r0, .answer .r1')].map((opt) => {
        const inp = opt.querySelector('input');
        return { label: norm(opt.innerText), name: inp?inp.name:'', value: inp?inp.value:'', inputType: inp?inp.type:'' };
      }).filter((o)=>o.label && o.name);
      const t = q.querySelector('input[type=text], textarea');
      return { slot, type, qtext, options, textName: t?t.name:'' };
    });
  });
  let added = 0;
  for (const q of part) { if (!seen.has(q.slot)) { seen.add(q.slot); all.push(q); added++; } }
  // 다음 페이지 버튼
  const hasNext = await page.evaluate(() => {
    const n = [...document.querySelectorAll('input[type=submit], button')].find((e)=>/다음|next/i.test(e.value||e.innerText) && !/페이지 없음/.test(e.value||''));
    if (n) { n.click(); return true; } return false;
  });
  if (!hasNext) { console.log('no next button after page', pageNo); break; }
}
console.log('TOTAL questions collected:', all.length);
fs.writeFileSync(`C:/computeruse/.state/quiz-all-${CMID}.json`, JSON.stringify(all, null, 2));
all.forEach((q,i) => {
  console.log(`\n#${i+1} [slot ${q.slot}] (${q.type}) ${q.qtext}`);
  q.options.forEach((o,j)=>console.log(`   ${String.fromCharCode(97+j)}) ${o.label}  {name=${o.name} val=${o.value}}`));
  if (q.textName) console.log(`   [단답 name=${q.textName}]`);
});
await browser.close();
process.exit(0);
