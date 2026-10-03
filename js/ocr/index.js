// OCR 인터페이스.
// 엔진은 `recognize(canvas, { onProgress }) => Promise<{ text: string, page: number|null }>` 만 구현하면 된다.
// 새 엔진을 추가하려면 ./엔진이름.js 를 만들고 ENGINES에 등록하면 끝. 어느 엔진을 쓸지는 설정(store.settings.ocrEngine)에서 고른다.
import { preprocess } from './preprocess.js';
import * as tesseract from './tesseract.js';
import * as googlevision from './googlevision.js';
import { settings } from '../store.js';

const ENGINES = { tesseract, googlevision };

function activeEngine() {
  const { ocrEngine } = settings.get();
  return ENGINES[ocrEngine] ? ENGINES[ocrEngine] : ENGINES.tesseract;
}

/**
 * @param {Blob} file 사진 파일 (저장하지 않고 메모리에서만 사용)
 * @param {{ onProgress?: (label: string, ratio: number) => void }} opts
 * @returns {Promise<{ text: string, page: number|null }>}
 */
export async function recognize(file, opts = {}) {
  opts.onProgress?.('사진 보정 중', 0);
  const canvas = await preprocess(file);
  const result = await activeEngine().recognize(canvas, opts);
  return { text: (result.text ?? '').trim(), page: result.page ?? null };
}

/** 엔진 준비(언어 데이터 다운로드 등)를 미리 시작해 첫 OCR 대기 시간을 줄임 */
export function warmUp() {
  activeEngine().warmUp?.().catch(() => {});
}
