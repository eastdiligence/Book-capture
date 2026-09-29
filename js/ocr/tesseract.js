// Tesseract.js 엔진 (kor+eng). 라이브러리는 첫 사용 시 CDN에서 불러온다.
import { detectPage } from './pagenum.js';
import { linesToText } from './layout.js';

const LIB_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let workerPromise = null;
let progressCb = null;

function loadLib() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LIB_URL;
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => reject(new Error('OCR 라이브러리를 불러오지 못했습니다. 네트워크를 확인하세요.'));
    document.head.appendChild(s);
  });
}

const STATUS_KO = {
  'loading tesseract core': 'OCR 엔진 불러오는 중',
  'initializing tesseract': 'OCR 엔진 준비 중',
  'loading language traineddata': '언어 데이터 받는 중 (처음 한 번)',
  'initializing api': 'OCR 준비 중',
  'recognizing text': '글자 인식 중',
};

function getWorker() {
  workerPromise ??= loadLib()
    .then((T) =>
      T.createWorker('kor+eng', 1, {
        logger: (m) => progressCb?.(STATUS_KO[m.status] ?? m.status, m.progress ?? 0),
      })
    )
    .catch((e) => {
      workerPromise = null;
      throw e;
    });
  return workerPromise;
}

export async function warmUp() {
  await getWorker();
}

/** Tesseract 결과에서 줄 목록을 뽑음 (버전별 구조 차이 흡수) */
function extractLines(data) {
  if (data.lines?.length) return data.lines;
  const lines = [];
  for (const b of data.blocks ?? [])
    for (const p of b.paragraphs ?? []) lines.push(...(p.lines ?? []));
  return lines;
}

export async function recognize(canvas, { onProgress } = {}) {
  progressCb = onProgress;
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(canvas);
    const lines = extractLines(data).map((l) => ({ text: l.text.trim(), bbox: l.bbox }));
    if (!lines.length) return { text: data.text, page: null };

    const { page, removeLine } = detectPage(lines, canvas.height);
    if (removeLine) {
      // 페이지 번호만 있는 줄은 본문에서 제거
      lines.splice(lines.findLastIndex((l) => l.text === removeLine), 1);
    }
    return { text: linesToText(lines), page };
  } finally {
    progressCb = null;
  }
}
