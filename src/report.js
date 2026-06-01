// report.js — 현재 활성 과목의 수강현황(진도율 + 주차별 출석 dot)을 출력한다.
// 사용: npm run report
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

const browser = await chromium.connectOverCDP(`http://localhost:${cfg.debugPort}`).catch(() => null);
if (!browser) {
  console.error(`브라우저에 연결 실패. 먼저 "npm run launch" 후 로그인했는지 확인하세요. (포트 ${cfg.debugPort})`);
  process.exit(1);
}
const page = browser.contexts()[0].pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr'))
  || browser.contexts()[0].pages()[0];

await page.goto(cfg.listUrlBase + 1, { waitUntil: 'domcontentloaded' }).catch(() => {});
await page.waitForTimeout(1800);

const info = await page.evaluate(() => {
  const course = (document.body.innerText.match(/\[서울\][^\n(]+\(\d+\)/) || [])[0] || '(과목명 미확인)';
  const pct = (document.body.innerText.match(/나의진도율[^\d]*([\d.]+%)/) || [])[1] || '?';
  const dots = [...new Set([...document.querySelectorAll('*')]
    .map((e) => (e.innerText || '').trim().replace(/\s+/g, ' '))
    .filter((t) => /^\d+주 \d\/\d$/.test(t)))];
  return { course, pct, dots };
});

console.log('\n과목:', info.course);
console.log('나의진도율:', info.pct);
console.log('주차별 출석(1/1=이수):');
for (const d of info.dots) {
  const done = /1\/1$/.test(d);
  console.log(`  ${done ? '✅' : '⬜'} ${d}`);
}
console.log('\n(참고: 1/1=콘텐츠 이수. 출석 점수는 출석인정기간 내 수강분만 인정)');
await browser.close();
process.exit(0);
