// 앱 셸 캐시. 셸은 네트워크 우선이라 온라인이면 새 파일이 바로 반영된다.
// 파일을 추가/삭제했을 때만 SHELL_FILES와 VERSION을 고치면 된다.
const VERSION = 'v1.0.0';
const SHELL = `shell-${VERSION}`;
const RUNTIME = 'runtime-cdn'; // tesseract.js 등 버전 고정된 CDN 파일

const SHELL_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/note.js',
  './js/github.js',
  './js/store.js',
  './js/ocr/index.js',
  './js/ocr/preprocess.js',
  './js/ocr/tesseract.js',
  './js/ocr/pagenum.js',
  './js/ocr/layout.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // GitHub API는 절대 캐시하지 않음
  if (url.hostname === 'api.github.com') return;

  // 같은 출처(앱 셸): 네트워크 우선, 실패 시 캐시 → 온라인이면 항상 최신, 오프라인이면 캐시로 동작
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r ?? caches.match('./index.html')))
    );
    return;
  }

  // CDN(jsdelivr): 버전 고정 URL이므로 캐시 우선
  if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
