/* 로그인·개인 기록: 내 서재(★ = 서재에 들인 책, 폴더로 정리), 읽고싶은 정도(1~5), 메모, 검색·책 탐색 기록.
   로그인 안 하면 이 브라우저(store = localStorage)에만, 가족 Google 계정으로 로그인하면 Firestore 에 저장·기기 간 동기화.
   Firestore: users/{uid}/books/{작품 id} = {star, want, memo, folder, updatedAt}(folder = 폴더 id, 최상위는 ""),
   users/{uid}/meta/folders = {폴더 id: {name, parent, order}, updatedAt}, users/{uid}/meta/history = {searches[], nav{items[], at}, updatedAt}
   권한은 보안 규칙(book_db/web/firestore.rules)의 가족 이메일 목록이 정한다. 목록 밖 계정은 '저장 권한 없음' 으로 로컬만 쓴다.
   아래 설정값(apiKey 등)은 공개돼도 되는 웹 앱 식별값이다. */
const FIREBASE = {
  apiKey: "AIzaSyCeZBrueUWjXYprgvAn2wOz-84kengg_d4",
  authDomain: "book-map-family.firebaseapp.com",
  projectId: "book-map-family",
  storageBucket: "book-map-family.firebasestorage.app",
  messagingSenderId: "412942769360",
  appId: "1:412942769360:web:2f57b03cf92b0d29f992d5",
};
const SDK = "https://www.gstatic.com/firebasejs/12.19.0";
const BOOKS_KEY = "bookmap-books", NAV_KEY = "bookmap-nav", SEARCH_KEY = "bookmap-search";
const FOLDERS_KEY = "bookmap-folders", CLOSED_KEY = "bookmap-shelf-closed";

const store = window.store || { get: (k, f = null) => f, set() {}, on() {}, off() {} };
const P = window.P || [];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const idOf = i => (P[i] && (P[i].id || P[i].f)) || "";
const pointsOf = new Map();  // 작품 id → 점 번호들
P.forEach((p, i) => { const id = idOf(i); if (id) { if (!pointsOf.has(id)) pointsOf.set(id, []); pointsOf.get(id).push(i); } });
const pointOf = id => (pointsOf.get(id) || [-1])[0];

// ---------------------------------------------------------------- 로컬 기록
// books[id] = {star, want, memo, folder, t}. 모두 비면 {t} 만 남겨(지운 표시) 첫 로그인 합치기에서 되살아나지 않게 한다.
let books = store.get(BOOKS_KEY, {}) || {};
const blank = b => !b || (!b.star && !b.want && !(b.memo || "").trim());
const book = id => books[id] || {};
function saveBooks() { applying = true; try { store.set(BOOKS_KEY, books); } finally { applying = false; } }
function setBook(id, patch, quiet = false) {
  if (!id) return;
  const b = { star: false, want: 0, memo: "", folder: "", ...book(id), ...patch, t: Date.now() };
  if (!b.star) b.folder = "";
  books[id] = blank(b) ? { t: b.t } : b;
  saveBooks();
  pushBook(id);
  if (!quiet) refresh();
}

// ---------------------------------------------------------------- 내 서재 폴더
// fold = {map: {폴더 id: {name, parent, order}}, t, u}. parent "" = 최상위. 책은 정확히 한 폴더(books[id].folder, "" = 최상위).
// u = 이 목록을 마지막으로 맞춘 로그인 uid(그 사람 클라우드의 거울이면 첫 합치기에서 합치지 않고 새것으로 바꾼다).
const FID = /^f[a-z0-9]{3,40}$/;
function normFolders(v) {
  const map = {}, src = v && v.map && typeof v.map === "object" ? v.map : {};
  for (const [id, f] of Object.entries(src)) {
    if (FID.test(id) && f && typeof f === "object" && typeof f.name === "string")
      map[id] = { name: f.name.slice(0, 80), parent: typeof f.parent === "string" ? f.parent : "", order: +f.order || 0 };
  }
  for (const [id, f] of Object.entries(map)) {  // 없는 부모·자기 자신으로 도는 고리는 최상위로
    const seen = new Set([id]);
    for (let p = f.parent; p; p = map[p].parent) {
      if (!map[p] || p === id) { f.parent = ""; break; }
      if (seen.has(p)) break;
      seen.add(p);
    }
  }
  return { map, t: +(v && v.t) || 0, u: (v && v.u) || "" };
}
let fold = normFolders(store.get(FOLDERS_KEY, null));
const folderOf = b => (b && b.star && b.folder && fold.map[b.folder]) ? b.folder : "";
function saveFolders() { fold.t = Date.now(); store.set(FOLDERS_KEY, fold); pushFolders(); }
const kids = pid => Object.entries(fold.map).filter(([, f]) => f.parent === pid)
  .sort((a, b) => a[1].order - b[1].order || a[1].name.localeCompare(b[1].name, "ko"));
