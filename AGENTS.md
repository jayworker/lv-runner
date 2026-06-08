# AGENTS.md — lv-runner (Codex / Claude Code 공용 지침)

이 저장소는 LMS(ILOS 계열) 강의 영상을 자동 재생하는 Playwright 도구다. 에이전트는 아래 동작 원리를 숙지하고, 사용자 **본인 계정·본인 수강 항목**에 한해 운영/확장한다. 타인 계정·대리 처리는 돕지 않는다.

## 실행 흐름
1. `npm run launch` — 시스템 Edge/Chrome를 `--remote-debugging-port`(config.debugPort, 기본 9222)로 띄운다. **사용자가 직접 로그인**한다. 자동화가 로그인하면 일부 IdP(구글 등)가 차단하므로 절대 스크립트로 로그인하지 말 것.
2. 사용자가 대상 과목을 브라우저에서 한 번 열어 활성 컨텍스트로 만든다(`config.submainUrl` 진입 또는 좌측 과목 드롭다운).
3. `npm run enumerate` — 모든 주차(`config.listUrlBase` + 주차번호)를 순회해 항목 목록/진행률/인정기간을 `.state/report.json`에 저장.
4. `npm run auto -- <주차들>` — 지정 주차를 순서대로 1배속 완주 + 완료처리. 진행상황은 `.state/auto-progress.json`(재개 가능).

## 환경 주의 (필독)
- 프로젝트 경로에 **한글·공백·특수문자(#)·OneDrive 동기화 폴더 금지**. 이런 경로에선 Playwright 네이티브 모듈 로딩이 `access violation`(exit -1073741819)으로 크래시한다. **짧은 ASCII 경로**(예: `C:\lv-runner`)에 둘 것.
- `node_modules`·`.edge-profile`(로그인 세션)·`.state`(개인 데이터)는 OneDrive 밖 + 커밋 금지(.gitignore).

## 핵심 메커니즘 (변경 시 깨지기 쉬운 부분)
- **연결**: `chromium.connectOverCDP('http://localhost:<port>')`. 브라우저를 launch하지 않고 *연결*만 한다.
- **항목 열기**: 목록의 항목 span `onclick="viewGo(주차,주차,마감일시,현재일시,item_id)"`를 클릭. 플레이어 = `online_view_form.acl`(바깥) + `online_view.acl?...mp4`(video.js 프레임) + `online_view_check.acl`.
- **재생 제어**: video 프레임에서 `document.querySelector('video')` → `muted=true; playbackRate=1; play()`. 진행률 = `currentTime/duration`.
- **완료처리 버튼**: `DIV#close_`(인라인 onclick 없음, JS 바인딩). 반드시 `document.getElementById('close_').click()`. 텍스트로 찾아 클릭하면 컨테이너를 눌러 실패한다. 누르면 재생시간 기록 후 목록 복귀.
- **멈춤 처리**: 일정 시간 진행이 없으면 `video.currentTime += 3`으로 버퍼를 밀고 재생 재시도. 약 4분 정지면 다음 항목으로.

## 인정 규칙 (사용자에게 안내)
- 사이트는 **실제 경과 시간**으로 재생시간을 집계 → **2배속 금지, 1배속만**.
- 학습창의 **완료처리 클릭** + **인정기간 내** 재생이라야 점수 인정.
- 주차 표시 `1/1` = 콘텐츠 이수(기간 지나도 채워짐) ↔ `진행률`(%) = 기간 내 재생시간만 반영. **기간 만료 후 재생하면 1/1은 되지만 진행률/점수는 안 오른다.** → 마감 임박 주차를 항상 먼저.
- 추가 본인인증(2차 인증) 모달은 보통 **세션당 1회**(새 로그인 후 첫 강의 진입 시). auto.js가 감지하면 **이메일 인증을 자동 처리**(`email-auth.mjs`)한다: 이메일 방식 발송 → 브라우저 Gmail에서 최신 코드 읽기 → 입력 → `confirmSecondaryAuth()` 호출. **전제: 같은 Edge 프로필이 해당 Gmail에 로그인돼 있어야 함.** 자동 실패 시 사용자가 앱푸시/SMS로 직접 인증.
  - 주의: 확인 버튼 id(`btnConfirmSecondaryAuth`)가 단계별로 **중복**되어 클릭이 엉뚱한 버튼을 누른다 → 반드시 `confirmSecondaryAuth()` 함수 직접 호출. 코드 4칸은 실제 키보드 타이핑(자동 칸이동). Gmail은 같은 제목을 대화로 묶으므로 **대화 맨 아래(최신) 메시지**의 코드를 읽을 것.

## 운영 팁
- 장시간 작업은 백그라운드 실행 + `.state/auto-current.json`(현재 항목)·`auto-progress.json`(완료 목록)로 모니터링.
- 검증은 로그보다 **실제 목록 페이지의 표시/진행률 재확인**이 신뢰도 높다(스크린샷 권장).
- 사이트 DOM이 바뀌면 `_dev/`의 탐색용 스크립트로 셀렉터를 다시 확인.

## 파일
- `src/launch.mjs` 브라우저 실행 · `src/enumerate.js` 현황 수집 · `src/auto.js` 본체 · `src/report.js` 현황 출력 · `src/setup.mjs` 필요 프로그램 설치
- `src/email-auth.mjs` 2차 인증(이메일) 자동 처리 · `src/close-popups.mjs` 공지 팝업 자동 닫기('더이상 열지 않음') — 둘 다 auto.js에 통합됨
- `src/player.js`·`src/run-part.js` 단일 항목 유틸 · `_dev/` 개발용 탐색 스크립트
- `config.json` 포트/URL/기본 배속 (대상 사이트는 여기서 설정)
