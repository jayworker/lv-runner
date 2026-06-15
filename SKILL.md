---
name: lv-runner
description: 대학 LMS 온라인 강의를 자동 수강(영상 자동재생+진도처리)하고, K-MOOC의 경우 퀴즈/기말도 응시한다. "강의 자동 재생/수강 돌려줘", "온라인강의 틀어줘", "N주차 수강해줘", "K-MOOC 강의 들어줘", "퀴즈도 풀어줘" 라고 할 때 사용. 본인 계정·본인 수강분만.
---

# lv-runner (Claude Code 스킬)

대학 LMS 강의 영상을 Playwright로 자동 재생/완료처리하는 도구. **두 플랫폼**을 지원한다:

| 플랫폼 | 예시 | 엔진 | 배속 | 퀴즈 |
|---|---|---|---|---|
| **ILOS (eCampus)** | 건국대 ecampus.konkuk.ac.kr | 자체(ILOS) | **1배속만** (실시간 집계) | 없음(영상만) |
| **K-MOOC** | lms.kmooc.kr | Moodle | **2배속 가능** (영상 구간 집계) | 주차퀴즈·기말 응시 가능 |

> 이건 **Claude Code 전용 스킬** 파일이다. Codex 등은 스킬 개념이 없고 [`AGENTS.md`](./AGENTS.md)를 읽어 실행한다. 상세 동작원리·셀렉터·트러블슈팅은 모두 AGENTS.md에 있다.

## 공통 0단계 — 브라우저 띄우고 로그인
1. (최초 1회) `npm install` 또는 `npm run setup`
2. `npm run launch` — 실제 Edge를 원격디버깅 포트(9222)로 띄운다. **사용자가 직접 로그인**한다(자동 로그인 금지: IdP가 자동화를 차단). 자동화는 `connectOverCDP`로 *연결만* 한다.
   - 로그인 화면 URL은 `config.json`의 `loginUrl`. K-MOOC면 `https://lms.kmooc.kr/` 로 이동해 로그인.

## A. ILOS(eCampus) 영상 자동수강
1. 대상 과목을 브라우저에서 한 번 열어 활성화(`submain_form.acl` 또는 좌측 드롭다운).
2. `npm run enumerate` — 주차/항목/진행률을 `.state/report.json`에 수집.
3. `npm run auto -- <주차들>` — 1배속 완주 + 완료처리(`#close_`). **마감 임박 주차를 앞에**.
4. `npm run report` — 진행 확인.
- 규칙: **1배속만** 인정. 완료처리 클릭 + **인정기간 내**라야 점수. 2차 인증은 세션당 1회(이메일 자동처리 `email-auth.mjs`).

## B. K-MOOC(Moodle) 영상 자동수강
1. `npm run kmooc:list` → 수강 강좌 목록(courseId). `npm run kmooc:list <courseId>` → VOD 완료상태·퀴즈 cmid.
2. `npm run kmooc:auto -- <courseId> [배속]` — 미완료 VOD를 끝까지 재생+완료확인. 기본 2배속. 완료분 자동 스킵·재개 가능.
   - 예) `npm run kmooc:auto -- 18736 2`
   - 영상 사이 사람처럼 랜덤 대기(humanGap) 내장. 검은 화면이어도 진도는 정상(서버는 위치보고만 집계).

## C. K-MOOC 퀴즈 응시  ⚠ 비가역 — 사용자 명시 승인 필수
1. `npm run kmooc:quiz-start -- <cmid>` — 응시 시작 + 전 문항 추출(콘솔/`.state/quiz-q-<cmid>.json`).
2. 출력된 문항을 보고 **강의 내용 기반으로 답 결정**.
3. `npm run kmooc:quiz-submit -- <attempt> <cmid> "<페이지순 답,콤마>"` — 입력 후 최종 제출, 채점 확인.
   - 참거짓/객관식 = 보기 val, 단답 = `T:텍스트`. 예) `"1,0,1"` / `"2,3,0,1"`.
- **기말고사는 응시마다 다른 문항이 랜덤 출제**(주차퀴즈는 같은 문항 셔플) → 1차에서 신중히, 한 번에. 채점은 최고점수·보통 2회 응시.

## 안전·윤리
- **본인 계정·본인 수강분만**. 로그인은 항상 사람이 직접.
- 퀴즈 최종 제출은 채점되는 비가역 행위 → **사용자 명시 승인 후에만** 실행.
- 2배속·연속재생은 서버 로그에 흔적이 될 수 있음(매치업 무료강좌라 감사 가능성은 낮음). 사용자에게 고지.
