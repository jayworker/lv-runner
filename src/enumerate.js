// enumerate.js — 모든 주차를 순회하며 강의 파트 목록/진도/출석인정기간을 수집해 리포트 생성.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', '.state');
fs.mkdirSync(STATE_DIR, { recursive: true });

const BASE = 'https://ecampus.konkuk.ac.kr/ilos/st/course/online_list_form.acl?WEEK_NO=';
const MAX_WEEK = 16;

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr'));
if (!page) { console.log('no ecampus page'); await browser.close(); process.exit(1); }
await page.bringToFront().catch(() => {});

const weeks = [];
for (let w = 1; w <= MAX_WEEK; w++) {
  await page.goto(BASE + w, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  const data = await page.evaluate(() => {
    // 파트 span들(순서대로). 여러 파트가 한 행에 같이 있으므로, 파트명으로 블록 텍스트를 분할해 per-part 파싱.
    const partEls = [...document.querySelectorAll('[onclick*="viewGo"]')].filter((e) => (e.innerText || '').trim());
    const names = partEls.map((e) => e.innerText.trim().replace(/\s+/g, ' '));
    // 모든 파트를 포함하는 최소 공통 조상(상세 블록) — TOC 등 제외
    let block = document.body;
    if (partEls.length) { let a = partEls[0]; while (a && !partEls.every((p) => a.contains(p))) a = a.parentElement; block = a || document.body; }
    const text = (block.innerText || '').replace(/\s+/g, ' ');
    const parts = partEls.map((el, i) => {
      const oc = el.getAttribute('onclick') || '';
      const m = oc.match(/viewGo\(([^)]*)\)/);
      const args = m ? m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')) : [];
      // 이 파트명 ~ 다음 파트명 사이 구간만 파싱
      const start = text.indexOf(names[i]);
      const end = (i + 1 < names.length) ? text.indexOf(names[i + 1], start + 1) : text.length;
      const seg = start >= 0 ? text.slice(start, end < 0 ? text.length : end) : '';
      const times = seg.match(/(\d+:\d+)\s*\/\s*(\d+:\d+)\s*\/\s*(\d+:\d+)/);
      const pct = seg.match(/(\d+)%/);
      return {
        name: names[i],
        item_id: args[4] || '',
        viewGoArgs: args,
        percent: pct ? Number(pct[1]) : null,
        inPeriod: times ? times[1] : null,
        outPeriod: times ? times[2] : null,
        required: times ? times[3] : null,
      };
    });
    // 차시별 출석인정기간
    const periods = [];
    document.querySelectorAll('*').forEach((el) => {
      const t = (el.innerText || '').trim();
      if (/^출석인정기간\s*:/.test(t) && t.length < 80 && el.children.length <= 2) periods.push(t.replace(/\s+/g, ' '));
    });
    // 차시 제목
    const sessions = [];
    document.querySelectorAll('*').forEach((el) => {
      const t = (el.innerText || '').trim();
      if (/^\d+차시/.test(t) && t.length < 100 && el.children.length <= 3) sessions.push(t.replace(/\s+/g, ' '));
    });
    return { parts, periods: [...new Set(periods)], sessions: [...new Set(sessions)] };
  });
  if (data.parts.length > 0) {
    weeks.push({ week: w, ...data });
    console.log(`week ${w}: ${data.parts.length} parts`);
  }
}

fs.writeFileSync(path.join(STATE_DIR, 'report.json'), JSON.stringify({ time: new Date().toISOString(), weeks }, null, 2));
console.log('\nsaved report.json with', weeks.length, 'weeks');
await browser.close();
process.exit(0);
