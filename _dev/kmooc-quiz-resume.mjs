// kmooc-quiz-resume.mjs — 진행중 attempt를 이어 열고 네비/문항/페이지 구조 확인.
import { chromium } from 'playwright';
const ATT = process.argv[2]; const CMID = process.argv[3] || '2156156';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => /lms\.kmooc\.kr/.test(p.url())) || ctx.pages()[0];
page.on('dialog', async (d) => { try { await d.accept(); } catch {} });
const url = ATT ? `https://lms.kmooc.kr/mod/quiz/attempt.php?attempt=${ATT}&cmid=${CMID}`
               : `https://lms.kmooc.kr/mod/quiz/view.php?id=${CMID}`;
await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(2000);
console.log('URL:', page.url());
const r = await page.evaluate(() => {
  const norm = (s)=>(s||'').replace(/\s+/g,' ').trim();
  const navBtns = [...document.querySelectorAll('.qnbutton')].map((b)=>({t:norm(b.innerText), href:b.getAttribute('href')||'', cls:b.className}));
  const ques = [...document.querySelectorAll('.que')].map((q)=>norm((q.querySelector('.qtext')||{}).innerText).slice(0,80));
  const nextBtns = [...document.querySelectorAll('input[type=submit],button')].map((b)=>norm(b.value||b.innerText)).filter(Boolean);
  return { navCount: navBtns.length, navBtns, ques, nextBtns: [...new Set(nextBtns)] };
});
console.log('NAV buttons (문항 수):', r.navCount);
console.log('NAV detail:', JSON.stringify(r.navBtns));
console.log('Questions on this page:', JSON.stringify(r.ques));
console.log('Submit/nav buttons:', JSON.stringify(r.nextBtns));
await page.screenshot({ path: 'C:/computeruse/.state/quiz-resume.png', fullPage: true }).catch(()=>{});
await browser.close();
process.exit(0);
