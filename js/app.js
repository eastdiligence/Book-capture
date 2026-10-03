import * as ocr from './ocr/index.js';
import * as gh from './github.js';
import * as store from './store.js';
import { joinLines, findSimilarTitle, normalizeTitle, sanitizeFileName, findDuplicateQuote } from './note.js';
import { RELEASES } from './releases.js';

export const APP_VERSION = '1.3.0';

const $ = (id) => document.getElementById(id);
const el = {
  home: $('home'), edit: $('edit'), settings: $('settings'),
  titleInput: $('titleInput'), titleSuggest: $('titleSuggest'),
  cameraInput: $('cameraInput'), albumInput: $('albumInput'),
  photo: $('photo'), editTitle: $('editTitle'), pageInput: $('pageInput'),
  pageSuggest: $('pageSuggest'), textInput: $('textInput'),
  pendingBtn: $('pendingBtn'), pendingCount: $('pendingCount'),
  progress: $('progress'), progressLabel: $('progressLabel'), progressBar: $('progressBar'),
  modal: $('modal'), modalText: $('modalText'), modalButtons: $('modalButtons'),
  zoom: $('zoom'), zoomImg: $('zoomImg'), toast: $('toast'), configHint: $('configHint'),
  lastSaved: $('lastSaved'),
};

let photoUrl = null;
let editingTitle = '';

// ---------- 공통 UI ----------
function show(screen) {
  for (const s of [el.home, el.edit, el.settings]) s.hidden = s !== screen;
  window.scrollTo(0, 0);
}

let toastTimer;
function toast(msg, ms = 3000) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.toast.hidden = true), ms);
}

function setProgress(label, ratio) {
  el.progressLabel.textContent = label;
  el.progressBar.style.width = `${Math.round((ratio ?? 0) * 100)}%`;
}

/** 버튼 선택 모달. buttons: [{ label, value, primary? }] → 선택된 value */
function ask(text, buttons) {
  return new Promise((resolve) => {
    el.modalText.textContent = text;
    el.modalButtons.replaceChildren(
      ...buttons.map((b) => {
        const btn = document.createElement('button');
        btn.textContent = b.label;
        if (b.primary) btn.className = 'primary';
        btn.onclick = () => {
          el.modal.hidden = true;
          resolve(b.value);
        };
        return btn;
      })
    );
    el.modal.hidden = false;
  });
}

function cfg() {
  return store.settings.get();
}

function updateConfigHint() {
  el.configHint.hidden = gh.isConfigured(cfg());
}

// ---------- 책 제목 자동완성 ----------
function renderSuggest() {
  const q = normalizeTitle(el.titleInput.value);
  const list = store.titles.get().filter((t) => !q || normalizeTitle(t).includes(q)).slice(0, 8);
  if (!list.length || (list.length === 1 && list[0] === el.titleInput.value)) {
    el.titleSuggest.hidden = true;
    return;
  }
  el.titleSuggest.replaceChildren(
    ...list.map((t) => {
      const li = document.createElement('li');
      li.textContent = t;
      // blur보다 먼저 처리되도록 pointerdown 사용
      li.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.titleInput.value = t;
        store.lastTitle.set(t);
        el.titleSuggest.hidden = true;
        updateLastSavedHint();
      });
      return li;
    })
  );
  el.titleSuggest.hidden = false;
}

function updateLastSavedHint() {
  const title = el.titleInput.value.trim();
  const page = title ? store.lastPage.get(title) : null;
  el.lastSaved.hidden = !page;
  if (page) el.lastSaved.textContent = `마지막 저장: ${title} · p.${page}`;
}

el.titleInput.addEventListener('input', renderSuggest);
el.titleInput.addEventListener('input', updateLastSavedHint);
el.titleInput.addEventListener('focus', renderSuggest);
el.titleInput.addEventListener('blur', () => {
  setTimeout(() => (el.titleSuggest.hidden = true), 150);
  store.lastTitle.set(el.titleInput.value.trim());
});

async function refreshTitles({ silent = true } = {}) {
  const c = cfg();
  if (!gh.isConfigured(c) || !navigator.onLine) return;
  try {
    const remote = await gh.listBookTitles(c);
    store.titles.set([...store.titles.get(), ...remote]);
    if (!silent) toast(`책 ${remote.length}권을 불러왔습니다`);
  } catch (e) {
    if (!silent) toast(errorMessage(e));
  }
}

// ---------- 사진 → OCR ----------
function requireTitle() {
  const t = el.titleInput.value.trim();
  if (!sanitizeFileName(t)) {
    toast('책 제목을 먼저 입력하세요');
    el.titleInput.focus();
    return null;
  }
  return t;
}

$('cameraBtn').onclick = () => requireTitle() && el.cameraInput.click();
$('albumBtn').onclick = () => requireTitle() && el.albumInput.click();
el.cameraInput.onchange = el.albumInput.onchange = (e) => {
  const file = e.target.files?.[0];
  e.target.value = ''; // 같은 파일 다시 선택 가능하게
  if (file) startOcr(file);
};

