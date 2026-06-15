// q-do.mjs <attempt> <cmid> <answers> — 페이지별 답 입력(name=next 저장) 후 form.submit로 최종 제출.
import { chromium } from 'playwright';
const ATT=process.argv[2],CMID=process.argv[3];
const ANS=(process.argv[4]||'').split(',').map(s=>s.trim());
const b=await chromium.connectOverCDP('http://localhost:9222');const ctx=b.contexts()[0];
let p=ctx.pages().find(x=>/lms\.kmooc\.kr/.test(x.url()))||ctx.pages()[0];
p.on('dialog',async d=>{try{await d.accept();}catch{}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto(`https://lms.kmooc.kr/mod/quiz/attempt.php?attempt=${ATT}&cmid=${CMID}&page=0`,{waitUntil:'domcontentloaded'}).catch(()=>{});
await sleep(900);
for(let pg=0;pg<ANS.length;pg++){
 const a=ANS[pg];
 const res=await p.evaluate(ans=>{const q=document.querySelector('.que');if(!q)return'no-que';
  if(ans.startsWith('T:')){const t=q.querySelector('input[type=text],textarea');if(t){t.value=ans.slice(2);t.dispatchEvent(new Event('change',{bubbles:true}));return'text-set';}return'no-text';}
  const inp=[...q.querySelectorAll('input[type=radio],input[type=checkbox]')].find(i=>i.value===ans);
  if(inp){inp.checked=true;inp.click();inp.dispatchEvent(new Event('change',{bubbles:true}));return'picked '+ans;}return'no-match '+ans;},a);
 console.log(`page ${pg}: ${res}`);
 await p.evaluate(()=>{const n=document.querySelector('input[name="next"],button[name="next"]');if(n)n.click();});
 await sleep(1900);
 if(/summary\.php/.test(p.url())){console.log('  → 요약 도달');break;}
}
if(!/summary\.php/.test(p.url())){await p.goto(`https://lms.kmooc.kr/mod/quiz/summary.php?attempt=${ATT}&cmid=${CMID}`,{waitUntil:'domcontentloaded'}).catch(()=>{});await sleep(1000);}
const sum=await p.evaluate(()=>{const norm=s=>(s||'').replace(/\s+/g,' ').trim();return [...document.querySelectorAll('table.quizsummaryofattempt tr')].map(r=>norm(r.innerText)).filter(Boolean);});
console.log('SUMMARY:',JSON.stringify(sum));
// 최종 제출: 폼 직접 submit
await p.evaluate(()=>{const f=document.querySelector('form[action*="processattempt"]');if(f)f.submit();});
await sleep(3500);
console.log('AFTER URL:',p.url());
const r=await p.evaluate(()=>{const norm=s=>(s||'').replace(/\s+/g,' ').trim();
 const g=norm((document.querySelector('.quizreviewsummary,.grade,table.generaltable')||{}).innerText||'');
 const st=[...document.querySelectorAll('.que .state')].map(e=>norm(e.innerText));
 return{grade:g.slice(0,260),states:st};});
console.log('RESULT:',JSON.stringify(r,null,1));
await p.screenshot({path:`C:/computeruse/.state/quiz-review-${CMID}.png`,fullPage:true}).catch(()=>{});
await b.close();process.exit(0);
