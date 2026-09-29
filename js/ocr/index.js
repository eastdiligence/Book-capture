// OCR 인터페이스.
// 엔진은 `recognize(canvas, { onProgress }) => Promise<{ text: string, page: number|null }>` 만 구현하면 된다.
// 나중에 Claude API 이미지 인식으로 바꿀 때는 ./claude.js 같은 엔진을 추가하고 ENGINES에 등록하면 끝.
import { preprocess } from './preprocess.js';
import * as tesseract from './tesseract.js';

const ENGINES = { tesseract };
let current = 'tesseract';

export function setEngine(name) {
  if (!ENGINES[name]) throw new Error(`알 수 없는 OCR 엔진: ${name}`);
  current = name;
}

/**
 * @param {Blob} file 사진 파일 (저장하지 않고 메모리에서만 사용)
 * @param {{ onProgress?: (label: string, ratio: number) => void }} opts
 * @returns {Promise<{ text: string, page: number|null }>}
 */
export async function recognize(file, opts = {}) {
  opts.onProgress?.('사진 보정 중', 0);
  const canvas = await preprocess(file);
  const result = await ENGINES[current].recognize(canvas, opts);
  return { text: (result.text ?? '').trim(), page: result.page ?? null };
}

/** 엔진 준비(언어 데이터 다운로드 등)를 미리 시작해 첫 OCR 대기 시간을 줄임 */
export function warmUp() {
  ENGINES[current].warmUp?.().catch(() => {});
}
