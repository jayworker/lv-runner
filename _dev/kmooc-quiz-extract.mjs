// kmooc-quiz-extract.mjs — 진행중 attempt의 각 page를 직접 열어 전 문항 추출(제출/저장 안 함).
import { chromium } from 'playwright';
import fs from 'fs';
const ATT = process.argv[2]; const CMID = process.argv[3];
const NPAGES = Number(process.argv[4] || 3);
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /lms\.kmooc\.kr/.test(p.url())) || ctx.pages()[0];
page.on('dialog', async (d) => { try { await d.accept(); } catch {} });
const out = [];
for (let pg = 0; pg < NPAGES; pg++) {
  await page.goto(`https://lms.kmooc.kr/mod/quiz/attempt.php?attempt=${ATT}&cmid=${CMID}&page=${pg}`, { waitUntil: 'domcontentloaded' }).catch(()=>{});
  await page.waitForTimeout(1200);
  const q = await page.evaluate(() => {
    const norm = (s)=>(s||'').replace(/\s+/g,' ').trim();
    const el = document.querySelector('.que');
    if (!el) return null;
    const type = (el.className.match(/que (\w+)/)||[])[1]||'';
    const slot = (el.id||'');
    const qtext = norm((el.querySelector('.qtext')||{}).innerText);
    const options = [...el.querySelectorAll('.answer > div, .answer .r0, .answer .r1')].map((o)=>{
      const inp = o.querySelector('input');
      return { label: norm(o.innerText), name: inp?inp.name:'', value: inp?inp.value:'', inputType: inp?inp.type:'' };
    }).filter((o)=>o.label && o.name);
    const t = el.querySelector('input[type=text], textarea');
    return { type, slot, qtext, options, textName: t?t.name:'' };
  });
  if (q) { q.page = pg; out.push(q); }
}
fs.writeFileSync(`C:/computeruse/.state/quiz-q-${CMID}.json`, JSON.stringify({ attempt: ATT, cmid: CMID, questions: out }, null, 2));
out.forEach((q)=>{
  console.log(`\n[page ${q.page}] (${q.type}) ${q.qtext}`);
  q.options.forEach((o,j)=>console.log(`   ${String.fromCharCode(97+j)}) ${o.label}   {name=${o.name} val=${o.value}}`));
  if (q.textName) console.log(`   [단답 name=${q.textName}]`);
});
await browser.close();
process.exit(0);
