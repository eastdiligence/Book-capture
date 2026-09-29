// 사진 전처리: 리사이즈 → 흑백 → 대비 늘리기(히스토그램 1%~99% 스트레칭)
const MAX_SIDE = 2000;

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {}
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function preprocess(file) {
  const bmp = await loadBitmap(file);
  const w0 = bmp.width, h0 = bmp.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
    d[i] = g;
    hist[g]++;
  }
  const total = w * h;
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255 && (acc += hist[lo]) < total * 0.01; lo++);
  acc = 0;
  for (; hi > 0 && (acc += hist[hi]) < total * 0.01; hi--);
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
