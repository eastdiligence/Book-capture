// OCR 줄 목록(텍스트 + bbox)에서 사진 하단/상단 모서리의 페이지 번호를 찾는다. 엔진 독립적인 순수 함수.

const PURE = /^[\s\-–—·.|()[\]]*(\d{1,4})[\s\-–—·.|()[\]]*$/; // "123", "- 123 -"
const HEADER_START = /^(\d{1,4})\s+\S/; // "123  책 제목"
const HEADER_END = /\S\s+(\d{1,4})$/; // "장 제목  123"

/**
 * @param {{ text: string, bbox: { y0: number, y1: number } }[]} lines
 * @param {number} height 이미지 높이
 * @returns {{ page: number|null, removeLine: string|null }}
 */
export function detectPage(lines, height) {
  const bottom = lines.filter((l) => l.bbox.y0 > height * 0.8).reverse();
  const top = lines.filter((l) => l.bbox.y1 < height * 0.15);

  const pick = (list, re) => {
    for (const l of list) {
      const m = l.text.match(re);
      if (m && Number(m[1]) > 0) return { page: Number(m[1]), line: l.text };
    }
    return null;
  };

  const pure = pick(bottom, PURE) ?? pick(top, PURE);
  if (pure) return { page: pure.page, removeLine: pure.line };
  const header = pick(top, HEADER_START) ?? pick(top, HEADER_END);
  if (header) return { page: header.page, removeLine: null };
  return { page: null, removeLine: null };
}
