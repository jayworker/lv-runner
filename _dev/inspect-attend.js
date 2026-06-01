// inspect-attend.js — 플레이어 바깥 프레임의 '출석(종료)' 버튼 실제 요소 구조를 덤프
import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('online_view_form'))
  || ctx.pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr'));
if (!page) { console.log('no player page; url list:'); ctx.pages().forEach(p=>console.log(' ',p.url())); await browser.close(); process.exit(1); }

for (const f of page.frames()) {
  const found = await f.evaluate(() => {
    const out = [];
    document.querySelectorAll('a,button,span,div,input,li').forEach((e) => {
      const t = (e.innerText || e.value || '').trim();
      // 정확히 '출석(종료)' 만 (자식 적은 leaf 요소)
      if (/출석\(?종료\)?/.test(t) && t.length < 12 && e.children.length === 0) {
        out.push({ tag: e.tagName, id: e.id || null, cls: (typeof e.className==='string'?e.className:'').slice(0,50), onclick: e.getAttribute('onclick'), href: e.getAttribute('href'), text: t });
      }
    });
    return out;
  }).catch(() => []);
  if (found.length) {
    console.log('FRAME', f.url().slice(0, 70));
    console.log(JSON.stringify(found, null, 2));
  }
}
await browser.close();
process.exit(0);