async function startOcr(file) {
  const title = requireTitle();
  if (!title) return;
  editingTitle = title;
  store.lastTitle.set(title);

  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = URL.createObjectURL(file);
  el.photo.src = photoUrl;

  setProgress('준비 중', 0);
  el.progress.hidden = false;
  let result = { text: '', page: null };
  try {
    result = await ocr.recognize(file, { onProgress: setProgress });
  } catch (e) {
    console.error(e);
    toast(`OCR 실패: ${e.message ?? e}. 직접 입력할 수 있어요.`, 5000);
  } finally {
    el.progress.hidden = true;
  }
  openEditor(title, result);
}

function openEditor(title, { text, page }) {
  el.editTitle.textContent = title;
  el.textInput.value = text;
  el.pageInput.value = page ?? '';

  const last = store.lastPage.get(title);
  if (!page && last) {
    el.pageSuggest.textContent = `직전 p.${last} → p.${last + 1} 사용`;
    el.pageSuggest.dataset.page = last + 1;
    el.pageSuggest.hidden = false;
  } else {
    el.pageSuggest.hidden = true;
  }
  show(el.edit);
}

el.pageSuggest.onclick = () => {
  el.pageInput.value = el.pageSuggest.dataset.page;
  el.pageSuggest.hidden = true;
};
el.pageInput.addEventListener('input', () => {
  el.pageInput.value = el.pageInput.value.replace(/\D/g, '');
});

$('joinBtn').onclick = () => {
  el.textInput.value = joinLines(el.textInput.value);
};

el.photo.onclick = () => {
  el.zoomImg.src = el.photo.src;
  el.zoom.hidden = false;
};
el.zoom.onclick = () => (el.zoom.hidden = true);

function leaveEditor() {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = null;
  el.photo.removeAttribute('src');
  el.zoomImg.removeAttribute('src');
  el.textInput.value = '';
  show(el.home);
}

$('cancelBtn').onclick = async () => {
  if (el.textInput.value.trim()) {
    const ok = await ask('작성 중인 내용을 버릴까요?', [
      { label: '계속 편집', value: false },
      { label: '버리기', value: true, primary: true },
    ]);
    if (!ok) return;
  }
  leaveEditor();
};

// ---------- 저장 ----------
$('saveBtn').onclick = async () => {
  const text = el.textInput.value.trim();
  if (!text) return toast('본문이 비어 있습니다');
  const page = el.pageInput.value ? Number(el.pageInput.value) : null;

  let title = editingTitle;
  const similar = findSimilarTitle(title, store.titles.get());
  if (similar) {
    const choice = await ask(`비슷한 제목의 책이 이미 있습니다.\n\n기존: ${similar}\n입력: ${title}`, [
      { label: '기존 제목에 저장', value: 'existing', primary: true },
      { label: '새 책으로 저장', value: 'new' },
      { label: '취소', value: 'cancel' },
    ]);
    if (choice === 'cancel') return;
    if (choice === 'existing') title = similar;
  }

  if (gh.isConfigured(cfg()) && navigator.onLine) {
    try {
      const content = await gh.fetchBookContent(cfg(), title);
      const dup = findDuplicateQuote(content, page, text);
      if (dup) {
        const preview = dup.length > 60 ? `${dup.slice(0, 60)}…` : dup;
        const proceed = await ask(`${page ? `p.${page}에` : '이미'} 비슷한 내용이 저장되어 있어요.\n\n"${preview}"\n\n그래도 저장할까요?`, [
          { label: '취소', value: false },
          { label: '그래도 저장', value: true, primary: true },
        ]);
        if (!proceed) return;
      }
    } catch {
      // 중복 확인 실패는 저장을 막지 않음 (네트워크 문제 등)
    }
  }

  store.queue.push({ title, page, text });
  store.titles.add(title);
  store.lastPage.set(title, page);
  store.lastTitle.set(title);
  el.titleInput.value = title;
  updateLastSavedHint();
  leaveEditor();
  updatePending();

  if (!gh.isConfigured(cfg())) {
    toast('설정이 없어 대기열에 보관했습니다');
    return;
  }
  await flushQueue({ announce: true });
};

// ---------- 대기열 ----------
let flushing = false;

function updatePending() {
  const n = store.queue.all().length;
  el.pendingCount.textContent = n;
  el.pendingBtn.hidden = n === 0;
}

function errorMessage(e) {
  if (e instanceof gh.GitHubError) {
    if (e.status === 401) return '토큰이 올바르지 않거나 만료되었습니다';
    if (e.status === 403) return '권한이 없습니다 (토큰의 Contents 쓰기 권한 확인)';
    if (e.status === 404) return '저장소/브랜치를 찾을 수 없습니다 (설정 확인)';
    return e.message;
  }
  if (e instanceof TypeError) return '네트워크 오류';
  return e?.message ?? String(e);
}

