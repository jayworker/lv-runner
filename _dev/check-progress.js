// check-progress.js — 강의 목록(진도율) 페이지로 돌아가 진도를 확인한다.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', '.state');
fs.mkdirSync(STATE_DIR, { recursive: true });

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr'));
if (!page) { console.log('no ecampus page'); await browser.close(); process.exit(1); }

await page.bringToFront().catch(() => {});
console.log('before back:', page.url());
await page.goBack({ waitUntil: 'domcontentloaded' }).catch((e) => console.log('goBack err', String(e).slice(0,120)));
await page.waitForTimeout(2500);
console.log('after back :', page.url());

// 진도/퍼센트가 보이는 텍스트를 모든 프레임에서 수집
const dump = { time: new Date().toISOString(), url: page.url(), frames: [] };
for (const f of page.frames()) {
  let texts = [];
  try {
    texts = await f.$$eval('td,th,li,span,div,a,strong,em,b', (els) =>
      els.map((e) => e.innerText.trim().replace(/\s+/g, ' ')).filter((t) => t && t.length < 80)
    );
    texts = [...new Set(texts)];
  } catch {}
  dump.frames.push({ url: f.url(), texts: texts.slice(0, 300) });
}
fs.writeFileSync(path.join(STATE_DIR, 'progress.json'), JSON.stringify(dump, null, 2));
await page.screenshot({ path: path.join(STATE_DIR, 'progress.png'), fullPage: true }).catch(() => {});
console.log('saved progress.json + progress.png');
await browser.close();
process.exit(0);