const nextOrder = pid => Math.max(0, ...kids(pid).map(([, f]) => f.order)) + 1;
function under(fid, anc) {  // fid 가 anc 이거나 그 아래(anc "" = 서재 전체)
  if (!anc) return true;
  for (let p = fid, k = 0; p && k < 200; p = fold.map[p] ? fold.map[p].parent : "", k++) if (p === anc) return true;
  return false;
}
function newFolder(parent, name) {
  const id = "f" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  fold.map[id] = { name, parent: fold.map[parent] ? parent : "", order: nextOrder(parent) };
  saveFolders();
  closed.delete(parent);
  return id;
}
function moveFolder(fid, parent) {
  const f = fold.map[fid];
  if (!f || f.parent === parent || (parent && (!fold.map[parent] || under(parent, fid)))) return;
  f.parent = parent;
  f.order = nextOrder(parent);
  saveFolders();
}
function deleteFolder(fid) {  // 안의 하위 폴더·책은 부모로 올린다(서재에서 빼지 않음)
  const f = fold.map[fid];
  if (!f) return;
  for (const [, c] of kids(fid)) { c.parent = f.parent; c.order = nextOrder(f.parent); }
  const inside = Object.keys(books).filter(id => books[id].star && books[id].folder === fid);
  delete fold.map[fid];
  saveFolders();
  for (const id of inside) setBook(id, { folder: f.parent }, true);
}
const moveBook = (id, folder) => { if (book(id).star && folderOf(book(id)) !== folder) setBook(id, { folder: fold.map[folder] ? folder : "" }); };

// ---------------------------------------------------------------- 클라우드(Firebase)
let fb = null;        // { auth, db, m: 모듈 함수 모음 }
let user = null;      // 로그인한 사용자
let state = "init";   // init | out | checking | cloud | denied | nofb(SDK 못 불러옴)
let applying = false; // 원격 값을 store 에 쓰는 중(되돌려 올리지 않는다)
const unsubs = [];
const pending = new Map();  // id → 타이머(메모 연타를 모아 올린다)
let histTimer = 0;

