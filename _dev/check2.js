import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr'));

// 1) 출석종료 버튼의 클릭 가능한 조상 체인
for (const f of page.frames()) {
  const chain = await f.evaluate(() => {
    const title = [...document.querySelectorAll('div')].find((e) => (e.innerText||'').trim()==='출석(종료)' && e.children.length===0);
    if (!title) return null;
    const out = [];
    let el = title;
    for (let i=0;i<5 && el;i++){
      out.push({ tag: el.tagName, id: el.id||null, cls:(typeof el.className==='string'?el.className:'').slice(0,60), onclick: el.getAttribute && el.getAttribute('onclick') });
      el = el.parentElement;
    }
    return out;
  }).catch(()=>null);
  if (chain) { console.log('ATTEND BTN ANCESTORS @', f.url().slice(0,60)); console.log(JSON.stringify(chain,null,2)); break; }
}

await browser.close();
process.exit(0);
