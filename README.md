# 독서노트 (Reading Notes PWA)

책 페이지를 사진으로 찍으면 OCR로 본문과 페이지 번호를 뽑고, 확인·수정한 뒤 GitHub 저장소(옵시디언 볼트)에 마크다운 콜아웃으로 커밋하는 iPhone용 웹앱입니다. 서버·빌드 과정이 없는 순수 정적 앱입니다.

```
index.html              화면 (홈 / 수정 / 설정)
css/style.css
js/app.js               UI 흐름, 대기열 전송
js/note.js              옵시디언 포맷, 블록 ID, 줄바꿈 정리, UTF-8 base64 (순수 함수)
js/github.js            GitHub Contents API (GET → 추가 → PUT, 409 시 1회 재시도)
js/store.js             localStorage (설정, 제목 캐시, 마지막 페이지, 대기열)
js/ocr/index.js         OCR 인터페이스: recognize(file) → { text, page }
js/ocr/tesseract.js     Tesseract.js 엔진 (kor+eng)
js/ocr/preprocess.js    리사이즈, 흑백, 대비 보정
js/ocr/pagenum.js       사진 위/아래 가장자리에서 페이지 번호 찾기
js/ocr/layout.js        줄 좌표로 문단 재구성
sw.js                   서비스 워커 (앱 셸 + OCR 라이브러리 캐시)
manifest.webmanifest    PWA 매니페스트
tests.html              로직 테스트 (브라우저에서 열기)
```

## 저장소는 두 개

| 저장소 | 공개 여부 | 용도 |
|---|---|---|
| 앱 저장소 (예: `reading-notes`) | **public** (무료 GitHub Pages 조건) | 이 폴더의 코드. 비밀 정보 없음 |
| 볼트 저장소 (예: `obsidian-vault`) | **private** | 앱이 `books/{책제목}_인용.md`에 커밋하는 곳 |

토큰은 코드에 들어가지 않고 폰 브라우저의 localStorage에만 저장되므로 앱 저장소가 공개여도 괜찮습니다.

---

## 1단계: 컴퓨터에서 실행해 보기

서비스 워커는 `localhost` 또는 HTTPS에서만 동작합니다. 이 폴더에서:

```bash
python -m http.server 8765
```

- 앱: http://localhost:8765/
- 로직 테스트: http://localhost:8765/tests.html (전부 ✓ 나와야 정상)

컴퓨터 브라우저에서도 ‘앨범’ 버튼으로 사진 파일을 골라 OCR·저장까지 전부 시험할 수 있습니다. 첫 OCR 때는 한국어·영어 인식 데이터(수~십수 MB)를 받느라 시간이 걸리고, 이후엔 캐시됩니다.

## 2단계: GitHub Pages에 배포

1. GitHub에서 새 **public** 저장소를 만듭니다 (예: `reading-notes`).
2. 이 폴더를 올립니다:
   ```bash
   git init
   git add .
   git commit -m "독서노트 앱"
   git branch -M main
   git remote add origin https://github.com/<사용자명>/reading-notes.git
   git push -u origin main
   ```
3. 저장소 **Settings → Pages → Build and deployment**에서
   Source: *Deploy from a branch*, Branch: `main` / `/ (root)` → Save.
4. 1~2분 뒤 `https://<사용자명>.github.io/reading-notes/` 에서 열립니다.

앱을 고친 뒤에는 `git push`만 하면 됩니다. 서비스 워커가 네트워크 우선이라 폰에서 앱을 다시 열면 새 버전이 적용됩니다. (파일을 새로 추가/삭제했다면 `sw.js`의 `SHELL_FILES`와 `VERSION`도 고치세요.)

## 3단계: 토큰 발급 (fine-grained)

1. GitHub → 프로필 사진 → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. 설정:
   - **Token name**: `독서노트 iPhone`
   - **Expiration**: 원하는 기간 (만료되면 앱에 “토큰이 올바르지 않거나 만료되었습니다”가 뜸 → 새로 발급해 입력)
   - **Repository access**: *Only select repositories* → **볼트 저장소 하나만** 선택
   - **Permissions → Repository permissions → Contents: Read and write** (나머지는 모두 No access. Metadata: Read-only는 자동으로 붙음)
3. **Generate token** → 표시된 `github_pat_...` 값을 복사합니다 (다시 볼 수 없음).

## 4단계: iPhone에서 설정하고 홈 화면에 추가

1. iPhone **Safari**로 `https://<사용자명>.github.io/reading-notes/` 접속
2. 아래쪽 **공유 버튼(□↑) → 홈 화면에 추가 → 추가**
3. 홈 화면의 ‘독서노트’ 아이콘으로 실행 (이때부터 주소창 없는 앱처럼 열림)
4. 오른쪽 위 ⚙︎ → Owner(GitHub 사용자명), Repository(볼트 저장소 이름), Branch(`main`), 토큰 붙여넣기 → **연결 테스트** → **설정 저장**

> 홈 화면 앱과 Safari 탭은 저장 공간이 따로입니다. **설정은 홈 화면 앱 안에서** 입력하세요.

## 5단계: 쓰기

1. 책 제목 입력 (기존 책은 자동완성 목록에서 선택)
2. 📷 촬영 또는 🖼 앨범 → 자동 보정 후 OCR
3. 수정 화면에서 확인
   - 페이지 번호: 사진 위/아래 가장자리의 숫자를 자동 입력. 못 읽으면 “직전 p.N → p.N+1 사용” 버튼이 뜸
   - **줄바꿈 정리**: 줄마다 끊긴 문장을 문단으로 합침 (문단 사이 빈 줄은 유지)
   - 옆 페이지 글자, 머리글 등은 직접 지우기
