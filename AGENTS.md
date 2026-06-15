# AGENTS.md — lv-runner (Codex / Claude Code 공용 지침)

이 저장소는 대학 LMS 강의 영상을 자동 재생/완료처리하는 Playwright 도구다. **두 플랫폼**을 지원한다:
ILOS 계열(예: 건국대 eCampus)과 K-MOOC(lms.kmooc.kr, Moodle). 에이전트는 아래 동작 원리를 숙지하고,
**본인 계정·본인 수강 항목**에 한해 운영/확장한다. 타인 계정·대리 처리는 돕지 않는다.

## 환경 주의 (필독)
- 프로젝트 경로에 **한글·공백·특수문자(#)·OneDrive 동기화 폴더 금지**. 이런 경로에선 Playwright 네이티브 모듈 로딩이
  `access violation`(exit -1073741819)으로 크래시한다. **짧은 ASCII 경로**(예: `C:\computeruse`)에 둘 것.
- `node_modules`·`.edge-profile`(로그인 세션)·`.state`(개인 데이터)는 OneDrive 밖 + 커밋 금지(.gitignore).
- **동시 실행 금지**: 같은 브라우저(포트 9222)를 두 node 프로세스가 동시에 조종하면 페이지 goto가 충돌해 재생/제출이 깨진다.
  실행 전 `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` 로 1개만 도는지 확인.
  (`timeout` 래퍼로 띄운 node는 TaskStop해도 orphan으로 남을 수 있음 → Stop-Process로 PID 직접 kill.)

## 공통: 브라우저 연결
- `npm run launch` — 시스템 Edge/Chrome를 `--remote-debugging-port`(기본 9222)로 띄운다. **사용자가 직접 로그인**한다.
  자동화가 로그인하면 일부 IdP(구글 등)가 차단하므로 절대 스크립트로 로그인하지 말 것.
- 자동화는 `chromium.connectOverCDP('http://localhost:9222')` 로 *연결*만 한다(launch 아님).
- 대상 사이트는 `config.json` 에서 설정(`loginUrl`/`listUrlBase`/`submainUrl`/`debugPort` 등).

---

## 플랫폼 A — ILOS (eCampus, 예: 건국대)

### 실행 흐름
1. `npm run launch` → 사용자 로그인 → 대상 과목 한 번 열어 활성화(`submain_form.acl` 또는 좌측 드롭다운).
2. `npm run enumerate` — 모든 주차(`listUrlBase`+주차번호)를 순회해 항목/진행률/인정기간을 `.state/report.json`에 저장.
3. `npm run auto -- <주차들>` — 지정 주차를 1배속 완주 + 완료처리. 진행상황 `.state/auto-progress.json`(재개 가능).

### 핵심 메커니즘
- **항목 열기**: 목록 항목 span `onclick="viewGo(주차,주차,마감일시,현재일시,item_id)"` 클릭. 플레이어 = `online_view_form.acl`(바깥)
  + `online_view.acl?...mp4`(video.js 프레임) + `online_view_check.acl`.
- **재생 제어**: video 프레임에서 `document.querySelector('video')` → `muted=true; playbackRate=1; play()`. 진행률=`currentTime/duration`.
- **완료처리 버튼**: `DIV#close_`(인라인 onclick 없음, JS 바인딩). 반드시 `document.getElementById('close_').click()`.
  텍스트로 찾아 클릭하면 컨테이너를 눌러 실패. 누르면 재생시간 기록 후 목록 복귀.
- **멈춤 처리**: 일정 시간 진행 없으면 `video.currentTime += 3`으로 버퍼를 밀고 재시도. 약 4분 정지면 다음 항목.

### 인정 규칙
- 사이트는 **실제 경과 시간**으로 집계 → **2배속 금지, 1배속만**.
- 완료처리 클릭 + **인정기간 내** 재생이라야 점수 인정. 주차표시 `1/1`(콘텐츠 이수)와 `진행률(%)`(기간내 시간)은 별개 → 마감 임박 주차를 먼저.
- 2차 본인인증 모달은 보통 **세션당 1회**. `email-auth.mjs`가 이메일 인증을 자동 처리(코드 입력 후 `confirmSecondaryAuth()` 직접 호출,
  `btnConfirmSecondaryAuth` id 중복 주의, Gmail은 대화 맨 아래 최신 코드). 전제: 같은 Edge 프로필이 해당 Gmail에 로그인.

---

## 플랫폼 B — K-MOOC (lms.kmooc.kr, Moodle)

K-MOOC LMS는 **Moodle 기반**. 통합 로그인은 `www.kmooc.kr/login`, "내 강의실"이 `lms.kmooc.kr`. 같은 `.edge-profile`에 세션 저장(자동로그인).

### B-1. 영상 자동수강
1. `npm run kmooc:list` → 수강 강좌(courseId). `npm run kmooc:list <courseId>` → VOD(완료상태)·퀴즈 cmid·과제.
2. `npm run kmooc:auto -- <courseId> [배속]` (기본 2배속) — 미완료 VOD를 0초부터 끝까지 재생 + 완료확인. 완료분 자동 스킵.

핵심 메커니즘:
- 강좌 `course/view.php?id=<courseId>`의 모듈: `li.modtype_vod`(영상)/`ubfile`(PDF)/`quiz`/`assign`/`feedback`/`ubboard`.
- **완료 판별**: `li.modtype_vod .autocompletion img` src 의 `completion-auto-y`(완료)/`-n`(미완료). 재실행 스킵 기준.
- **VOD 재생**: view.php "동영상 보기" = `window.open('mod/vod/viewer.php?id=cmid', ...)`. **viewer.php는 직접 page.goto해도 진도 보고됨**.
  viewer.php = video.js+HTML5 `<video>`(blob/HLS). `muted=true; playbackRate=N; currentTime=0; play()`.
- **진도 기록**: 재생 중 플레이어가 자동으로 `POST mod/vod/action.php`(courseid&cmid&...&positionfrom&positionto&coursemostype=trackDetail) 전송.
  position은 **영상 길이 대비 비율** → 틀어두면 알아서 시청구간 보고. **2배속도 인정됨**(실시간 경과 무관, ILOS와 정반대).
- **함정**: ① viewer.php가 '이어서 보시겠습니까?' **네이티브 confirm**을 띄움 → `page.on('dialog', d=>d.accept())` 핸들러 필수
  (없으면 Playwright 기본 dismiss와 경쟁해 ProtocolError 크래시). 시작 시 `currentTime=0`으로 전체구간 커버.
  ② 완료 직후 다음 영상 로드 타이밍에 'video 로드 실패/사라짐'이 가끔 발생 → 새로고침 재시도(40초 대기×3) + 마지막에 재실행으로 보충.
- 검은 화면으로 재생돼도 정상(서버는 화면 못 봄, 위치보고만 집계). 사람처럼 보이게 영상 사이 `humanGap()` 랜덤 대기 내장.

### B-2. 퀴즈 응시  ⚠ 비가역(채점) — **사용자 명시 승인 후에만**
1. `npm run kmooc:quiz-start -- <cmid>` — 응시 시작 + 전 문항 추출(콘솔 + `.state/quiz-q-<cmid>.json`). attempt 번호 출력.
2. 출력 문항을 보고 **강의 내용 기반으로 답 결정**(객관식 "옳은 것/옳지 않은 것" 구분 주의).
3. `npm run kmooc:quiz-submit -- <attempt> <cmid> "<페이지순 답,콤마>"` — 입력+최종제출+채점확인.
   - 답: 참거짓/객관식=보기 val, 단답=`T:텍스트`. 예) `"1,0,1"` / `"2,3,0,1,..."`.

