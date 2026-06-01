// verify-attend.js — 플레이어가 열려있으면 #close_(출석종료) 정확히 클릭 → 닫힘 후 13주차 진도 확인
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(__dirname, '..', '.state');

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
let page = ctx.pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr'));
page.on('dialog', (d) => { console.log('dialog:', d.message().slice(0,80)); d.accept().catch(()=>{}); });

// 플레이어가 열려 있으면 #close_ 클릭
const inPlayer = page.url().includes('online_view_form');
console.log('in player?', inPlayer, page.url());
if (inPlayer) {
  let clicked = false;
  for (const f of page.frames()) {
    const r = await f.evaluate(() => {
      const el = document.getElementById('close_');
      if (el) { el.click(); return true; }
      return false;
    }).catch(()=>false);
    if (r) { clicked = true; break; }
  }
  console.log('#close_ clicked?', clicked);
  await page.waitForTimeout(5000);
  console.log('after click url:', page.url());
}

// 13주차 목록으로 가서 part1 진도 확인
await page.goto('https://ecampus.konkuk.ac.kr/ilos/st/course/online_list_form.acl?WEEK_NO=13', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1800);
const info = await page.evaluate(() => {
  const myPct = (document.body.innerText.match(/나의진도율[^\d]*([\d.]+%)/)||[])[1] || null;
  const rows = [];
  document.querySelectorAll('[onclick*="viewGo"]').forEach((el)=>{
    const name=(el.innerText||'').trim(); if(!name) return;
    const row=el.closest('li,tr')||el.parentElement?.parentElement;
    rows.push((row?row.innerText:'').replace(/\s+/g,' ').trim().slice(0,120));
  });
  // 13주 dot 상태
  const dot = [...document.querySelectorAll('*')].map(e=>(e.innerText||'').trim()).find(t=>/^13주\s*\d\/\d$/.test(t));
  const period = (document.body.innerText.match(/출석인정기간[^\n]*/)||[])[0];
  return { myPct, rows: [...new Set(rows)], dot, period };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: path.join(STATE, 'verify-week13.png') }).catch(()=>{});
await browser.close();
process.exit(0);
