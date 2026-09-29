// OCR 줄 좌표로 본문 텍스트를 재구성한다. 엔진 독립적인 순수 함수.
// 줄은 그대로 줄바꿈으로 두고, 문단 경계에만 빈 줄을 넣는다.
// 문단 경계: 줄 간격이 평소보다 크게 벌어짐, 또는 첫 줄 들여쓰기(한국 책의 일반적인 문단 표시).

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** @param {{ text: string, bbox: { x0: number, y0: number, x1: number, y1: number } }[]} lines */
export function linesToText(lines) {
  const ls = lines.filter((l) => l.text.trim());
  if (!ls.length) return '';

  const lineH = median(ls.map((l) => l.bbox.y1 - l.bbox.y0)) || 1;
  const steps = ls.slice(1).map((l, i) => l.bbox.y0 - ls[i].bbox.y0).filter((d) => d > 0);
  const step = steps.length >= 2 ? median(steps) : lineH * 1.6;
  const left = median(ls.map((l) => l.bbox.x0));

  let out = ls[0].text.trim();
  for (let i = 1; i < ls.length; i++) {
    const prev = ls[i - 1], cur = ls[i];
    const gap = cur.bbox.y0 - prev.bbox.y0;
    const bigGap = gap > step * 1.5 || gap < 0; // gap<0: 단/블록이 바뀜
    const indented = cur.bbox.x0 - left > lineH * 0.7;
    out += (bigGap || indented ? '\n\n' : '\n') + cur.text.trim();
  }
  return out;
}