메커니즘:
- `mod/quiz/view.php?id=cmid` → '바로 퀴즈에 응시'(시작 confirm은 dialog accept) → `attempt.php?attempt&cmid&page=N` 페이지당 1문항.
- 답 선택 후 **`input[name="next"]` 클릭으로 저장**(마지막=끝내기→요약). 최종 제출은 요약의 `form[action*=processattempt]`를
  **`form.submit()` 직접 호출**(finishattempt=1 hidden 포함 → JS 확인모달 우회). 채점결과 `review.php`.
- **기말고사는 응시마다 문제은행에서 다른 20문항 랜덤 출제**(주차퀴즈는 같은 3~4문항 순서만 셔플). 채점=최고점수, 보통 2회 응시.
  → **기말은 1차에서 신중히 풀어 한 번에 끝낼 것.** 1차 답을 2차에 재사용하면 다른 문항이라 0점(최고점수라 1차는 보존되나 2차를 날림).
  사용자 지침 예: 기말 1차가 일정 점수(예 90%)+면 2차 생략.
- 과제(`mod/assign`)·만족도 설문은 자동화 대상 아님(서술형/주관). 사용자가 직접.

---

## 운영 팁
- 장시간 작업은 백그라운드 실행 + `.state/*-current.json`/`*-progress.json` 으로 모니터링. 검증은 로그보다 **실제 목록 페이지 완료표시 재확인**(스크린샷).
- 사이트 DOM이 바뀌면 `_dev/`의 탐색 스크립트로 셀렉터를 다시 확인.

## 안전·윤리
- 본인 계정·본인 수강분만. 로그인은 항상 사람이 직접.
- 퀴즈 최종 제출은 채점되는 **비가역 외부 쓰기** → 반드시 사용자 명시 승인 후 실행(auto-mode classifier 차단 시 승인받아 재시도).
- 2배속·연속재생은 서버 로그에 흔적이 될 수 있음 → 사용자에게 고지하고 필요시 1배속/랜덤 대기로 완화.

## 파일
- 공통: `src/launch.mjs`(브라우저 실행) · `src/setup.mjs`(필요 프로그램 설치) · `config.json`(포트/URL)
- ILOS: `src/enumerate.js`(현황) · `src/auto.js`(본체) · `src/report.js` · `src/email-auth.mjs`(2차 인증) · `src/close-popups.mjs` · `src/player.js`/`run-part.js`
- K-MOOC: `src/kmooc-list.mjs`(강좌/모듈 탐색) · `src/kmooc-auto.mjs`(영상 자동수강) · `src/kmooc-quiz-start.mjs`(응시+문항추출) · `src/kmooc-quiz-submit.mjs`(입력+제출)
- `_dev/` 개발용 탐색 스크립트(kmooc-* 구조 분석, q-* 퀴즈 실험 등)
