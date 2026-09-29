// 옵시디언 노트 포맷 관련 순수 함수 모음 (DOM/네트워크 의존 없음 → tests.html에서 테스트)

/** 파일명에 쓸 수 없는 문자 제거 (Windows/macOS/옵시디언 링크 문자 포함) */
export function sanitizeFileName(title) {
  return title
    .replace(/[\\/:*?"<>|#^[\]\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');
}

export function bookPath(title) {
  const name = sanitizeFileName(title);
  if (!name) throw new Error('책 제목이 비어 있거나 쓸 수 없는 문자만 있습니다.');
  return `books/${name}.md`;
}

/** 공백·대소문자·일부 문장부호를 무시한 비교 키 */
export function normalizeTitle(title) {
  return title.toLowerCase().replace(/[\s·.,:;'"!?\-_()[\]<>《》〈〉「」『』]/g, '');
}

/** 새 제목과 표기만 다른 기존 제목 찾기 (완전 일치면 null) */
export function findSimilarTitle(title, existing) {
  if (existing.includes(title)) return null;
  const key = normalizeTitle(title);
  return existing.find((t) => normalizeTitle(t) === key) ?? null;
}

function yamlString(s) {
  return /^[\w가-힣][\w가-힣 ]*$/.test(s) ? s : JSON.stringify(s);
}

export function frontmatter(title) {
  return `---\ntype: book-note\ntitle: ${yamlString(title)}\n---\n`;
}

/** 파일 내용에서 다음 블록 ID 계산 */
export function nextBlockId(content, page) {
  const re = page ? new RegExp(`\\^p${page}-(\\d+)\\s*$`, 'gm') : /\^q(\d+)\s*$/gm;
  let max = 0;
  for (const m of content.matchAll(re)) max = Math.max(max, Number(m[1]));
  return page ? `p${page}-${max + 1}` : `q${max + 1}`;
}

export function buildCallout(title, page, text, blockId) {
  const header = page ? `> [!quote] ${title} · p.${page}` : `> [!quote] ${title}`;
  const body = text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split('\n')
    .map((line) => (line.trim() ? `> ${line.trimEnd()}` : '>'));
  return [header, ...body, `^${blockId}`].join('\n') + '\n';
}

/** 기존 내용(없으면 null) 끝에 인용을 추가한 새 파일 내용 */
export function appendQuote(existing, title, page, text) {
  const base = existing ?? frontmatter(title);
  const blockId = nextBlockId(base, page);
  const trimmed = base.replace(/\s+$/, '');
  return {
    content: `${trimmed}\n\n${buildCallout(title, page, text, blockId)}`,
    blockId,
  };
}

/** 줄마다 끊긴 텍스트를 문단으로 합침 (빈 줄로 구분된 문단은 유지) */
export function joinLines(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n+/)
    .map((para) =>
      para
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .reduce((acc, line) => {
          if (!acc) return line;
          // 영어 하이픈 줄바꿈(exam-\nple)은 붙여 씀
          if (/[A-Za-z]-$/.test(acc) && /^[a-z]/.test(line)) return acc.slice(0, -1) + line;
          return `${acc} ${line}`;
        }, '')
        .replace(/ {2,}/g, ' ')
    )
    .filter(Boolean)
    .join('\n\n');
}

export function commitMessage(title, page) {
  return page ? `독서노트: ${title} p.${page}` : `독서노트: ${title}`;
}

// ---- UTF-8 안전 base64 ----
export function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function base64ToUtf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