async function loadFirebase() {
  const [app, auth, fs] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
  ]);
  const a = app.initializeApp(FIREBASE);
  let db;
  try {
    db = fs.initializeFirestore(a, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch (_) { db = fs.getFirestore(a); }  // 오프라인 캐시를 못 쓰는 브라우저(사생활 모드 등)
  fb = { auth: auth.getAuth(a), db, m: { ...auth, ...fs } };
  fb.m.onAuthStateChanged(fb.auth, onUser);
}

const bookRef = id => fb.m.doc(fb.db, "users", user.uid, "books", id);
const histRef = () => fb.m.doc(fb.db, "users", user.uid, "meta", "history");
const foldRef = () => fb.m.doc(fb.db, "users", user.uid, "meta", "folders");
const ms = ts => (ts && ts.toMillis ? ts.toMillis() : 0);
const fromCloud = c => ({ star: !!c.star, want: c.want | 0, memo: c.memo || "", folder: typeof c.folder === "string" ? c.folder : "", t: ms(c.updatedAt) || Date.now() });
function foldersFromDoc(d) {
  const map = { ...d };
  delete map.updatedAt;
  return normFolders({ map, t: ms(d.updatedAt) });
}

async function onUser(u) {
  stopSync();
  user = u;
  if (!u) { state = "out"; refresh(); return; }
  state = "checking"; refresh();
  let hist = null;
  try {
    const snap = await fb.m.getDoc(histRef());
    hist = snap.exists() ? snap.data() : null;
    state = "cloud";
  } catch (err) {
    if (err && err.code === "permission-denied") { state = "denied"; refresh(); return; }
    state = "cloud";  // 오프라인 등: 캐시·대기열로 계속
  }
  if (user !== u) return;
  try { await firstMerge(hist); } catch (err) { console.warn("기록 합치기 실패", err); }
  startSync();
  refresh();
}

// 첫 로그인(또는 다시 로그인): 로컬과 클라우드를 책마다 최근 것으로 합치고, 로컬이 더 새것이면 올린다.
async function firstMerge(hist) {
  const snap = await fb.m.getDocs(fb.m.collection(fb.db, "users", user.uid, "books"));
  const cloud = new Map();
  snap.forEach(d => cloud.set(d.id, d.data()));
  const ups = [];
  for (const [id, c] of cloud) {
    const l = books[id];
    if (!l || ms(c.updatedAt) > (l.t || 0)) books[id] = fromCloud(c);
    else if ((l.t || 0) > ms(c.updatedAt)) ups.push(id);
  }
  for (const id of Object.keys(books)) if (!cloud.has(id) && !blank(books[id])) ups.push(id);
  saveBooks();
  for (const id of ups) writeBook(id);

  // 폴더: 이 사람 클라우드의 거울이면 새것으로, 로그인 전에 만든 목록이면 클라우드와 합친다(id 가 겹치지 않는다).
  let cf = null;
  try { const s = await fb.m.getDoc(foldRef()); if (s.exists()) cf = foldersFromDoc(s.data()); } catch (err) { console.warn("폴더 불러오기 실패", err); }
  if (cf) {
    if (fold.u === user.uid) { if (cf.t >= fold.t) fold = cf; }
    else fold = normFolders({ map: { ...cf.map, ...fold.map }, t: Math.max(cf.t, fold.t) });
  }
  fold.u = user.uid;
  store.set(FOLDERS_KEY, fold);
  if (cf ? JSON.stringify(cf.map) !== JSON.stringify(fold.map) : Object.keys(fold.map).length) writeFolders();

  const local = store.get(SEARCH_KEY, []) || [];
  const remote = (hist && Array.isArray(hist.searches)) ? hist.searches : [];
  const merged = [...local, ...remote].filter((q, k, a) => q && a.indexOf(q) === k).slice(0, 20);
  const nav = store.get(NAV_KEY, null);
  applying = true;
  try {
    store.set(SEARCH_KEY, merged);
    // 책 탐색 기록은 이 기기에 없을 때만 클라우드 것을 가져온다(다음에 열 때 반영)
    if ((!nav || !(nav.items || []).length) && hist && hist.nav && (hist.nav.items || []).length) {
      const items = hist.nav.items.map(pointOf).filter(i => i >= 0);
      if (items.length) store.set(NAV_KEY, { items, at: Math.min(Math.max(0, hist.nav.at | 0), items.length - 1) });
    }
  } finally { applying = false; }
  writeHistory();
}

function startSync() {
  if (!fb || !user || state !== "cloud") return;
  unsubs.push(fb.m.onSnapshot(fb.m.collection(fb.db, "users", user.uid, "books"), snap => {
    let changed = false;
    snap.docChanges().forEach(ch => {
      if (ch.doc.metadata.hasPendingWrites) return;
      const id = ch.doc.id, l = books[id];
      if (ch.type === "removed") {
        if (l && !blank(l)) { books[id] = { t: Date.now() }; changed = true; }
        return;
      }
      const c = ch.doc.data(), t = ms(c.updatedAt);
      if (!l || t > (l.t || 0)) { books[id] = fromCloud(c); changed = true; }
    });
    if (changed) { saveBooks(); refresh(); }
  }, err => console.warn("기록 동기화 끊김", err)));
  unsubs.push(fb.m.onSnapshot(histRef(), snap => {
    if (snap.metadata.hasPendingWrites || !snap.exists()) return;
    const h = snap.data();
    if (Array.isArray(h.searches) && JSON.stringify(h.searches) !== JSON.stringify(store.get(SEARCH_KEY, []))) {
      applying = true;
      try { store.set(SEARCH_KEY, h.searches.slice(0, 20)); } finally { applying = false; }
    }
  }, () => {}));
  unsubs.push(fb.m.onSnapshot(foldRef(), snap => {
    if (snap.metadata.hasPendingWrites || !snap.exists()) return;
    const cf = foldersFromDoc(snap.data());
    if (cf.t > fold.t) { fold = { ...cf, u: user.uid }; store.set(FOLDERS_KEY, fold); refresh(); }
  }, err => console.warn("폴더 동기화 끊김", err)));
}
function stopSync() {
  while (unsubs.length) { try { unsubs.pop()(); } catch (_) { /* 이미 끊김 */ } }
  for (const t of pending.values()) clearTimeout(t);
  pending.clear();
  clearTimeout(foldTimer);
}

function writeBook(id) {
  if (!fb || !user || state !== "cloud") return Promise.resolve(false);
  const b = books[id];
  const p = blank(b) ? fb.m.deleteDoc(bookRef(id))
    : fb.m.setDoc(bookRef(id), { star: !!b.star, want: b.want | 0, memo: (b.memo || "").slice(0, 2000), folder: folderOf(b), updatedAt: fb.m.Timestamp.fromMillis(b.t) });
  return p.then(() => true, err => { console.warn("기록 저장 실패", id, err); return false; });
}
function pushBook(id, delay = 0) {
  if (state !== "cloud") return;
  clearTimeout(pending.get(id));
  pending.set(id, setTimeout(() => { pending.delete(id); writeBook(id).then(ok => onSaved(id, ok)); }, delay));
}
let foldTimer = 0;
function writeFolders() {
  if (!fb || !user || state !== "cloud") return;
  const d = {};
  for (const [id, f] of Object.entries(fold.map)) d[id] = { name: f.name, parent: f.parent, order: f.order };
  d.updatedAt = fb.m.Timestamp.fromMillis(fold.t || Date.now());
  fb.m.setDoc(foldRef(), d).catch(err => console.warn("폴더 저장 실패", err));
}
function pushFolders() {
  if (state !== "cloud") return;
  clearTimeout(foldTimer);
  foldTimer = setTimeout(writeFolders, 300);
}
function writeHistory() {
  if (!fb || !user || state !== "cloud") return;
  const nav = store.get(NAV_KEY, null) || {};
  const items = (nav.items || []).map(idOf).filter(Boolean);
  fb.m.setDoc(histRef(), {
    searches: (store.get(SEARCH_KEY, []) || []).slice(0, 20),
    nav: { items: items.slice(-50), at: Math.max(0, Math.min(nav.at | 0, items.length - 1)) },
    updatedAt: fb.m.serverTimestamp(),
  }).catch(err => console.warn("탐색 기록 저장 실패", err));
}
function historyChanged() {
  if (applying || state !== "cloud") return;
  clearTimeout(histTimer);
  histTimer = setTimeout(writeHistory, 2000);
}
store.on(NAV_KEY, historyChanged);
store.on(SEARCH_KEY, historyChanged);

async function signIn() {
  if (!fb) return;
  const provider = new fb.m.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try { await fb.m.signInWithPopup(fb.auth, provider); }
  catch (err) {
    const code = err && err.code;
    if (code === "auth/popup-blocked") {  // 페이지를 떠나는 리디렉트 로그인은 쓰지 않는다
      alert("로그인 창이 막혔습니다. 브라우저에서 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.");
    } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
      console.warn("로그인 실패", err);
      alert("로그인하지 못했습니다: " + (code || err));
    }
  }
}
async function signOut() {
  if (!fb) return;
  const wasCloud = state === "cloud";
  await fb.m.signOut(fb.auth);
  if (wasCloud) {  // 클라우드에 남아 있으니 이 기기의 개인 기록은 지운다(같은 기기를 쓰는 다른 가족과 섞이지 않게)
    books = {};
    saveBooks();
    fold = normFolders(null);
    store.set(FOLDERS_KEY, fold);
    applying = true;
    try { store.set(SEARCH_KEY, []); store.set(NAV_KEY, { items: [], at: -1 }); } finally { applying = false; }
    refresh();
  }
}

