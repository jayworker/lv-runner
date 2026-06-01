// explore.js — 화면이 보이는 영구-프로필 브라우저를 띄워두고,
// 주기적으로 스크린샷/상태를 파일로 남긴다. 제어는 .control 파일로 한다.
//
//   .control 내용:
//     (없음/빈값) -> 계속 대기 (사용자가 직접 로그인)
//     "inspect"   -> 현재 페이지 구조를 inspect.json 으로 덤프
//     "quit"      -> 세션 저장 후 정상 종료
//
// 상태 파일: .state/status.json, .state/last.png

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PROFILE_DIR = path.join(ROOT, '.profile');
const STATE_DIR = path.join(ROOT, '.state');
const CONTROL = path.join(ROOT, '.control');
const LOGIN_URL = 'https://ecampus.konkuk.ac.kr/ilos/main/main_form.acl';

fs.mkdirSync(STATE_DIR, { recursive: true });

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: null,
  args: ['--start-maximized'],
});

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});

function readControl() {
  try {
    return fs.readFileSync(CONTROL, 'utf8').trim();
  } catch {
    return '';
  }
}
function clearControl() {
  try { fs.writeFileSync(CONTROL, ''); } catch {}
}

async function dumpStatus() {
  try {
    const status = {
      time: new Date().toISOString(),
      url: page.url(),
      title: await page.title().catch(() => ''),
      frames: page.frames().map((f) => f.url()),
    };
    fs.writeFileSync(path.join(STATE_DIR, 'status.json'), JSON.stringify(status, null, 2));
    await page.screenshot({ path: path.join(STATE_DIR, 'last.png'), fullPage: false }).catch(() => {});
  } catch {}
}

async function inspect() {
  const out = { time: new Date().toISOString(), url: page.url(), frames: [] };
  for (const f of page.frames()) {
    const frameInfo = { url: f.url(), links: [], headings: [] };
    try {
      frameInfo.links = await f.$$eval('a', (as) =>
        as
          .map((a) => ({ text: a.innerText.trim().replace(/\s+/g, ' '), href: a.href, onclick: a.getAttribute('onclick') }))
          .filter((x) => x.text || x.onclick)
          .slice(0, 200)
      );
      frameInfo.headings = await f.$$eval('h1,h2,h3,td,th,li', (els) =>
        els.map((e) => e.innerText.trim().replace(/\s+/g, ' ')).filter((t) => t && t.length < 80).slice(0, 200)
      );
    } catch {}
    out.frames.push(frameInfo);
  }
  fs.writeFileSync(path.join(STATE_DIR, 'inspect.json'), JSON.stringify(out, null, 2));
  await page.screenshot({ path: path.join(STATE_DIR, 'inspect.png'), fullPage: true }).catch(() => {});
  console.log('[inspect] saved', out.url);
}

console.log('[explore] browser open. waiting for manual login...');
const start = Date.now();
const MAX_MS = 30 * 60 * 1000; // 30분

while (Date.now() - start < MAX_MS) {
  await page.waitForTimeout(2500);
  await dumpStatus();
  const cmd = readControl();
  if (cmd === 'quit') {
    console.log('[explore] quit signal -> closing');
    break;
  }
  if (cmd === 'inspect') {
    await inspect();
    clearControl();
  }
}

await ctx.close();
console.log('[explore] closed, session saved to .profile');
process.exit(0);