4. **저장** → `books/{책제목}_인용.md` 끝에 추가 커밋. 네트워크가 안 되면 ‘대기 N’ 배지로 보관되고, 앱을 다시 열거나 온라인이 되면 자동 재전송 (배지를 눌러 수동 재전송도 가능)

컴퓨터에서는 볼트 폴더에서 `git pull`로 가져오면 됩니다.

## 저장 형식

```markdown
---
type: book-note
title: 총균쇠
---

> [!quote] 총균쇠 · p.145
> 인류 역사의 흐름이 대륙마다 다르게 전개된 것은 ...
>
> 이것이 이 책의 핵심 주장이다.
> ^p145-1

> [!quote] 총균쇠 · p.145
> 같은 페이지 두 번째 인용
> ^p145-2

> [!quote] 총균쇠
> 페이지 번호를 비워 둔 인용
> ^q1
```

- 파일명에서 `\ / : * ? " < > | # ^ [ ]`는 제거됩니다.
- 파일명은 `{책제목}_인용.md`로 저장됩니다(프론트매터의 `title`과 콜아웃 제목엔 접미사 안 붙음). vault에 같은 제목의 다른 노트(예: `독서/변신.md`)가 이미 있어도 `[[변신]]` 링크와 안 겹치게 하기 위함입니다.
- 블록 ID는 저장 직전에 파일을 다시 읽어 계산하므로 여러 기기에서 써도 겹치지 않습니다.
- 앱은 `books/*.md` 외의 경로에는 쓰지 않도록 코드에서 막혀 있습니다(리뷰 등 다른 파일은 건드리지 않음). 기존 내용은 수정하지 않고 끝에 추가만 합니다.
- 제목 비교 시 공백·대소문자·일부 문장부호를 무시해, `총 균 쇠`처럼 표기만 다른 제목이면 기존 제목에 저장할지 묻습니다.

## OCR 엔진을 Google Cloud Vision으로 바꾸기 (더 정확함, 매달 1,000건 무료)

실제 책 사진에서는 Tesseract(완전 오프라인)보다 Google Cloud Vision이 한글 인식률이 훨씬 높습니다. 단, API 키를 숨길 작은 중계 서버(프록시)가 하나 필요합니다 — 앱이 키를 직접 들고 있으면 브라우저에서 누구나 꺼내 쓸 수 있기 때문입니다. `cloudflare-worker/worker.js`가 그 프록시 코드입니다.

1. **Google Cloud Vision API 키 발급**
   - [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성 → **Cloud Vision API** 사용 설정
   - API 및 서비스 → 사용자 인증 정보 → **API 키 만들기**
   - 만든 키 → **키 제한** → API 제한사항을 **Cloud Vision API만** 허용하도록 반드시 제한 (유출돼도 피해 범위를 줄이기 위함)
   - 매달 1,000건까지 무료, 개인 독서노트 용도로는 충분합니다.

2. **Cloudflare Worker 배포** (무료, 가입만 하면 됨)
   - [Cloudflare 대시보드](https://dash.cloudflare.com/) → Workers & Pages → **Create → Create Worker** → 이름 정하고 생성
   - 편집기에서 기본 코드를 지우고 이 저장소의 [`cloudflare-worker/worker.js`](cloudflare-worker/worker.js) 내용을 붙여넣기 → **Deploy**
   - Worker 페이지 → **Settings → Variables and Secrets → Add** → 아래 두 개를 **Secret** 타입으로 등록
     - `GOOGLE_VISION_API_KEY`: 1번에서 받은 키
     - `PROXY_SECRET`: 아무 값이나 직접 정한 비밀키 (예: 긴 임의 문자열). **이게 없으면 Worker 주소를 아는 누구나 호출할 수 있어 과금 위험이 있으니 반드시 설정할 것.**
   - Worker 주소(예: `https://xxx.사용자명.workers.dev`)를 복사해 둡니다.

3. **앱 설정**
   - 앱 ⚙︎ 설정 화면 → OCR 엔진: **Google Vision** 선택 → OCR 프록시 주소에 2번의 Worker 주소, OCR 프록시 비밀키에 `PROXY_SECRET`과 동일한 값 입력 → 설정 저장

새 엔진을 직접 추가하고 싶다면 `js/ocr/index.js`의 인터페이스(`recognize(canvas, { onProgress }) → { text, page }`)만 맞춰 파일을 만들고 `ENGINES`에 등록하면 됩니다(`js/ocr/googlevision.js` 참고).

## 보안 메모

- 토큰은 `localStorage`에만 저장되고, 화면(비밀번호 칸, “저장됨” 표시만)·콘솔·에러 메시지에 출력되지 않습니다.
- 토큰 권한은 볼트 저장소 하나의 Contents 읽기/쓰기로 제한하세요. 폰을 잃어버리면 GitHub에서 토큰을 **Revoke** 하면 됩니다.
- OCR 프록시 비밀키(`PROXY_SECRET`)도 토큰과 같은 방식(`localStorage`만, 화면·콘솔 비노출)으로 다룹니다. Cloudflare Worker 쪽 값을 바꾸면 앱 설정에서도 똑같이 바꿔야 합니다.
- 사진은 화면 표시와 OCR에만 메모리에서 쓰고, 어디에도 저장·전송하지 않습니다.