// ---------------------------------------------------------------- 화면
const slot = $("user-slot"), sec = $("user-sec"), panel = $("panel"), card = $("card");
let panelI = -1, cardI = -1, savedNote = null;

function slotUI() {
  if (!slot) return;
  if (state === "nofb") { slot.innerHTML = ""; return; }
  if (state === "init" || state === "checking") { slot.innerHTML = `<button class="ub busy" type="button" aria-label="로그인 확인 중">…</button>`; return; }
  if (!user) { slot.innerHTML = `<button class="ub" type="button" data-u="in" title="Google 계정으로 로그인">로그인</button>`; return; }
  const pic = user.photoURL ? `<img src="${esc(user.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc((user.displayName || user.email || "?")[0])}</span>`;
  slot.innerHTML = `<button class="ub av" type="button" data-u="menu" title="${esc(user.email || "")} · 내 기록">${pic}</button>`;
}

function secUI() {
  if (!sec) return;
  sec.hidden = false;
  let st;
  if (state === "cloud") st = `<b>${esc(user.email)}</b> · 클라우드 저장 <button class="btn" data-u="out">로그아웃</button>`;
  else if (state === "denied") st = `<b>${esc(user.email)}</b> · <span class="warn">아직 가족 목록에 추가되지 않은 계정이라 클라우드 저장·책 요청을 쓸 수 없어요. 관리자에게 이 이메일을 알려 주세요.</span> (★·메모는 이 기기에만 저장) <button class="btn" data-u="out">로그아웃</button>`;
  else if (state === "checking" || state === "init") st = `확인 중… · 이 기기에 저장`;
  else if (state === "nofb") st = `로그인을 쓸 수 없음 · 이 기기에만 저장`;
  else st = `로그인 안 함 · 이 기기에만 저장 <button class="btn" data-u="in">Google 로그인</button>`;
  const nb = shelfCount();
  sec.innerHTML = `<h4>내 기록</h4><div class="ust">${st}</div>`
    + `<div class="ust" style="margin-top:8px">📚 내 서재 ${nb}권 <button class="btn" data-u="shelf">내 서재 열기</button></div>`;
}

