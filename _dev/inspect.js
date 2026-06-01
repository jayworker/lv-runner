// inspect.js — 이미 떠 있는(수동 로그인된) Edge 에 CDP로 연결해 현재 상태를 분석한다.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', '.state');
fs.mkdirSync(STATE_DIR, { recursive: true });

const browser = await chromium.connectOverCDP('http://localhost:9222');
const contexts = browser.contexts();
const ctx = contexts[0];
const pages = ctx.pages();

console.log('contexts:', contexts.length, 'pages:', pages.length);
pages.forEach((p, i) => console.log(`  [page ${i}] ${p.url()}`));

// 가장 최근(보통 마지막) 페이지를 대상으로
const page = pages[pages.length - 1];
await page.bringToFront().catch(() => {});

const out = { time: new Date().toISOString(), url: page.url(), title: await page.title().catch(() => ''), frames: [] };
for (const f of page.frames()) {
  const fi = { url: f.url(), links: [], texts: [] };
  try {
    fi.links = await f.$$eval('a', (as) =>
      as.map((a) => ({
        text: a.innerText.trim().replace(/\s+/g, ' '),
        href: a.href,
        onclick: a.getAttribute('onclick'),
      })).filter((x) => x.text || x.onclick).slice(0, 300)
    );
    fi.texts = await f.$$eval('td,th,li,span,div,h1,h2,h3', (els) =>
      els.map((e) => e.innerText.trim().replace(/\s+/g, ' ')).filter((t) => t && t.length < 60)
    );
    // 중복 제거 + 상위 일부
    fi.texts = [...new Set(fi.texts)].slice(0, 250);
  } catch (e) {
    fi.error = String(e).slice(0, 200);
  }
  out.frames.push(fi);
}

fs.writeFileSync(path.join(STATE_DIR, 'inspect.json'), JSON.stringify(out, null, 2));
await page.screenshot({ path: path.join(STATE_DIR, 'inspect.png'), fullPage: true }).catch(() => {});
console.log('saved inspect.json + inspect.png. url=', out.url);

await browser.close(); // CDP 연결만 끊음 (브라우저 자체는 닫히지 않음)
process.exit(0);
