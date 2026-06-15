// q-answer.mjs <attempt> <cmid> <keyfile> — 질문/정답 텍스트 매칭으로 답 선택 후 제출(순서 섞여도 OK).
import { chromium } from 'playwright';
import fs from 'fs';
const ATT=process.argv[2],CMID=process.argv[3],KEY=process.argv[4];
const keys=JSON.parse(fs.readFileSync(KEY,'utf8')); // [[qsub,asub],...]
const b=await chromium.connectOverCDP('http://localhost:9222');const ctx=b.contexts()[0];
let p=ctx.pages().find(x=>/lms\.kmooc\.kr/.test(x.url()))||ctx.pages()[0];
p.on('dialog',async d=>{try{await d.accept();}catch{}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>(s||'').replace(/\s+/g,' ').trim();
await p.goto(`https://lms.kmooc.kr/mod/quiz/attempt.php?attempt=${ATT}&cmid=${CMID}&page=0`,{waitUntil:'domcontentloaded'}).catch(()=>{});
await sleep(900);
let pageNo=0, miss=0;
while(true){
 const info=await p.evaluate(()=>{const norm=s=>(s||'').replace(/\s+/g,' ').trim();const q=document.querySelector('.que');if(!q)return null;
  const qtext=norm((q.querySelector('.qtext')||{}).innerText);
  const opts=[...q.querySelectorAll('.answer > div,.answer .r0,.answer .r1')].map(o=>{const i=o.querySelector('input');return{label:norm(o.innerText),val:i?i.value:'',name:i?i.name:''};}).filter(o=>o.name);
  return {qtext,opts};});
 if(!info){console.log('page',pageNo,'no que');break;}
 const key=keys.find(k=>info.qtext.includes(k[0]));
 if(!key){console.log(`p${pageNo} ⚠ 질문매칭실패: ${info.qtext.slice(0,40)}`);miss++;}
 else{
  const opt=info.opts.find(o=>o.label.includes(key[1]));
  if(!opt){console.log(`p${pageNo} ⚠ 보기매칭실패 [${key[1]}] in ${JSON.stringify(info.opts.map(o=>o.label.slice(0,20)))}`);miss++;}
  else{await p.evaluate(v=>{const q=document.querySelector('.que');const i=[...q.querySelectorAll('input[type=radio]')].find(x=>x.value===v);if(i){i.checked=true;i.click();i.dispatchEvent(new Event('change',{bubbles:true}));}},opt.val);
   console.log(`p${pageNo} ✓ ${key[0].slice(0,16)} → ${key[1].slice(0,22)} (val=${opt.val})`);}
 }
 const moved=await p.evaluate(()=>{const n=document.querySelector('input[name="next"],button[name="next"]');if(n){n.click();return true;}return false;});
 if(!moved){console.log('마지막 페이지');break;}
 await sleep(1500);
 if(/summary\.php/.test(p.url()))break;
 pageNo++;
}
console.log('미스:',miss);
if(!/summary\.php/.test(p.url())){await p.goto(`https://lms.kmooc.kr/mod/quiz/summary.php?attempt=${ATT}&cmid=${CMID}`,{waitUntil:'domcontentloaded'}).catch(()=>{});await sleep(1000);}
await p.evaluate(()=>{const f=document.querySelector('form[action*="processattempt"]');if(f)f.submit();});
await sleep(3500);
const g=await p.evaluate(()=>{const norm=s=>(s||'').replace(/\s+/g,' ').trim();return norm((document.querySelector('.quizreviewsummary,table.generaltable')||{}).innerText||'').slice(0,200);});
console.log('RESULT:',g);
await b.close();process.exit(0);