function mineHTML(i) {
  const b = book(idOf(i)), memo = (b.memo || "").trim();
  const dots = [1, 2, 3, 4, 5].map(k => `<button type="button" data-want="${k}" aria-label="읽고싶음 ${k}"><i class="${(b.want | 0) >= k ? "on" : ""}"></i></button>`).join("");
  const f = folderOf(b), where = b.star ? `<button class="fl" type="button" data-u="shelf" title="내 서재에서 보기">📁 ${f ? esc(fold.map[f].name) : "최상위"}</button>` : "";
  return `<div class="mrow"><button class="st${b.star ? " on" : ""}" type="button" data-star aria-pressed="${!!b.star}" title="${b.star ? "내 서재에서 빼기" : "내 서재에 담기"}">${b.star ? "★ 내 서재에서 빼기" : "☆ 내 서재에 담기"}</button>${where}
    <span class="want" title="읽고싶은 정도(다시 누르면 해제)">읽고싶음 ${dots}</span></div>
    <div class="memo"><button class="mclosed${memo ? " has" : ""}" type="button" data-memo>${memo ? esc(memo.split("\n")[0]) : "메모 쓰기…"}</button></div>`;
}
function panelUI() {
  if (!panel || panelI < 0 || !panel.classList.contains("open")) return;
  const el = panel.querySelector(".mine");
  if (!el || el.contains(document.activeElement) && document.activeElement.tagName === "TEXTAREA") return;
  el.innerHTML = mineHTML(panelI);
}
function cardUI() {
  const btn = card && card.querySelector(".cb.star");
  if (!btn || cardI < 0) return;
  const on = !!book(idOf(cardI)).star;
  btn.hidden = false;
  btn.textContent = on ? "★" : "☆";
  btn.classList.toggle("on", on);
  btn.setAttribute("aria-label", on ? "내 서재에서 빼기" : "내 서재에 담기");
  btn.title = on ? "내 서재에서 빼기" : "내 서재에 담기";
}
function marks() {
  const pts = [];
  for (const [id, b] of Object.entries(books)) if (b.star) for (const i of pointsOf.get(id) || []) pts.push(i);
  dispatchEvent(new CustomEvent("bookmarks", { detail: pts }));
}
function refresh() {
  slotUI(); secUI(); panelUI(); cardUI(); marks(); shelfUI();
  dispatchEvent(new Event("userlib"));  // 지도: 내 서재·읽고싶음 버블의 점 집합을 다시 받는다
  dispatchEvent(new CustomEvent("userstate", { detail: (window.bookUser = { state, user, fb }) }));  // intake.js(책 요청·알림함)
}

function onSaved(id, ok) {
  if (!savedNote || savedNote.id !== id) return;
  savedNote.el.textContent = ok ? "저장됨 · 클라우드" : "이 기기에 저장됨(클라우드 실패)";
}

addEventListener("bookpanel", e => { panelI = e.detail; panelUI(); });
addEventListener("bookcard", e => { cardI = e.detail; cardUI(); });
addEventListener("bookselect", e => {
  if (e.detail < 0) { panelI = cardI = -1; }
  if (selI !== e.detail) { selI = e.detail; if (shelfOpen) shelfUI(); }
});