async function flushQueue({ announce = false } = {}) {
  if (flushing || !gh.isConfigured(cfg())) return;
  flushing = true;
  el.pendingBtn.disabled = true;
  let sent = 0;
  try {
    for (const item of store.queue.all()) {
      const res = await gh.commitQuote(cfg(), item);
      store.queue.remove(item.id);
      sent++;
      updatePending();
      if (announce) toast(`저장됨: ${res.path.slice(6)} ^${res.blockId}`);
    }
    if (!announce && sent) toast(`대기 중이던 ${sent}건을 전송했습니다`);
  } catch (e) {
    console.warn('전송 실패:', errorMessage(e));
    const left = store.queue.all().length;
    toast(`${errorMessage(e)} · ${left}건 대기 중 (나중에 자동 재전송)`, 5000);
  } finally {
    flushing = false;
    el.pendingBtn.disabled = false;
    updatePending();
  }
}

el.pendingBtn.onclick = () => {
  if (!gh.isConfigured(cfg())) return toast('설정을 먼저 저장하세요');
  flushQueue({ announce: false });
};
window.addEventListener('online', () => {
  flushQueue();
  refreshTitles();
});

// ---------- 설정 ----------
const sf = {
  owner: $('sOwner'), repo: $('sRepo'), branch: $('sBranch'), token: $('sToken'),
  ocrEngine: $('sOcrEngine'), ocrProxyUrl: $('sOcrProxyUrl'), ocrProxySecret: $('sOcrProxySecret'),
};

function updateOcrProxyVisibility() {
  const needsProxy = sf.ocrEngine.value !== 'tesseract';
  $('sOcrProxyField').hidden = !needsProxy;
  $('sOcrSecretField').hidden = !needsProxy;
  $('sOcrProxyHint').hidden = !needsProxy;
}
sf.ocrEngine.onchange = updateOcrProxyVisibility;

function openSettings() {
  const c = cfg();
  sf.owner.value = c.owner;
  sf.repo.value = c.repo;
  sf.branch.value = c.branch;
  sf.token.value = '';
  sf.ocrEngine.value = c.ocrEngine;
  sf.ocrProxyUrl.value = c.ocrProxyUrl;
  sf.ocrProxySecret.value = '';
  updateOcrProxyVisibility();
  $('tokenState').textContent = c.token ? '(저장됨)' : '(없음)';
  $('ocrSecretState').textContent = c.ocrProxySecret ? '(저장됨)' : '(없음)';
  show(el.settings);
}

function readSettingsForm() {
  const c = cfg();
  return {
    owner: sf.owner.value.trim(),
    repo: sf.repo.value.trim(),
    branch: sf.branch.value.trim() || 'main',
    token: sf.token.value.trim() || c.token,
    ocrEngine: sf.ocrEngine.value,
    ocrProxyUrl: sf.ocrProxyUrl.value.trim(),
    ocrProxySecret: sf.ocrProxySecret.value.trim() || c.ocrProxySecret,
  };
}

$('settingsBtn').onclick = openSettings;
$('backBtn').onclick = () => show(el.home);

$('saveSettingsBtn').onclick = async () => {
  store.settings.set(readSettingsForm());
  sf.token.value = '';
  updateConfigHint();
  toast('설정을 저장했습니다');
  show(el.home);
  await refreshTitles();
  flushQueue();
};

$('clearTokenBtn').onclick = () => {
  store.settings.set({ ...cfg(), token: '' });
  $('tokenState').textContent = '(없음)';
  updateConfigHint();
  toast('토큰을 삭제했습니다');
};

$('testBtn').onclick = async () => {
  const c = readSettingsForm();
  if (!gh.isConfigured(c)) return toast('모든 항목을 입력하세요');
  try {
    const r = await gh.testConnection(c);
    const warn = r.private ? '' : ' ⚠️ 공개 저장소입니다!';
    toast(`연결 성공${r.canPush === false ? ' (쓰기 권한 없음)' : ''}${warn}`, 4000);
  } catch (e) {
    toast(`연결 실패: ${errorMessage(e)}`, 4000);
  }
};

// ---------- 릴리즈 노트 ----------
$('releaseNotesBtn').onclick = () => {
  const text = RELEASES.map((r) => `v${r.version} (${r.date})\n${r.notes.map((n) => `· ${n}`).join('\n')}`).join('\n\n');
  ask(text, [{ label: '닫기', value: true, primary: true }]);
};

// ---------- 시작 ----------
$('appVersion').textContent = APP_VERSION;
el.titleInput.value = store.lastTitle.get();
updateLastSavedHint();
updateConfigHint();
updatePending();
refreshTitles().then(() => flushQueue());
// 첫 사진 전에 OCR 엔진/언어 데이터를 미리 받아둠
if (navigator.onLine) setTimeout(() => ocr.warmUp(), 1500);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW 등록 실패', e));
  // 백그라운드에서 새 서비스워커가 활성화되면 즉시 새로고침해 낡은 모듈이 계속 쓰이지 않게 함
  let refreshed = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshed) return;
    refreshed = true;
    location.reload();
  });
}
