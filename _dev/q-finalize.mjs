import { chromium } from 'playwright';
const ATT=process.argv[2], CMID=process.argv[3];
const b=await chromium.connectOverCDP('http://localhost:9222');const ctx=b.contexts()[0];
let p=ctx.pages().find(x=>/lms\.kmooc\.kr/.test(x.url()))||ctx.pages()[0];
p.on('dialog',async d=>{try{await d.accept();}catch{}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto(`https://lms.kmooc.kr/mod/quiz/summary.php?attempt=${ATT}&cmid=${CMID}`,{waitUntil:'domcontentloaded'}).catch(()=>{});
await sleep(1200);
// 1) '제출 및 종료' 폼 버튼 클릭 → 모달 트리거
await p.evaluate(()=>{const f=document.querySelector('form[action*="processattempt"]');const btn=f&&f.querySelector('button,input[type=submit]');if(btn)btn.click();});
await sleep(1500);
// 모달 내용/버튼 확인
const modal=await p.evaluate(()=>{const norm=s=>(s||'').replace(/\s+/g,' ').trim();
 const m=document.querySelector('.modal.show, .moodle-dialogue, [data-region="modal-container"], .modal');
 const btns=[...document.querySelectorAll('.modal-footer button, .modal-footer input[type=submit], .moodle-dialogue-ft button, [data-action="save"], .modal button')].map(x=>norm(x.value||x.innerText)).filter(Boolean);
 return {present:!!m, text:m?norm(m.innerText).slice(0,160):'', btns:[...new Set(btns)]};
});
console.log('MODAL:',JSON.stringify(modal));
// 2) 모달의 확정 버튼 클릭
await p.evaluate(()=>{const btn=[...document.querySelectorAll('.modal-footer button,.modal-footer input[type=submit],.moodle-dialogue-ft button,.modal button,button,input[type=submit]')].find(x=>/제출 및 종료|제출하고 마침|확인|예/.test(x.value||x.innerText) && !/취소|돌아/.test(x.value||x.innerText));if(btn)btn.click();});
await sleep(3000);
console.log('AFTER URL:',p.url());
const res=await p.evaluate(()=>{const norm=s=>(s||'').replace(/\s+/g,' ').trim();
 return [...document.querySelectorAll('.generaltable tr,.quizreviewsummary tr,.grade,.feedbacktext')].map(e=>norm(e.innerText)).filter(t=>t&&t.length<90).slice(0,18);});
console.log('RESULT:',JSON.stringify(res));
await p.screenshot({path:`C:/computeruse/.state/quiz-final-${CMID}.png`,fullPage:true}).catch(()=>{});
await b.close();process.exit(0);
