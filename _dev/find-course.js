// find-course.js — 내 수강과목(submain_form)에서 '초격차...융합소재' 진입 경로 찾기
import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://localhost:9222');
const page = b.contexts()[0].pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr')) || b.contexts()[0].pages()[0];
await page.goto('https://ecampus.konkuk.ac.kr/ilos/st/course/submain_form.acl', { waitUntil: 'domcontentloaded' }).catch(()=>{});
await page.waitForTimeout(2500);
console.log('url:', page.url());

const info = await page.evaluate(() => {
  const hits = [];
  document.querySelectorAll('a,div,li,span,td,h3,h4,option,p').forEach((e) => {
    const t = (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ');
    if (/초격차|융합소재|5492/.test(t) && t.length < 100) {
      hits.push({ tag: e.tagName, text: t.slice(0, 80), onclick: e.getAttribute('onclick'), href: e.getAttribute('href') });
    }
  });
  // select 들도 덤프
  const selects = [...document.querySelectorAll('select')].map((s) => ({ id: s.id, name: s.name, onchange: s.getAttribute('onchange'), opts: [...s.options].map((o) => ({ t: o.text.trim().slice(0,50), v: o.value, sel: o.selected })) }));
  return { hits: hits.slice(0, 30), selects };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: '.state/submain.png' });
await b.close();
process.exit(0);
