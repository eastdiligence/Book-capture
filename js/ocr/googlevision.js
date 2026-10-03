// Google Cloud Vision(DOCUMENT_TEXT_DETECTION) 엔진.
// API 키를 숨기기 위해 Cloudflare Worker 등 프록시를 거친다 (cloudflare-worker/worker.js 참고).
// 설정 화면에서 OCR 엔진을 "Google Vision"으로 선택하고 프록시 주소(ocrProxyUrl)를 입력해야 쓰인다.
import { detectPage } from './pagenum.js';
import { linesToText } from './layout.js';
import { settings } from '../store.js';

function bboxOf(vertices) {
  const xs = (vertices ?? []).map((v) => v.x ?? 0);
  const ys = (vertices ?? []).map((v) => v.y ?? 0);
  return { x0: Math.min(...xs, 0), y0: Math.min(...ys, 0), x1: Math.max(...xs, 0), y1: Math.max(...ys, 0) };
}

function union(a, b) {
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

/** Vision fullTextAnnotation → { text, bbox }[] (단어의 줄바꿈 표시로 줄 경계를 나눔) */
function extractLines(fullTextAnnotation) {
  const lines = [];
  let words = [];
  let bbox = null;

  const flush = () => {
    if (words.length) lines.push({ text: words.join(' '), bbox });
    words = [];
    bbox = null;
  };

  for (const page of fullTextAnnotation?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const word of para.words ?? []) {
          bbox = bbox ? union(bbox, bboxOf(word.boundingBox?.vertices)) : bboxOf(word.boundingBox?.vertices);
          words.push((word.symbols ?? []).map((s) => s.text).join(''));
          const brk = word.symbols?.at(-1)?.property?.detectedBreak?.type;
          if (brk === 'LINE_BREAK' || brk === 'EOL_SURE_SPACE') flush();
        }
        flush(); // 문단 경계는 항상 줄 경계로 취급
      }
    }
  }
  return lines;
}

async function callProxy(base64) {
  const { ocrProxyUrl } = settings.get();
  if (!ocrProxyUrl) throw new Error('설정에서 OCR 프록시 주소를 입력하세요.');
  const res = await fetch(ocrProxyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  });
  if (!res.ok) throw new Error(`OCR 프록시 오류 (${res.status})`);
  return res.json();
}

export async function recognize(canvas, { onProgress } = {}) {
  onProgress?.('글자 인식 중', 0.3);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const data = await callProxy(dataUrl.slice(dataUrl.indexOf(',') + 1));
  onProgress?.('글자 인식 중', 0.9);

  const fta = data.fullTextAnnotation;
  if (!fta) return { text: '', page: null };

  const lines = extractLines(fta).filter((l) => l.text.trim());
  if (!lines.length) return { text: fta.text ?? '', page: null };

  const { page, removeLine } = detectPage(lines, canvas.height);
  if (removeLine) {
    lines.splice(lines.findLastIndex((l) => l.text === removeLine), 1);
  }
  return { text: linesToText(lines), page };
}
