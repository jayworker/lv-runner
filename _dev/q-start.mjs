// q-start.mjs <cmid> — 응시 시작/이어서 + 전 페이지 문항 추출 + attempt/페이지수 출력
import { chromium } from 'playwright';
import fs from 'fs';
const CMID=process.argv[2];
const b=await chromium.connectOverCDP('http://localhost:9222');const ctx=b.contexts()[0];
let p=ctx.pages().find(x=>/lms\.kmooc\.kr/.test(x.url()))||ctx.pages()[0];
p.on('dialog',async d=>{try{await d.accept();}catch{}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto(`https://lms.kmooc.kr/mod/quiz/view.php?id=${CMID}`,{waitUntil:'domcontentloaded'}).catch(()=>{});
await sleep(1200);
await p.evaluate(()=>{const x=[...document.querySelectorAll('button,input[type=submit],a')].find(e=>/응시/.test(e.innerText||e.value));x&&x.click();});
await sleep(2500);
await p.evaluate(()=>{const x=[...document.querySelectorAll('button,input[type=submit]')].find(e=>/응시 시작|시작/.test(e.innerText||e.value));x&&x.click();});
await sleep(2000);
const url=p.url();
const att=(url.match(/attempt=(\d+)/)||[])[1];
// 페이지수: nav 버튼 dedup
const npages=await p.evaluate(()=>{const hrefs=[...document.querySelectorAll('.qnbutton')].map(b=>b.getAttribute('href')||'this');const pset=new Set();hrefs.forEach(h=>{const m=h.match(/page=(\d+)/);pset.add(m?m[1]:'0');});return pset.size;});
console.log('ATTEMPT:',att,'| CMID:',CMID,'| URL:',url,'| pages:',npages);
const out=[];
for(let pg=0;pg<npages;pg++){
 await p.goto(`https://lms.kmooc.kr/mod/quiz/attempt.php?attempt=${att}&cmid=${CMID}&page=${pg}`,{waitUntil:'domcontentloaded'}).catch(()=>{});
 await sleep(900);
 const q=await p.evaluate(()=>{const norm=s=>(s||'').replace(/\s+/g,' ').trim();const el=document.querySelector('.que');if(!el)return null;
  const type=(el.className.match(/que (\w+)/)||[])[1]||'';
  const qtext=norm((el.querySelector('.qtext')||{}).innerText);
  const options=[...el.querySelectorAll('.answer > div,.answer .r0,.answer .r1')].map(o=>{const i=o.querySelector('input');return{label:norm(o.innerText),value:i?i.value:'',name:i?i.name:'',itype:i?i.type:''};}).filter(o=>o.label&&o.name);
  const t=el.querySelector('input[type=text],textarea');
  return{type,qtext,options,textName:t?t.name:''};});
 if(q){q.page=pg;out.push(q);}
}
fs.writeFileSync(`C:/computeruse/.state/quiz-q-${CMID}.json`,JSON.stringify({attempt:att,cmid:CMID,npages,questions:out},null,2));
out.forEach(q=>{console.log(`\n[page ${q.page}] (${q.type}) ${q.qtext}`);q.options.forEach((o,j)=>console.log(`   ${String.fromCharCode(97+j)}) ${o.label}  {val=${o.value}}`));if(q.textName)console.log(`   [단답 ${q.textName}]`);});
await b.close();process.exit(0);
