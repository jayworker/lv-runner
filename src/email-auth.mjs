// email-auth.mjs — 2차 본인인증(이메일) 자동 처리 모듈.
// 이메일 인증 발송 → 브라우저 Gmail에서 4자리 코드(대화 최신 메시지) 읽기 → 타이핑 → confirmSecondaryAuth().
// 전제: Edge 프로필이 해당 Gmail에 로그인돼 있어야 함.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function emailAuth(ctx, log = console.log) {
  const page = ctx.pages().find((p) => p.url().includes('online_view_form'))
    || ctx.pages().find((p) => p.url().includes('ecampus'));
  if (!page) { log('eCampus 페이지 없음'); return false; }
  page.on('dialog', (d) => d.accept().catch(() => {}));

  // 1) 이메일 인증 발송 (선택 단계의 이메일 항목 클릭)
  const sent = await page.evaluate(() => {
    const el = [...document.querySelectorAll("[onclick*='startSecondaryAuth']")]
      .find((e) => /@/.test(e.getAttribute('onclick') || '') && e.offsetParent !== null);
    if (el) { el.click(); return true; }
    // 이미 stage2면 startSecondaryAuth로 재발송 시도
    try { /* eslint-disable no-undef */ const m = (document.body.innerHTML.match(/startSecondaryAuth\('([^']+@[^']+)'/) || [])[1]; if (m) { startSecondaryAuth(m, 2, m); return true; } } catch {}
    return false;
  });
  log(sent ? '  이메일 인증 발송' : '  발송 항목 못찾음(기존 코드 사용 시도)');
  await page.waitForTimeout(8000); // 메일 도착 대기

  // 2) Gmail에서 최신 코드 읽기 (대화 맨 아래 메시지)
  const g = await ctx.newPage();
  let code = null;
  try {
    await g.goto('https://mail.google.com/mail/u/0/#inbox', { waitUntil: 'domcontentloaded' });
    await g.waitForTimeout(3500);
    await g.evaluate(() => { const rows = [...document.querySelectorAll('tr.zA')]; const r = rows.find((x) => /인증번호|건국대|eCampus/i.test(x.innerText)) || rows[0]; if (r) r.click(); });
    await g.waitForTimeout(3000);
    code = await g.evaluate(() => {
      const msgs = [...document.querySelectorAll('div.a3s')];
      const body = msgs.length ? msgs[msgs.length - 1].innerText : document.body.innerText;
      const near = body.match(/인증\s*번호[^0-9]{0,20}(\d{4})/);
      if (near) return near[1];
      const all = [...body.matchAll(/(?<!\d)(\d{4})(?!\d)/g)].map((m) => m[1]);
      return all.length ? all[all.length - 1] : null;
    });
  } catch (e) { log('  Gmail 읽기 오류: ' + String(e).slice(0, 60)); }
  await g.close().catch(() => {});
  log('  읽은 코드: ' + code);
  if (!code) return false;

  // 3) 코드 타이핑
  await page.bringToFront().catch(() => {});
  for (let i = 1; i <= 4; i++) { try { await page.fill('#secondary_auth_confirm_input_auth_code_word_' + i, ''); } catch {} }
  await page.click('#secondary_auth_confirm_input_auth_code_word_1').catch(() => {});
  for (const ch of code) { await page.keyboard.type(ch); await page.waitForTimeout(150); }
  await page.waitForTimeout(400);

  // 4) confirmSecondaryAuth() 직접 호출 (btnConfirmSecondaryAuth id 중복 회피)
  await page.evaluate(() => { try { confirmSecondaryAuth(); } catch {} });
  await page.waitForTimeout(4500);

  const okDone = await page.evaluate(() => { const d = document.getElementById('dialog_secondary_auth'); return !d || d.offsetParent === null; });
  log(okDone ? '  ✅ 2차 인증 완료' : '  ⚠️ 인증 미완(코드 오류/만료 가능)');
  return okDone;
}

// 단독 실행
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
  const b = await chromium.connectOverCDP(`http://localhost:${cfg.debugPort}`);
  const ok = await emailAuth(b.contexts()[0]);
  await b.close();
  process.exit(ok ? 0 : 2);
}
