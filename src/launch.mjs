// launch.mjs — Edge(없으면 Chrome)를 원격 디버깅 포트로 띄운다.
// 이 창에서 직접 eCampus 로그인(+구글/2차 인증)하면, 이후 자동화 스크립트가 CDP로 연결한다.
// 자동화 도구가 띄운 브라우저가 아니라 "진짜 브라우저"여야 구글 로그인이 차단되지 않는다.
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const profileDir = path.resolve(ROOT, cfg.profileDir);

const candidates = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const browser = candidates.find((p) => fs.existsSync(p));
if (!browser) {
  console.error('Edge/Chrome 실행파일을 찾지 못했습니다. 환경변수 EDGE_PATH로 경로를 지정하세요.');
  process.exit(1);
}

const args = [
  `--remote-debugging-port=${cfg.debugPort}`,
  '--remote-allow-origins=*',
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  cfg.loginUrl,
];

console.log('브라우저 실행:', browser);
console.log('디버깅 포트:', cfg.debugPort, '| 프로필:', profileDir);
const child = spawn(browser, args, { detached: true, stdio: 'ignore' });
child.unref();

console.log('\n브라우저가 열렸습니다. 이 창에서 직접 로그인하세요 (ID/PW + 필요시 구글/2차 인증).');
console.log('로그인 후 다음을 실행: npm run enumerate  →  npm run auto -- <주차들>');
setTimeout(() => process.exit(0), 1500);
