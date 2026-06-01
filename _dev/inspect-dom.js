// inspect-dom.js — 목록 페이지의 클릭 가능한 요소(onclick), 학습하기/주차/파트, 인증 모달 상태를 덤프
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', '.state');
fs.mkdirSync(STATE_DIR, { recursive: true });

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('online_list_form'))
  || ctx.pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr'));
if (!page) { console.log('no list page'); await browser.close(); process.exit(1); }

const f = page.mainFrame();

const result = await f.evaluate(() => {
  const pick = (el) => ({
    tag: el.tagName,
    id: el.id || null,
    cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : null,
    onclick: el.getAttribute('onclick'),
    href: el.getAttribute('href'),
    text: (el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 60),
  });

  // onclick 또는 href=javascript 가 있는 요소
  const clickables = [...document.querySelectorAll('a,button,[onclick],input[type=button],input[type=image],img[onclick]')]
    .map(pick)
    .filter((x) => x.onclick || (x.href && x.href.includes('javascript')) || /학습하기|출석|다음|이전|주차|part|차시/i.test(x.text));

  // 주차 탭(2주~13주) 요소 추정
  const weekEls = [...document.querySelectorAll('a,li,div,span')]
    .filter((el) => /^\d+주$/.test((el.innerText || '').trim()))
    .map((el) => ({ text: el.innerText.trim(), onclick: el.getAttribute('onclick'), href: el.getAttribute('href'), id: el.id, parentOnclick: el.parentElement?.getAttribute('onclick') }));

  // 인증 모달 표시 여부
  const authModal = [...document.querySelectorAll('*')]
    .filter((el) => /2차 본인인증/.test(el.textContent || '') && el.children.length < 30)
    .slice(0, 1)
    .map((el) => {
      const style = getComputedStyle(el);
      return { display: style.display, visibility: style.visibility, id: el.id, cls: typeof el.className === 'string' ? el.className : null };
    });

  // 학습하기 버튼
  const study = [...document.querySelectorAll('*')]
    .filter((el) => /학습하기/.test((el.innerText || '').trim()) && (el.innerText || '').trim().length < 12)
    .map(pick);

  return { clickables: clickables.slice(0, 80), weekEls, authModal, study };
});

fs.writeFileSync(path.join(STATE_DIR, 'dom.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(0);
