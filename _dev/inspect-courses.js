// inspect-courses.js — 과목 전환 드롭다운(select)의 옵션/onchange 확인
import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://localhost:9222');
const page = b.contexts()[0].pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr')) || b.contexts()[0].pages()[0];
await page.goto('https://ecampus.konkuk.ac.kr/ilos/st/course/online_list_form.acl?WEEK_NO=1', { waitUntil: 'domcontentloaded' }).catch(()=>{});
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const out = { selects: [] };
  document.querySelectorAll('select').forEach((sel) => {
    const opts = [...sel.options].map((o) => ({ text: o.text.trim(), value: o.value, selected: o.selected }));
    // 과목명처럼 보이는 select만
    if (opts.some((o) => /디지털패션|초격차|융합소재|\(\d{2}\)/.test(o.text))) {
      out.selects.push({ id: sel.id, name: sel.name, onchange: sel.getAttribute('onchange'), options: opts });
    }
  });
  // 과목 전환 관련 함수/링크
  out.changeFns = [...document.querySelectorAll('[onchange],[onclick]')]
    .map((e) => e.getAttribute('onchange') || e.getAttribute('onclick'))
    .filter((s) => s && /course|class|cours|submain|changeClass|move/i.test(s))
    .slice(0, 15);
  return out;
});
console.log(JSON.stringify(info, null, 2));
await b.close();
process.exit(0);
