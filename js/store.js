// localStorage 래퍼: 설정, 제목 캐시, 책별 마지막 페이지, 전송 대기열
const K = {
  settings: 'rn.settings',
  titles: 'rn.titles',
  lastPage: 'rn.lastPage',
  queue: 'rn.queue',
  lastTitle: 'rn.lastTitle',
};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage 저장 실패', e.name);
  }
}

export const settings = {
  get: () => ({ owner: '', repo: '', branch: 'main', token: '', ...read(K.settings, {}) }),
  set: (s) => write(K.settings, s),
};

export const titles = {
  get: () => read(K.titles, []),
  set: (list) => write(K.titles, [...new Set(list)].sort((a, b) => a.localeCompare(b, 'ko'))),
  add: (t) => titles.set([...titles.get(), t]),
};

export const lastPage = {
  get: (title) => read(K.lastPage, {})[title] ?? null,
  set: (title, page) => {
    if (!page) return;
    write(K.lastPage, { ...read(K.lastPage, {}), [title]: page });
  },
};

export const lastTitle = {
  get: () => read(K.lastTitle, ''),
  set: (t) => write(K.lastTitle, t),
};

export const queue = {
  all: () => read(K.queue, []),
  push: (item) => write(K.queue, [...queue.all(), { id: crypto.randomUUID?.() ?? String(Date.now()), createdAt: Date.now(), ...item }]),
  remove: (id) => write(K.queue, queue.all().filter((q) => q.id !== id)),
};
