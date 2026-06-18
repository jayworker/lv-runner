# 🎬 lv-runner

대학 LMS 온라인 강의를 **자동으로 끝까지 재생하고 완료 처리까지** 해주는 개인 학습 보조 러너. Playwright가 **사용자가 직접 로그인한 실제 브라우저**에 연결(CDP)해 동작합니다. K-MOOC는 **퀴즈/기말 응시**도 지원합니다.

**지원 플랫폼**

| 플랫폼 | 예시 | 엔진 | 배속 | 퀴즈 |
|---|---|---|---|---|
| **ILOS (eCampus)** | 건국대 `ecampus.konkuk.ac.kr` | 자체(ILOS) | **1배속만** (실시간 집계) | — (영상만) |
| **K-MOOC** | `lms.kmooc.kr` | Moodle | **2배속 가능** (영상 구간 집계) | 주차퀴즈·기말 응시 |

```
 npm run launch ──▶ 🌐 브라우저에서 직접 로그인 ──▶ 자동 재생/완료처리
   (브라우저 켜기)        (사람이 직접 인증)         (ILOS: auto / K-MOOC: kmooc:auto)
```

---

## 📦 설치 (최초 1회)

**필요 프로그램**: Node.js 18+, Microsoft Edge(또는 Chrome). 없으면 (Windows · 관리자 PowerShell):
```powershell
winget install OpenJS.NodeJS.LTS    # Node.js (이미 있으면 생략)
winget install Microsoft.Edge        # Edge (보통 기본 설치돼 있음)
```
그다음 레포에서:
```bash
npm run setup    # 의존성 설치 + 브라우저 자동 점검/설치
```
> 시스템 Edge에 연결하므로 별도 `playwright install`은 필요 없습니다.

---

## 🔑 사전 준비 — 브라우저에 로그인 저장 (최초 1회)

자동화는 **`npm run launch`로 띄운 전용 브라우저(`.edge-profile`)**에 연결만 합니다. **로그인은 항상 사람이 직접** 합니다(자동화가 로그인하면 구글 등 IdP가 차단).

1. `npm run launch` → 뜬 창에서 대상 LMS에 **직접 로그인**하고, 브라우저의 **"비밀번호 저장"·"로그인 상태 유지"를 허용**.
   - K-MOOC: `https://lms.kmooc.kr/` 로 이동해 로그인.
2. (eCampus 2차 인증용) 같은 브라우저에서 **Gmail에 로그인**해 두면 이메일 인증 코드를 자동으로 읽어옵니다.

> 한 번 저장해 두면 다음부터는 세션이 유지돼 바로 이어서 쓸 수 있습니다.

---

## 🚀 사용법

### 공통 — 브라우저 띄우기
```bash
npm run launch          # 뜬 창에서 직접 로그인
```

### A) ILOS (eCampus) 영상 자동수강
| 단계 | 명령 | 설명 |
|---|---|---|
| 1️⃣ | (브라우저에서) 대상 **과목 한 번 열기** | 활성 컨텍스트 지정 |
| 2️⃣ | `npm run report` | 진행률·주차별 완료 확인 |
| 3️⃣ | `npm run auto -- 13` | 13주차 재생(1배속+완료처리) |
```bash
npm run auto -- 13,12,11   # 여러 주차 (마감 임박 주차를 앞에)
npm run auto -- all        # 전체 미완 주차
```

### B) K-MOOC 영상 자동수강
```bash
npm run kmooc:list                  # 수강 강좌 목록(courseId)
npm run kmooc:list -- 18736         # 해당 강좌 VOD 완료상태·퀴즈 cmid
npm run kmooc:auto -- 18736 2       # 강좌 18736 미완 영상 자동수강(2배속)
```
> 완료분은 자동 스킵, 중단돼도 이어서 재개. 영상 사이 사람처럼 랜덤 대기. 화면이 검게 보여도 진도는 정상 집계됩니다.

### C) K-MOOC 퀴즈 응시 ⚠️ 채점되는 비가역 작업 — 본인 확인 후 실행
```bash
npm run kmooc:quiz-start -- 2156156                 # 응시 시작 + 문항 추출(콘솔/.state)
# → 출력된 문항을 보고 강의 내용 기반으로 답을 정한 뒤:
npm run kmooc:quiz-submit -- <attempt> 2156156 "1,0,1"   # 입력 + 최종 제출 + 채점 확인
```
> 답: 참거짓/객관식 = 보기 값, 단답 = `T:텍스트`. **기말고사는 응시마다 다른 문항이 랜덤 출제**되니 한 번에 신중히.

---

## 🤖 Codex / Claude Code 로 쓰기

레포 폴더를 열고 이렇게 말하면 알아서 진행합니다:
> "건국대 13주차 강의 재생 돌려줘" · "K-MOOC 이 강의 들어줘" · "퀴즈도 풀어줘"

- **Codex**: [`AGENTS.md`](./AGENTS.md)를 자동으로 읽고 실행.
- **Claude Code**: [`SKILL.md`](./SKILL.md)를 스킬로 인식(`.claude/skills/`에 두면 슬래시 호출).

(단, **로그인만은 직접** 해야 합니다.)

---

## ⚠️ 알아둘 것

- 🕐 **ILOS는 1배속만** 완료 인정(실제 재생시간 기준). **K-MOOC는 2배속 가능**(영상 구간 기준).
- ⏰ ILOS는 **마감 임박 주차를 맨 앞 순서**에 (인정기간 내라야 점수).
- 🖥️ 실행 중 **브라우저 닫지 말기**, PC **절전 끄기**, 같은 브라우저를 **두 번 동시에 돌리지 말기**.
- ✍️ K-MOOC 퀴즈 **최종 제출은 채점되는 비가역 작업** — 본인 확인 후 실행. 과제(서술형)·만족도 설문은 직접.
- 🐢 2배속·연속재생은 서버 로그에 흔적이 될 수 있습니다(무료 공개강좌라 감사 가능성은 낮음).
- 📚 **본인 계정·본인 수강 항목만** 사용. 책임은 사용자.

---

## 🛠 요구사항

- Node.js 18+ / Microsoft Edge(또는 Chrome)
- ⚠️ 설치 경로에 **한글·공백·특수문자(#) 금지, OneDrive 동기화 폴더 금지** — Playwright 네이티브 모듈이 `access violation`으로 크래시합니다. **짧은 ASCII 경로**(예: `C:\lv-runner`)에 두세요.
- ILOS 대상 사이트는 `config.json`에서 설정. K-MOOC는 `lms.kmooc.kr` 고정.

> 자세한 동작 원리는 [`AGENTS.md`](./AGENTS.md) 참고.
