// kmooc-quiz-start.mjs — K-MOOC(Moodle) 퀴즈 응시를 시작(또는 이어서)하고 전 문항을 추출한다.
//
// 사용: node src/kmooc-quiz-start.mjs <cmid>
//   <cmid> = mod/quiz/view.php?id=<cmid> 의 id (강좌 페이지에서 kmooc-course로 확인)
//
// 출력: 콘솔에 attempt 번호·페이지수·각 문항/보기(val 포함), 그리고 .state/quiz-q-<cmid>.json 저장.
//   → 이 문항들을 보고 정답을 정한 뒤 kmooc-quiz-submit.mjs 로 제출한다.
//
// 주의: 기말고사는 응시마다 문제은행에서 다른 문항이 출제된다(주차퀴즈는 같은 문항 순서만 셔플).
//       따라서 반드시 "이번에 시작한 attempt"의 문항을 보고 답을 정할 것. 이전 답 재사용 금지.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE = path.join(__dirname, '..', '.state');
fs.mkdirSync(STATE, { recursive: true });

const CMID = process.argv[2];
if (!CMID) { console.error('사용법: node src/kmooc-quiz-start.mjs <cmid>'); process.exit(1); }
const PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.connectOverCDP(`http://localhost:${PORT}`);
const ctx = browser.contexts()[0];
const page = ctx.pages().find((x) => /lms\.kmooc\.kr/.test(x.url())) || ctx.pages()[0];
page.on('dialog', async (d) => { try { await d.accept(); } catch {} }); // 응시 시작 confirm 수락

await page.goto(`https://lms.kmooc.kr/mod/quiz/view.php?id=${CMID}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await sleep(1200);
// '바로 퀴즈에 응시' / '퀴즈 계속 응시'
await page.evaluate(() => { const x = [...document.querySelectorAll('button,input[type=submit],a')].find((e) => /응시/.test(e.innerText || e.value)); x && x.click(); });
await sleep(2500);
// 시작 확인 페이지(시간제한 안내 등)가 또 있으면 한번 더
await page.evaluate(() => { const x = [...document.querySelectorAll('button,input[type=submit]')].find((e) => /응시 시작|시작/.test(e.innerText || e.value)); x && x.click(); });
await sleep(2000);

const url = page.url();
const att = (url.match(/attempt=(\d+)/) || [])[1];
if (!att) { console.error('attempt 시작 실패. 로그인/접근 권한 확인. URL:', url); await browser.close(); process.exit(1); }

// 페이지수 = 문제 네비게이션 버튼의 page 파라미터 dedup
const npages = await page.evaluate(() => {
  const set = new Set();
  document.querySelectorAll('.qnbutton').forEach((b) => { const m = (b.getAttribute('href') || '').match(/page=(\d+)/); set.add(m ? m[1] : '0'); });
  return Math.max(set.size, 1);
});
console.log('ATTEMPT:', att, '| CMID:', CMID, '| pages:', npages);

const out = [];
for (let pg = 0; pg < npages; pg++) {
  await page.goto(`https://lms.kmooc.kr/mod/quiz/attempt.php?attempt=${att}&cmid=${CMID}&page=${pg}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(900);
  const q = await page.evaluate(() => {
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const el = document.querySelector('.que');
    if (!el) return null;
    const type = (el.className.match(/que (\w+)/) || [])[1] || '';
    const qtext = norm((el.querySelector('.qtext') || {}).innerText);
    const options = [...el.querySelectorAll('.answer > div, .answer .r0, .answer .r1')].map((o) => {
      const i = o.querySelector('input');
      return { label: norm(o.innerText), value: i ? i.value : '', name: i ? i.name : '', itype: i ? i.type : '' };
    }).filter((o) => o.label && o.name);
    const t = el.querySelector('input[type=text], textarea');
    return { type, qtext, options, textName: t ? t.name : '' };
  });
  if (q) { q.page = pg; out.push(q); }
}

fs.writeFileSync(path.join(STATE, `quiz-q-${CMID}.json`), JSON.stringify({ attempt: att, cmid: CMID, npages, questions: out }, null, 2));
out.forEach((q) => {
  console.log(`\n[page ${q.page}] (${q.type}) ${q.qtext}`);
  q.options.forEach((o, j) => console.log(`   ${String.fromCharCode(97 + j)}) ${o.label}  {val=${o.value}}`));
  if (q.textName) console.log(`   [단답 name=${q.textName}]`);
});
console.log(`\n→ 답 결정 후: node src/kmooc-quiz-submit.mjs ${att} ${CMID} "<페이지순 답,콤마>"`);
await browser.close();
process.exit(0);
