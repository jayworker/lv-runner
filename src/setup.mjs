// setup.mjs — 필요 프로그램 점검 및 설치 (npm 의존성 + 브라우저)
import { execSync } from 'child_process';
import fs from 'fs';

const log = (m) => console.log(m);
const ok = (m) => console.log('  ✅', m);
const warn = (m) => console.log('  ⚠️ ', m);

function run(cmd, opts = {}) {
  try { execSync(cmd, { stdio: 'inherit', ...opts }); return true; }
  catch { return false; }
}
function has(cmd) {
  try { execSync(process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' }); return true; }
  catch { return false; }
}

log('\n[1/3] Node.js 확인');
const major = Number(process.versions.node.split('.')[0]);
if (major >= 18) ok(`Node ${process.version}`);
else warn(`Node ${process.version} — 18+ 권장. 설치: winget install OpenJS.NodeJS.LTS`);

log('\n[2/3] 의존성 설치 (npm install)');
if (run('npm install')) ok('npm 패키지 설치 완료 (Playwright 포함)');
else warn('npm install 실패 — 네트워크/권한 확인');

log('\n[3/3] 브라우저(Edge/Chrome) 확인');
const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
if (browsers.some((p) => fs.existsSync(p))) {
  ok('Edge/Chrome 발견');
} else if (process.platform === 'win32' && has('winget')) {
  warn('브라우저 없음 → winget으로 Edge 설치 시도');
  if (run('winget install --id Microsoft.Edge -e --silent --accept-source-agreements --accept-package-agreements')) ok('Edge 설치 완료');
  else warn('자동 설치 실패 — 수동 설치: winget install Microsoft.Edge');
} else {
  warn('Edge/Chrome 미발견. 설치: winget install Microsoft.Edge (Win) / 직접 설치 (Mac)');
}

log('\n완료! 다음 단계:\n  npm run launch   (브라우저 열고 직접 로그인)\n  npm run auto -- 13   (주차 지정 실행)\n');