document.addEventListener("click", e => {
  const u = e.target.closest("[data-u]");
  if (u) {
    const act = u.dataset.u;
    if (act === "in") signIn();
    else if (act === "out") signOut();
    else if (act === "shelf") setShelf(!shelfOpen || !u.closest("#shelf-btn"));
    else if (act === "menu") {
      if (!$("ctl").classList.contains("open")) $("toggle").click();
      sec && sec.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    return;
  }
  if (e.target.closest("#card .cb.star") && cardI >= 0) { const id = idOf(cardI); setBook(id, { star: !book(id).star, folder: "" }); return; }
  const mine = e.target.closest("#panel .mine");
  if (!mine || panelI < 0) return;
  const id = idOf(panelI);
  if (e.target.closest("[data-star]")) { setBook(id, { star: !book(id).star, folder: "" }); return; }
  const w = e.target.closest("[data-want]");
  if (w) { const k = +w.dataset.want; setBook(id, { want: (book(id).want | 0) === k ? 0 : k }); return; }
  if (e.target.closest("[data-memo]")) openMemo(mine.querySelector(".memo"), id);
});

// ---------------------------------------------------------------- 내 서재 패널
// 상단 '📚 내 서재' 버튼(로그인했거나 들인 책이 있을 때)으로 연다. 폴더 트리 + 책, 데스크톱은 끌어 옮기고 터치는 '이동' 시트.
// 지도 보기: 전체 ↔ 내 서재만(골라 둔 폴더면 그 하위까지) = 지도의 '내 서재' 조건 버블(window.chips, 상태는 지도 URL 해시).
// 지도는 window.userLib 로 점 집합을 묻고, 책·폴더가 바뀌면 'userlib' 이벤트를 받는다.
const viewNow = () => { const c = window.chips && window.chips.get("mine"); return { on: !!c, folder: c && fold.map[c.v] ? c.v : "" }; };
const closed = new Set(store.get(CLOSED_KEY, []) || []);
let shelfOpen = false, selI = -1, moving = null, drag = null;
const shelfBtn = document.createElement("button");
shelfBtn.id = "shelf-btn";
shelfBtn.className = "ub";
shelfBtn.type = "button";
shelfBtn.dataset.u = "shelf";
shelfBtn.title = "내 서재";
shelfBtn.hidden = true;
shelfBtn.innerHTML = `<span aria-hidden="true">📚</span><span class="tx">내 서재</span>`;
if (slot) slot.parentNode.insertBefore(shelfBtn, slot);
const shelfEl = document.createElement("aside");
shelfEl.id = "shelf";
shelfEl.setAttribute("aria-label", "내 서재");
document.body.appendChild(shelfEl);

const shelved = () => Object.keys(books).filter(id => books[id].star && pointOf(id) >= 0);
const shelfCount = () => shelved().length;
const showBtn = () => !!user || shelfCount() > 0;
const title = id => P[pointOf(id)].t || "";

function setShelf(open) {
  if (open && !showBtn()) open = false;
  if (open && $("ctl") && $("ctl").classList.contains("open")) $("toggle").click();  // 설정창과 겹치지 않게
  if (open && innerWidth <= 720) dispatchEvent(new Event("searchfold"));  // 폰: 결과 시트 접기
  shelfOpen = open;
  moving = null;
  shelfEl.classList.toggle("open", open);
  shelfBtn.classList.toggle("on", open);
  shelfUI();
}
function setView(on, folder = "") {
  if (!window.chips) return;
  if (on) window.chips.set({ k: "mine", v: fold.map[folder] ? folder : "" });
  else window.chips.remove("mine");
}
window.userLib = {
  points: folder => shelved().filter(id => under(folderOf(books[id]), fold.map[folder] ? folder : "")).flatMap(id => pointsOf.get(id) || []),
  want: min => Object.keys(books).filter(id => (books[id].want | 0) >= min).flatMap(id => pointsOf.get(id) || []),
  folderName: fid => (fold.map[fid] || {}).name || "",
  folders: () => { const out = []; const walk = (pid, d) => { for (const [k, f] of kids(pid)) { out.push([k, f.name, d]); walk(k, d + 1); } }; walk("", 0); return out; },
};
addEventListener("chipschange", () => { if (shelfOpen) shelfUI(); });

function shelfUI() {
  shelfBtn.hidden = !showBtn();
  if (shelfBtn.hidden && shelfOpen) { shelfOpen = false; shelfEl.classList.remove("open"); shelfBtn.classList.remove("on"); }
  if (!shelfOpen) return;
  const ids = shelved(), byF = new Map(), view = viewNow();
  for (const id of ids) { const f = folderOf(books[id]); if (!byF.has(f)) byF.set(f, []); byF.get(f).push(id); }
  for (const a of byF.values()) a.sort((x, y) => title(x).localeCompare(title(y), "ko"));
  const counts = new Map();
  const count = fid => {
    if (!counts.has(fid)) counts.set(fid, (byF.get(fid) || []).length + kids(fid).reduce((s, [k]) => s + count(k), 0));
    return counts.get(fid);
  };
  const bookRow = (id, depth) => {
    const i = pointOf(id), b = books[id];
    return `<div class="bk${i === selI ? " cur" : ""}" draggable="true" data-drag="b:${esc(id)}" data-pt="${i}" style="--d:${depth}">`
      + `<span class="bt" title="${esc(title(id))}">${esc(title(id))}</span>${b.want ? `<em>읽고싶음 ${b.want}</em>` : ""}`
      + `<span class="act"><button type="button" class="mv" data-sh="mvb" data-id="${esc(id)}">이동</button>`
      + `<button type="button" data-sh="out" data-id="${esc(id)}" title="내 서재에서 빼기" aria-label="내 서재에서 빼기">✕</button></span></div>`;
  };
  const folderBlock = (fid, depth) => {
    const f = fold.map[fid], open = !closed.has(fid), on = view.on && view.folder === fid;
    const inner = open ? kids(fid).map(([k]) => folderBlock(k, depth + 1)).join("") + (byF.get(fid) || []).map(id => bookRow(id, depth + 1)).join("") : "";
    return `<div class="fd" data-drop="${esc(fid)}"><div class="fr${on ? " on" : ""}" draggable="true" data-drag="f:${esc(fid)}" style="--d:${depth}">`
      + `<button type="button" class="tw" data-sh="tw" data-f="${esc(fid)}" aria-expanded="${open}" aria-label="${open ? "접기" : "펼치기"}">${open ? "▾" : "▸"}</button>`
      + `<span class="fn" data-sh="tw" data-f="${esc(fid)}">📁 ${esc(f.name)}</span><span class="fc">${count(fid)}</span>`
      + `<span class="act"><button type="button" data-sh="focus" data-f="${esc(fid)}" title="지도에 이 폴더만" aria-label="지도에 이 폴더만">◎</button>`
      + `<button type="button" data-sh="new" data-f="${esc(fid)}" title="하위 폴더 만들기" aria-label="하위 폴더 만들기">＋</button>`
      + `<button type="button" data-sh="ren" data-f="${esc(fid)}" title="이름 바꾸기" aria-label="이름 바꾸기">✎</button>`
      + `<button type="button" class="mv" data-sh="mvf" data-f="${esc(fid)}">이동</button>`
      + `<button type="button" data-sh="del" data-f="${esc(fid)}" title="폴더 삭제(안의 책·폴더는 위로)" aria-label="폴더 삭제">🗑</button></span></div>`
      + (open ? `<div class="fk">${inner}</div>` : "") + `</div>`;
  };
  const tree = kids("").map(([k]) => folderBlock(k, 0)).join("") + (byF.get("") || []).map(id => bookRow(id, 0)).join("");
  const where = view.on ? (view.folder ? `📁 ${esc(fold.map[view.folder].name)} (하위 포함)` : "서재 전체") : "";
  const note = state === "cloud" ? "클라우드에 저장" : state === "denied" ? "가족 목록에 없는 계정 · 이 기기에만 저장" : "로그인 안 함 · 이 기기에만 저장";
  const sc = shelfEl.querySelector(".sh-tree"), top = sc ? sc.scrollTop : 0;
  shelfEl.innerHTML = `<div class="sh-head"><b>📚 내 서재</b><span class="sh-n">${ids.length}권</span>`
    + `<button type="button" class="sh-x" data-sh="close" aria-label="닫기">×</button></div>`
    + `<div class="seg sh-view"><button type="button" data-sh="all" class="${view.on ? "" : "on"}">전체 보기</button>`
    + `<button type="button" data-sh="mine" class="${view.on ? "on" : ""}">내 서재만</button></div>`
    + (view.on ? `<div class="sh-where">지도: ${where}${view.folder ? ` <button type="button" class="btn" data-sh="mine">서재 전체</button>` : ""}</div>` : "")
    + `<div class="sh-tools"><button type="button" class="btn" data-sh="new" data-f="">＋ 새 폴더</button></div>`
    + `<div class="sh-tree" data-drop="">${tree || `<div class="none">정보 패널의 ☆ 내 서재에 담기로 마음에 둔 책을 들이세요.</div>`}`
    + (ids.length || kids("").length ? `<div class="sh-root">최상위 — 여기로 끌어 놓으면 폴더 밖으로</div>` : "") + `</div>`
    + `<div class="sh-note">${note}</div>` + (moving ? moveSheet() : "");
  const sc2 = shelfEl.querySelector(".sh-tree");
  if (sc2) sc2.scrollTop = top;
}

function moveSheet() {
  const { kind, id } = moving, here = kind === "b" ? folderOf(book(id)) : (fold.map[id] || {}).parent;
  const rows = [["", "최상위", 0]];
  const walk = (pid, d) => { for (const [k, f] of kids(pid)) { rows.push([k, f.name, d]); walk(k, d + 1); } };
  walk("", 1);
  const name = kind === "b" ? title(id) : (fold.map[id] || {}).name;
  return `<div class="sh-move" role="dialog" aria-label="옮길 폴더"><div class="mh">'${esc(name)}' 옮길 곳</div><div class="ml">`
    + rows.map(([k, nm, d]) => {
      const bad = kind === "f" && k && under(k, id);
      return `<button type="button" data-sh="to" data-f="${esc(k)}" style="--d:${d}"${bad ? " disabled" : ""}${k === here ? ' class="here"' : ""}>${k ? "📁 " : ""}${esc(nm)}${k === here ? " · 지금 여기" : ""}</button>`;
    }).join("") + `</div><button type="button" class="btn" data-sh="cancel">취소</button></div>`;
}

const askName = (msg, v = "") => { const s = prompt(msg, v); return s == null ? null : s.trim().slice(0, 80) || null; };
shelfEl.addEventListener("click", e => {
  const t = e.target.closest("[data-sh]");
  if (!t) {
    const r = e.target.closest(".bk[data-pt]");
    if (r && window.select) { window.select(+r.dataset.pt, true, false); if (innerWidth <= 720) setShelf(false); }
    return;
  }
  const a = t.dataset.sh, f = t.dataset.f || "", id = t.dataset.id;
  if (a === "close") setShelf(false);
  else if (a === "all") setView(false);
  else if (a === "mine") setView(true, "");
  else if (a === "focus") setView(true, f);
  else if (a === "tw") { closed.has(f) ? closed.delete(f) : closed.add(f); store.set(CLOSED_KEY, [...closed]); shelfUI(); }
  else if (a === "new") { const nm = askName(f ? `'${fold.map[f].name}' 안에 만들 폴더 이름` : "새 폴더 이름"); if (nm) { newFolder(f, nm); refresh(); } }
  else if (a === "ren") { const nm = askName("폴더 이름", fold.map[f].name); if (nm && nm !== fold.map[f].name) { fold.map[f].name = nm; saveFolders(); refresh(); } }
  else if (a === "del") {
    if (confirm(`'${fold.map[f].name}' 폴더를 지울까요? 안의 책과 하위 폴더는 위 폴더로 옮겨집니다(서재에서 빠지지 않음).`)) { deleteFolder(f); refresh(); }
  }
  else if (a === "out") setBook(id, { star: false, folder: "" });
  else if (a === "mvb" || a === "mvf") { moving = a === "mvb" ? { kind: "b", id } : { kind: "f", id: f }; shelfUI(); }
  else if (a === "cancel") { moving = null; shelfUI(); }
  else if (a === "to" && moving) {
    const m = moving;
    moving = null;
    if (m.kind === "b") moveBook(m.id, f); else moveFolder(m.id, f);
    refresh();
  }
});

// 데스크톱: 책·폴더를 끌어 다른 폴더(또는 최상위 빈 곳)에 놓는다
shelfEl.addEventListener("dragstart", e => {
  const el = e.target.closest && e.target.closest("[data-drag]");
  if (!el) return;
  const [kind, ...rest] = el.dataset.drag.split(":");
  drag = { kind, id: rest.join(":") };
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", el.dataset.drag);
  el.classList.add("dragging");
});
shelfEl.addEventListener("dragover", e => {
  const z = e.target.closest("[data-drop]");
  if (!z || !drag || (drag.kind === "f" && z.dataset.drop && under(z.dataset.drop, drag.id))) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  for (const o of shelfEl.querySelectorAll(".over")) if (o !== z) o.classList.remove("over");
  z.classList.add("over");
});
shelfEl.addEventListener("drop", e => {
  const z = e.target.closest("[data-drop]");
  if (!z || !drag) return;
  e.preventDefault();
  const d = drag, to = z.dataset.drop;
  drag = null;
  if (d.kind === "b") moveBook(d.id, to); else moveFolder(d.id, to);
  refresh();
});
shelfEl.addEventListener("dragend", () => {
  drag = null;
  for (const o of shelfEl.querySelectorAll(".over,.dragging")) o.classList.remove("over", "dragging");
});
const tg = $("toggle");
if (tg) tg.addEventListener("click", () => { if (shelfOpen && $("ctl").classList.contains("open")) setShelf(false); });  // 설정창을 열면 닫는다

function openMemo(box, id) {
  box.innerHTML = `<textarea maxlength="2000" placeholder="몇 줄 메모(자동 저장)">${esc(book(id).memo || "")}</textarea><div class="msave"></div>`;
  const ta = box.querySelector("textarea"), note = box.querySelector(".msave");
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  let timer = 0;
  const save = () => {
    clearTimeout(timer);
    if ((book(id).memo || "") === ta.value) return;
    const b = { star: false, want: 0, ...book(id), memo: ta.value, t: Date.now() };
    books[id] = blank(b) ? { t: b.t } : b;
    saveBooks();
    savedNote = { id, el: note };
    note.textContent = state === "cloud" ? "저장 중…" : "저장됨 · 이 기기";
    pushBook(id);
    secUI(); cardUI(); marks(); shelfUI();
  };
  ta.addEventListener("input", () => { note.textContent = ""; clearTimeout(timer); timer = setTimeout(save, 700); });
  ta.addEventListener("blur", () => { save(); if (!ta.value.trim()) setTimeout(panelUI, 0); });
}

refresh();
import("./intake.js").catch(err => console.warn("책 요청 기능을 불러오지 못했습니다", err));
loadFirebase().catch(err => {
  console.warn("Firebase 를 불러오지 못했습니다(이 기기 저장만)", err);
  state = "nofb";
  refresh();
});
