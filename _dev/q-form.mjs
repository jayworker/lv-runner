import { chromium } from 'playwright';
const b=await chromium.connectOverCDP('http://localhost:9222');const ctx=b.contexts()[0];
let p=ctx.pages().find(x=>/lms\.kmooc\.kr/.test(x.url()))||ctx.pages()[0];
await p.goto('https://lms.kmooc.kr/mod/quiz/summary.php?attempt=10726310&cmid=2156156',{waitUntil:'domcontentloaded'}).catch(()=>{});
await new Promise(r=>setTimeout(r,1200));
const r=await p.evaluate(()=>{
 const f=document.querySelector('form[action*="processattempt"]');
 if(!f)return'no form';
 const fields=[...f.querySelectorAll('input,button')].map(i=>({name:i.name,type:i.type,value:(i.value||'').slice(0,40)}));
 return {action:f.action, fields};
});
console.log(JSON.stringify(r,null,1));
await b.close();process.exit(0);
