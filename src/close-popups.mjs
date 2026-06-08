// close-popups.mjs — eCampus 공지 팝업들을 '더이상 열지 않음' 클릭 후 닫는다.
// 메인 작업 페이지(main/submain/online_list)는 건드리지 않는다.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));

const DONT_SHOW = /더\s*이상\s*열지\s*않음|다시\s*열지\s*않음|다시\s*보지\s*않기|오늘\s*하루|7일간\s*보지\s*않기|일주일간\s*보지\s*않기|체크시.*보이지|닫기/;
const MAIN = /main_form|submain_form|online_list_form|online_view_form/;

export async function closePopups(ctx, log = console.log) {
  let closed = 0;
  for (const p of [...ctx.pages()]) {
    const url = p.url();
    if (MAIN.test(url)) continue;            // 메인 작업 페이지 보호
    if (/mail\.google|accounts\.google/.test(url)) continue; // 메일/구글 보호
    let isPopup = /popup|notice|board|alert|layer|pop_/i.test(url);
    let clicked = false;
    try {
      clicked = await p.evaluate((reSrc) => {
        const re = new RegExp(reSrc);
        // 체크박스형 "오늘 그만보기" 먼저 체크
        const cb = [...document.querySelectorAll('input[type=checkbox]')].find((c) => re.test((c.parentElement?.innerText || '') + (c.nextSibling?.textContent || '')));
        if (cb) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
        // 버튼/링크 클릭
        const el = [...document.querySelectorAll('a,button,span,div,input,label')].find((e) => re.test((e.innerText || e.value || '').trim()) && (e.innerText || e.value || '').trim().length < 25);
        if (el) { el.click(); return true; }
        return false;
      }, DONT_SHOW.source);
    } catch {}
    if (clicked || isPopup) {
      await p.waitForTimeout(400).catch(() => {});
      try { if (!p.isClosed()) await p.close(); } catch {}
      closed++;
      log(`  팝업 닫음: ${url.slice(0, 60)}`);
    }
  }
  return closed;
}

// 단독 실행 시
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const b = await chromium.connectOverCDP(`http://localhost:${cfg.debugPort}`);
  const n = await closePopups(b.contexts()[0]);
  console.log(`닫은 팝업: ${n}개`);
  await b.close();
  process.exit(0);
}
