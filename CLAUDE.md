# Book-capture (독서노트 PWA)

책 페이지 사진 → OCR(Tesseract.js, kor+eng) → 사용자가 수정 → GitHub Contents API로 볼트 저장소의 `books/{책제목}.md`에 옵시디언 `[!quote]` 콜아웃으로 커밋하는 iPhone용 PWA. 서버·빌드 없음, GitHub Pages로 배포. UI는 한국어, 모바일 우선.

## 실행 / 테스트
- Node 없음. 정적 파일이라 `python -m http.server 8765` 후 http://localhost:8765/ (SW는 localhost/HTTPS에서만 동작).
- 로직 테스트: http://localhost:8765/tests.html 을 열어 전부 ✓인지 확인 (프레임워크 없음, 브라우저에서 실행). `js/note.js`, `js/ocr/pagenum.js`, `js/ocr/layout.js`를 고치면 여기에 테스트를 추가할 것.
- 배포: `main` 브랜치 root를 GitHub Pages로 서비스. 자세한 절차는 README.md.

## 구조
- `js/app.js` UI 흐름·대기열 전송 / `js/note.js` 포맷·블록 ID·줄바꿈 정리·base64 (순수 함수) / `js/github.js` API / `js/store.js` localStorage
- `js/ocr/index.js` 엔진 인터페이스 `recognize(file) → { text, page }`. 엔진(`tesseract.js`)은 `recognize(canvas, {onProgress})`만 구현하면 교체 가능(Claude API 등). `preprocess.js`, `pagenum.js`, `layout.js`는 엔진 독립.
- `sw.js` 셸은 네트워크 우선, jsdelivr CDN은 캐시 우선. **파일을 추가/삭제하면 `SHELL_FILES`와 `VERSION`을 함께 수정.**

## 지켜야 할 규칙
- 저장 형식은 요청 사양 그대로: 프론트매터(`type: book-note`, `title`) → 빈 줄 → `> [!quote] 제목 · p.N` → `> 본문` → `^pN-k` (페이지 없으면 `^q순번`). 항상 파일 끝에 추가만 하고 기존 내용은 수정하지 않는다.
- 블록 ID는 커밋 직전에 GET한 내용으로 계산한다(409/422 시 재조회 후 1회 재시도).
- 앱은 `books/*.md` 외 경로에 쓰지 않는다(`github.js`의 `assertWritable`). 리뷰 파일은 절대 건드리지 않는다.
- 토큰은 localStorage에만 저장하고 화면·콘솔·에러 메시지에 노출하지 않는다. 사진은 저장·전송하지 않는다.
- base64는 반드시 UTF-8(TextEncoder/Decoder) 경유로 처리한다.
- 앱 저장소는 public(토큰 없음), 노트가 저장되는 볼트 저장소는 private 전제.

## 알려진 사항 / TODO
- 실제 iPhone Safari와 실제 책 사진으로는 아직 검증하지 않음(데스크톱 브라우저의 모바일 뷰 + 가짜 GitHub API로만 검증).
- 옵시디언에서 `^블록ID`를 인용 바로 다음 줄에 둔 형식이 `[[책#^p123-1]]` 링크로 정상 동작하는지 확인 필요. 안 되면 `note.js`의 `buildCallout` 수정.
- Claude API OCR로 교체하려면 API 키를 숨길 프록시(Cloudflare Worker 등)가 필요.
