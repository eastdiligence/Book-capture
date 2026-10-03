// GitHub Contents API 클라이언트. 토큰은 절대 로그/에러 메시지에 넣지 않는다.
import { bookPath, appendQuote, commitMessage, utf8ToBase64, base64ToUtf8 } from './note.js';

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

// 앱이 쓸 수 있는 경로는 books/<파일>.md 하나뿐 (리뷰 파일 등 다른 파일 보호)
function assertWritable(path) {
  if (!/^books\/[^/]+\.md$/.test(path)) throw new Error(`쓰기 금지 경로: ${path}`);
}

async function request(cfg, method, path, { body, query, accept } = {}) {
  const url = new URL(`${API}/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: accept ?? 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).message ?? msg; } catch {}
    throw new GitHubError(res.status, `GitHub ${res.status}: ${msg}`);
  }
  return accept?.includes('raw') ? res.text() : res.json();
}

export function isConfigured(cfg) {
  return Boolean(cfg.owner && cfg.repo && cfg.branch && cfg.token);
}

export async function testConnection(cfg) {
  const repo = await request(cfg, 'GET', '');
  return { private: repo.private, canPush: repo.permissions?.push ?? null };
}

/** books/ 폴더의 .md 파일명 → 제목 목록 */
export async function listBookTitles(cfg) {
  try {
    const items = await request(cfg, 'GET', '/contents/books', { query: { ref: cfg.branch } });
    return items
      .filter((f) => f.type === 'file' && f.name.endsWith('.md'))
      .map((f) => f.name.slice(0, -3));
  } catch (e) {
    if (e.status === 404) return []; // books/ 폴더가 아직 없음
    throw e;
  }
}

/** 파일 내용과 sha. 없으면 { content: null, sha: null } */
async function getFile(cfg, path) {
  try {
    const f = await request(cfg, 'GET', `/contents/${encodePath(path)}`, { query: { ref: cfg.branch } });
    let content = f.content ? base64ToUtf8(f.content) : '';
    if (!f.content && f.size > 0) {
      // 1MB 초과 파일은 content가 비어 옴 → raw로 재조회
      content = await request(cfg, 'GET', `/contents/${encodePath(path)}`, {
        query: { ref: cfg.branch },
        accept: 'application/vnd.github.raw+json',
      });
    }
    return { content, sha: f.sha };
  } catch (e) {
    if (e.status === 404) return { content: null, sha: null };
    throw e;
  }
}

/** 책 파일의 현재 내용 (없으면 null). 중복 저장 경고용으로 저장 전에 미리 확인할 때 쓴다 */
export async function fetchBookContent(cfg, title) {
  return (await getFile(cfg, bookPath(title))).content;
}

/** 인용 하나를 책 파일 끝에 추가해 커밋. 충돌 시 재조회 후 1회 재시도 */
export async function commitQuote(cfg, { title, page, text }) {
  const path = bookPath(title);
  assertWritable(path);
  for (let attempt = 0; ; attempt++) {
    const { content, sha } = await getFile(cfg, path);
    const next = appendQuote(content, title, page, text);
    try {
      await request(cfg, 'PUT', `/contents/${encodePath(path)}`, {
        body: {
          message: commitMessage(title, page),
          content: utf8ToBase64(next.content),
          branch: cfg.branch,
          ...(sha ? { sha } : {}),
        },
      });
      return { path, blockId: next.blockId };
    } catch (e) {
      // 409: sha 불일치, 422: 그 사이 파일이 생성됨(sha 누락)
      if (attempt === 0 && (e.status === 409 || e.status === 422)) continue;
      throw e;
    }
  }
}
