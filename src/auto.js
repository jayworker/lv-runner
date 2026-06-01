// auto.js — 모든(또는 지정 주차) 강의 파트를 순서대로 1배속 완주 + 출석(종료).
// 사용:
//   node src/auto.js all            # report.json의 모든 파트
//   node src/auto.js 6,11,12,13     # 특정 주차만
//   node src/auto.js all 1          # 배속 지정(기본 1)
// 진행상황은 .state/auto-progress.json 에 저장되어 재실행 시 이어서 진행.

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', '.state');
const REPORT = path.join(STATE_DIR, 'report.json');
const PROGRESS = path.join(STATE_DIR, 'auto-progress.json');
fs.mkdirSync(STATE_DIR, { recursive: true });

const weekArg = process.argv[2] || 'all';
const speed = Number(process.argv[3] || 1);

const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
// 주차 순서: weekArg에 적힌 순서대로(예 "13,12,11,6"), 'all'이면 report 순서
const orderedWeeks = weekArg === 'all' ? report.weeks.map((w) => w.week) : weekArg.split(',').map(Number);
let targets = [];
let skippedComplete = 0;
for (const wn of orderedWeeks) {
  const w = report.weeks.find((x) => x.week === wn);
  if (!w) continue;
  for (const p of w.parts) {
    if ((p.percent || 0) >= 100) { skippedComplete++; continue; } // 이미 100% 완료 → 스킵
    targets.push({ week: w.week, item_id: p.item_id, name: p.name, required: p.required });
  }
}

let progress = { done: [], log: [] };
if (fs.existsSync(PROGRESS)) { try { progress = JSON.parse(fs.readFileSync(PROGRESS, 'utf8')); } catch {} }
const doneSet = new Set(progress.done);

function saveProgress() { fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2)); }
function logEvent(e) { progress.log.push({ t: new Date().toISOString(), ...e }); saveProgress(); console.log(JSON.stringify(e)); }

const browser = await chromium.connectOverCDP('http://localhost:9222');
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes('ecampus.konkuk.ac.kr')) || (await ctx.newPage());
await page.bringToFront().catch(() => {});
// confirm/alert 자동 수락
page.on('dialog', (d) => d.accept().catch(() => {}));

function videoFrame() {
  return page.frames().find((f) => f.url().includes('online_view.acl')) || page.frames().find((f) => f.url().includes('.mp4'));
}
async function readState() {
  const f = videoFrame();
  if (!f) return { error: 'no video frame' };
  return await f.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return { error: 'no video' };
    return { currentTime: Math.round(v.currentTime), duration: Math.round(v.duration), paused: v.paused, ended: v.ended, rate: v.playbackRate };
  }).catch((e) => ({ error: String(e).slice(0, 80) }));
}
async function authVisible() {
  return await page.evaluate(() => [...document.querySelectorAll('*')]
    .some((el) => /2차 본인인증|인증번호.*입력/.test(el.textContent || '') && el.offsetParent !== null)).catch(() => false);
}

async function openPart(t) {
  await page.goto(`https://ecampus.konkuk.ac.kr/ilos/st/course/online_list_form.acl?WEEK_NO=${t.week}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const oc = await page.evaluate((id) => {
    const el = [...document.querySelectorAll('[onclick*="viewGo"]')].find((e) => (e.getAttribute('onclick') || '').includes(id) && (e.innerText || '').trim());
    if (el) { el.click(); return el.getAttribute('onclick'); }
    return null;
  }, t.item_id);
  await page.waitForTimeout(4000);
  return oc;
}

async function playToEnd(t) {
  const vf = videoFrame();
  if (!vf) return { ok: false, reason: 'no_video_frame' };
  await vf.evaluate((spd) => { const v = document.querySelector('video'); if (v) { v.muted = true; v.playbackRate = spd; const p = v.play(); if (p && p.catch) p.catch(() => {}); } }, speed);
  let last = -1, stall = 0;
  for (;;) {
    await page.waitForTimeout(15000);
    const s = await readState();
    if (s.error) return { ok: false, reason: s.error };
    const pct = s.duration ? ((s.currentTime / s.duration) * 100).toFixed(1) : '?';
    fs.writeFileSync(path.join(STATE_DIR, 'auto-current.json'), JSON.stringify({ ...t, ...s, pct, time: new Date().toISOString() }, null, 2));
    console.log(`  [${t.week}주 ${t.name}] ${s.currentTime}/${s.duration} (${pct}%) paused=${s.paused} ended=${s.ended}`);
    if (s.rate !== speed) await vf.evaluate((spd) => { const v = document.querySelector('video'); if (v) v.playbackRate = spd; }, speed);
    if (s.ended || (s.duration && s.currentTime >= s.duration - 2)) return { ok: true };
    if (s.currentTime <= last) { // 진행 없음
      stall++;
      // 버퍼 막힘 뚫기: 재생 위치를 살짝 앞으로 밀고 다시 재생
      await vf.evaluate(() => {
        const v = document.querySelector('video');
        if (!v) return;
        try { v.currentTime = Math.min((v.duration || 1e9), v.currentTime + 3); } catch {}
        v.muted = true;
        v.play().catch(() => {});
      });
      if (stall >= 16) return { ok: false, reason: 'stalled' }; // 약 4분 정지면 포기
    } else stall = 0;
    last = s.currentTime;
  }
}

async function clickAttend() {
  // '출석(종료)' = DIV#close_ (inline onclick 없이 JS 바인딩). getElementById로 정확히 클릭.
  for (const f of page.frames()) {
    const r = await f.evaluate(() => {
      const el = document.getElementById('close_');
      if (el) { el.click(); return true; }
      return false;
    }).catch(() => false);
    if (r) return true;
  }
  return false;
}

logEvent({ event: 'START', totalTargets: targets.length, skippedComplete, alreadyDone: doneSet.size, order: orderedWeeks, speed });

for (const t of targets) {
  if (doneSet.has(t.item_id)) { console.log(`skip done: ${t.week}주 ${t.name}`); continue; }
  logEvent({ event: 'OPEN', week: t.week, name: t.name, item_id: t.item_id });
  await openPart(t);

  if (await authVisible()) {
    await page.screenshot({ path: path.join(STATE_DIR, 'auto-NEED-AUTH.png') }).catch(() => {});
    logEvent({ event: 'NEED_AUTH', week: t.week, name: t.name });
    console.log('\n*** 2차 본인인증이 필요합니다. 중단합니다. 인증 후 다시 실행하세요. ***');
    break;
  }
  if (!videoFrame()) {
    logEvent({ event: 'NO_VIDEO', week: t.week, name: t.name });
    continue;
  }

  const res = await playToEnd(t);
  if (!res.ok) {
    logEvent({ event: 'PLAY_FAIL', week: t.week, name: t.name, reason: res.reason });
    if (res.reason === 'stalled') continue; // 다음 파트로
    continue;
  }
  const attended = await clickAttend();
  await page.waitForTimeout(3000);
  progress.done.push(t.item_id); doneSet.add(t.item_id);
  logEvent({ event: 'DONE', week: t.week, name: t.name, attended });
}

logEvent({ event: 'ALL_FINISHED', done: progress.done.length, total: targets.length });
await browser.close();
process.exit(0);
