// login.js — 영구 프로필로 브라우저를 띄워 직접 로그인하고 세션을 저장한다.
// 첫 실행: 직접 로그인(ID/PW + Gmail 인증) → 세션이 .profile 폴더에 저장됨
// 이후: 저장된 세션 재사용 (인증 불필요)

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, '..', '.profile');
const LOGIN_URL = 'https://ecampus.konkuk.ac.kr/ilos/main/main_form.acl';

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: null, // 실제 창 크기 사용
  args: ['--start-maximized'],
});

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

console.log('\n========================================');
console.log('브라우저가 열렸습니다.');
console.log('1) 직접 로그인하세요 (ID/PW + 필요시 Gmail 인증).');
console.log('2) 로그인이 완료되어 메인/강의 목록이 보이면,');
console.log('   이 터미널에서 Enter 를 눌러 현재 상태를 점검합니다.');
console.log('========================================\n');

// 사용자가 로그인을 마칠 때까지 Enter 대기
await new Promise((resolve) => {
  process.stdin.resume();
  process.stdin.once('data', () => resolve());
});

// 현재 페이지 상태 진단 출력
const info = {
  url: page.url(),
  title: await page.title(),
};
console.log('\n[현재 페이지]', JSON.stringify(info, null, 2));

// 로그인 여부를 가늠할 만한 단서(로그아웃 링크 등) 탐색
const logoutLike = await page
  .getByText(/로그아웃|logout/i)
  .count()
  .catch(() => 0);
console.log('로그아웃 링크 추정 개수:', logoutLike, '(>0 이면 로그인 상태일 가능성 높음)');

console.log('\n세션은 .profile 폴더에 저장되었습니다. 브라우저는 30초 후 닫힙니다.');
console.log('(닫히기 전에 페이지를 둘러보셔도 됩니다.)');
await page.waitForTimeout(30000);

await ctx.close();
process.exit(0);
