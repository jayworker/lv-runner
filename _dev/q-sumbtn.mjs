import { chromium } from 'playwright';
const b=await chromium.connectOverCDP('http://localhost:9222');const ctx=b.contexts()[0];
let p=ctx.pages().find(x=>/lms\.kmooc\.kr/.test(x.url()))||ctx.pages()[0];
await p.goto('https://lms.kmooc.kr/mod/quiz/summary.php?attempt=10726310&cmid=2156156',{waitUntil:'domcontentloaded'}).catch(()=>{});
await new Promise(r=>setTimeout(r,1500));
const r=await p.evaluate(()=>{
 const norm=s=>(s||'').replace(/\s+/g,' ').trim();
 const forms=[...document.querySelectorAll('form')].map(f=>({action:f.action,method:f.method,btns:[...f.querySelectorAll('button,input[type=submit]')].map(x=>norm(x.value||x.innerText))}));
 const links=[...document.querySelectorAll('a')].map(a=>({t:norm(a.innerText),href:a.href})).filter(x=>/제출|마침|종료/.test(x.t));
 return {forms,links};
});
console.log(JSON.stringify(r,null,1));
await b.close();process.exit(0);
