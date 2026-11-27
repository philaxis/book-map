/* 책 요청·알림함. user.js 가 불러오고, 로그인 상태는 user.js 의 "userstate" 이벤트({state, user, fb})로 받는다.
   - 설정창 '📥 책 요청': 메시지 + 선택 첨부. 첨부 있으면 '파일 넣어주세요'(kind=file), 없으면 '찾아주세요'(kind=find).
     첨부는 Google Picker 로 드라이브 '책/📥 요청함'(INTAKE_FOLDER)에 올린다(drive.file 권한, Firebase 로그인 클라이언트 재사용).
     Picker 가 안 되면 요청함을 열어 직접 올리고 파일 링크를 붙여 넣는다. INTAKE_FOLDER 가 비면 첨부 UI 를 숨긴다.
   - 🔔 알림함: 내 요청 상태·관리자 답장(users/{uid}/inbox), 안 읽은 개수. 관리자는 대기 요청을 승인/거절한다.
     파일 요청 승인 = public/intake.ids 에 파일 id 추가(로컬 파이프라인 book_db/intake.py 가 읽어 서재에 넣는다).
   - 관리자 '서재 새로고침': public/reload = {requestedAt, by} → 이 PC 감시기(book_db/reload.py)가 1분 안에 update.
     결과는 사이트의 status.json(state·newBooks·finishedAt…). 요청 뒤 30초마다 최대 30분 확인한다.
   Firestore: requests/{id} = {uid, email, name, kind, message, file{id,name,size,via}|null, status, reply, createdAt, decidedAt}
   권한은 firestore.rules 가 정한다(여기 ADMINS 는 화면 표시용). */
const INTAKE_FOLDER = "1FdsFLfVXVe6Cf3SOlE_tRF_aCkyk3feX";  // 드라이브 '책/📥 요청함' 폴더 id(HQ 가 폴더를 만든 뒤 채운다)
const ADMINS = ["jordy4777@gmail.com"];
const MAX_BYTES = 1024 ** 3;
const EXTS = ["pdf", "epub", "djvu", "djv", "mobi", "azw", "azw3", "hwp", "hwpx", "txt", "doc", "docx", "cbz", "cbr", "fb2", "chm"];
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const okName = n => EXTS.includes((String(n).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1]);
const mb = n => n ? (n >= 1024 ** 3 ? (n / 1024 ** 3).toFixed(2) + "GB" : (n / 1024 ** 2).toFixed(1) + "MB") : "";
const ms = ts => (ts && ts.toMillis ? ts.toMillis() : Date.now());
const day = ts => new Date(ms(ts)).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
const fileURL = id => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
const linkId = s => (String(s).match(/\/d\/([\w-]{10,})/) || String(s).match(/[?&]id=([\w-]{10,})/) || String(s).trim().match(/^([\w-]{20,})$/) || [])[1] || "";
function statusText(r) {
  if (r.status === "pending") return "대기";
  if (r.kind === "file") return r.status === "approved" ? "승인 · 서재에 넣음" : "거절";
  return r.status === "approved" ? "넣었음" : "못 찾음";
}

{
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("intake.css", import.meta.url).href;
  document.head.append(link);
}

let S = { state: "init", user: null, fb: null }, key = "";
let mine = [], inbox = [], pending = [];
let attached = null, note = "", sending = false, draft = "";
const unsubs = [];
let reloadReq = null, reloadSt = null, reloadNews = false, reloadBusy = false, pollT = 0;
const POLL_MS = 30 * 1000, POLL_MAX_MS = 30 * 60 * 1000;
const isAdmin = () => !!(S.user && ADMINS.includes(String(S.user.email || "").toLowerCase()));
const cloud = () => S.state === "cloud" && S.user && S.fb;

addEventListener("userstate", e => {
  S = e.detail || S;
  const k = S.state + ":" + (S.user ? S.user.uid : "");
  if (k === key) return;  // user.js 는 책 기록이 바뀔 때마다 알린다
  key = k;
  stop();
  attached = null; note = "";
  if (cloud()) start();
  render();
});

function start() {
  const { db, m } = S.fb, uid = S.user.uid;
  const sorted = snap => snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  const fail = what => err => console.warn(what, err);
  unsubs.push(m.onSnapshot(m.query(m.collection(db, "requests"), m.where("uid", "==", uid)), s => { mine = sorted(s); render(); }, fail("내 요청 동기화 끊김")));
  unsubs.push(m.onSnapshot(m.collection(db, "users", uid, "inbox"), s => { inbox = sorted(s); render(); }, fail("알림함 동기화 끊김")));
  if (isAdmin()) unsubs.push(m.onSnapshot(m.query(m.collection(db, "requests"), m.where("status", "==", "pending")), s => { pending = sorted(s); render(); }, fail("대기 요청 동기화 끊김")));
  if (isAdmin()) {
    unsubs.push(m.onSnapshot(m.doc(db, "public", "reload"), s => {
      const t = s.exists() ? s.data({ serverTimestamps: "estimate" }).requestedAt : null;
      reloadReq = t && t.toMillis ? t.toMillis() : null;
      loadStatus();
    }, fail("새로고침 요청 동기화 끊김")));
    unsubs.push(() => { clearTimeout(pollT); pollT = 0; });
  }
}
function stop() {
  while (unsubs.length) { try { unsubs.pop()(); } catch (_) { /* 이미 끊김 */ } }
  mine = []; inbox = []; pending = [];
  reloadReq = reloadSt = null; reloadNews = false;
  closeBox();
}

// ---------------------------------------------------------------- 🔔 알림함
const unread = () => inbox.filter(n => !n.read).length + (isAdmin() ? pending.length + (reloadNews ? 1 : 0) : 0);

// ---------------------------------------------------------------- 서재 새로고침(관리자)
const when = iso => iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const stMs = k => (reloadSt && Date.parse(reloadSt[k])) || 0;
// 요청 뒤에 시작한 실행이 있으면 그 실행이 요청을 맡은 것(이 PC 시계와 서버 시각 차이 2초 허용)
const covered = () => !reloadReq || stMs("startedAt") >= reloadReq - 2000;
const finished = () => covered() && reloadSt && reloadSt.state !== "running";
async function loadStatus() {
  clearTimeout(pollT); pollT = 0;
  const wasDone = finished();
  try {
    const r = await fetch(new URL("status.json", import.meta.url).href + "?t=" + Date.now(), { cache: "no-store" });
    reloadSt = r.ok ? await r.json() : null;
  } catch (_) { /* 아직 status.json 없음 */ }
  if (reloadReq && !wasDone && finished() && Date.now() - reloadReq < POLL_MAX_MS + POLL_MS) reloadNews = true;
  if (reloadReq && !finished() && Date.now() - reloadReq < POLL_MAX_MS) pollT = setTimeout(loadStatus, POLL_MS);
  render();
}
function reloadText() {
  const st = reloadSt, last = st && st.finishedAt ? `마지막 갱신: ${when(st.finishedAt)}` : "마지막 갱신: 기록 없음";
  if (!covered()) {
    return Date.now() - reloadReq < POLL_MAX_MS ? `요청함(${day({ toMillis: () => reloadReq })}) · 이 PC가 1분 안에 시작합니다 · ${last}`
      : `요청 뒤 30분이 지나도록 결과가 없습니다. 이 PC가 꺼져 있는지 확인하세요 · ${last}`;
  }
  if (!st) return last;
  if (st.state === "running") return `진행 중(${when(st.startedAt)} 시작)`;
  const res = st.state === "done" ? `완료 · 새 책 ${st.newBooks | 0}권` : st.state === "budget" ? "비용 상한에 닿아 멈춤" : "실패";
  const fresh = reloadReq && stMs("startedAt") >= reloadReq - 2000 && st.state === "done" ? " · 페이지를 새로고침하면 반영됩니다" : "";
  return `${last}, ${res}${fresh}${st.state !== "done" && st.message ? ` (${st.message})` : ""}`;
}
async function requestReload(btn) {
  if (!cloud() || !isAdmin() || reloadBusy) return;
  const { db, m } = S.fb;
  reloadBusy = true; btn.disabled = true;
  try { await m.setDoc(m.doc(db, "public", "reload"), { requestedAt: m.serverTimestamp(), by: S.user.uid }); }
  catch (err) { console.warn("새로고침 요청 실패", err); alert("요청하지 못했습니다: " + (err.code || err)); }
  reloadBusy = false;
  render();
}

function bellUI() {
  let bell = $("bell");
  if (!cloud()) { if (bell) bell.remove(); return; }
  if (!bell) {
    bell = document.createElement("button");
    bell.id = "bell"; bell.className = "ib"; bell.type = "button";
    bell.dataset.ik = "bell";
    const slot = $("user-slot");
    slot ? slot.before(bell) : $("top") && $("top").append(bell);
  }
  const n = unread();
  bell.title = n ? `알림 ${n}개` : "알림함";
  bell.setAttribute("aria-label", bell.title);
  bell.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>${n ? `<b class="ibadge">${n > 99 ? "99+" : n}</b>` : ""}`;
}

function reqHTML(r, admin) {
  const f = r.file;
  const file = f ? `<a class="ifile" href="${fileURL(f.id)}" target="_blank" rel="noopener">📎 ${esc(f.name || "첨부 파일")}${f.size ? ` · ${mb(f.size)}` : ""}</a>` : "";
  const head = admin ? `<b>${esc(r.name || r.email)}</b> <span>${esc(r.email)}</span>` : "";
  const acts = admin ? `<div class="iact"><input type="text" maxlength="1000" placeholder="짧은 답장(선택)" data-reply>
      <button class="btn ok" type="button" data-ik="approve" data-id="${esc(r.id)}">${r.kind === "file" ? "승인" : "넣었음"}</button>
      <button class="btn" type="button" data-ik="reject" data-id="${esc(r.id)}">${r.kind === "file" ? "거절" : "못 찾음"}</button></div>`
    : (r.reply ? `<div class="ireply">↳ ${esc(r.reply)}</div>` : "");
  return `<li class="ireq"><div class="imeta">${head}<em class="kind">${r.kind === "file" ? "📎 파일 넣어주세요" : "🔎 찾아주세요"}</em>
    ${admin ? "" : `<em class="st ${esc(r.status)}">${statusText(r)}</em>`}<time>${day(r.createdAt)}</time></div>
    <div class="imsg">${esc(r.message)}</div>${file}${acts}</li>`;
}

function boxUI() {
  const box = $("inbox");
  if (!box) return;
  const admin = isAdmin();
  const busy = reloadBusy || !covered() || (reloadSt && reloadSt.state === "running");
  const rel = admin ? `<h4>서재 새로고침</h4><div class="ireload"><button class="btn ok" type="button" data-ik="reload"${busy ? " disabled" : ""}>서재 새로고침</button>
      <span class="hint">${esc(reloadText())}</span></div>` : "";
  const adm = admin ? rel + `<h4>대기 요청 (${pending.length})</h4>${pending.length ? `<ul>${pending.map(r => reqHTML(r, true)).join("")}</ul>` : `<div class="none">새 요청이 없습니다.</div>`}` : "";
  const notes = inbox.slice(0, 30).map(n => `<li class="inote${n.read ? "" : " new"}"><div class="imeta"><em class="st ${esc(n.status)}">${statusText(n)}</em>
      <span class="imsg1">${esc(n.message || "")}</span><time>${day(n.createdAt)}</time></div>${n.reply ? `<div class="ireply">↳ ${esc(n.reply)}</div>` : ""}</li>`).join("");
  const reqs = mine.slice(0, 30).map(r => reqHTML(r, false)).join("");
  box.querySelector(".ibody").innerHTML = adm
    + `<h4>알림</h4>${notes ? `<ul>${notes}</ul>` : `<div class="none">아직 알림이 없습니다. 요청이 처리되면 여기 옵니다.</div>`}`
    + `<h4>내 요청 (${mine.length})</h4>${reqs ? `<ul>${reqs}</ul>` : `<div class="none">설정 → 📥 책 요청에서 보낼 수 있습니다.</div>`}`;
}

function openBox() {
  let box = $("inbox");
  if (!box) {
    box = document.createElement("div");
    box.id = "inbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "알림함");
    box.innerHTML = `<div class="ihead"><b>알림함</b><button class="ib" type="button" data-ik="close" aria-label="닫기">✕</button></div><div class="ibody"></div>`;
    document.body.append(box);
  }
  if (innerWidth <= 720) dispatchEvent(new Event("searchfold"));  // 폰: 결과 시트 접기
  box.hidden = false;
  if (reloadNews) { reloadNews = false; bellUI(); }
  boxUI();
  markRead();
}
function closeBox() { const box = $("inbox"); if (box) box.hidden = true; }

function markRead() {
  const fresh = inbox.filter(n => !n.read);
  if (!cloud() || !fresh.length) return;
  const { db, m } = S.fb, b = m.writeBatch(db);
  fresh.forEach(n => b.update(m.doc(db, "users", S.user.uid, "inbox", n.id), { read: true }));
  b.commit().catch(err => console.warn("읽음 표시 실패", err));
}

async function decide(id, approve, reply, btn) {
  const r = pending.find(x => x.id === id);
  if (!r || !cloud()) return;
  const { db, m } = S.fb, b = m.writeBatch(db);
  const status = approve ? "approved" : "rejected";
  reply = reply.trim().slice(0, 1000);
  b.update(m.doc(db, "requests", id), { status, reply, decidedAt: m.serverTimestamp() });
  b.set(m.doc(db, "users", r.uid, "inbox", id), {
    requestId: id, kind: r.kind, status, reply, message: String(r.message || "").slice(0, 200),
    createdAt: m.serverTimestamp(), read: false,
  });
  if (r.kind === "file" && r.file && r.file.id) {
    b.set(m.doc(db, "public", "intake"), {
      ids: approve ? m.arrayUnion(r.file.id) : m.arrayRemove(r.file.id), updatedAt: m.serverTimestamp(),
    }, { merge: true });
  }
  btn.disabled = true;
  try { await b.commit(); }
  catch (err) { btn.disabled = false; console.warn("처리 실패", err); alert("처리하지 못했습니다: " + (err.code || err)); }
}

// ---------------------------------------------------------------- 📥 책 요청(설정창)
function secUI() {
  let sec = $("intake-sec");
  if (S.state === "nofb") { if (sec) sec.remove(); return; }
  if (!sec) {
    sec = document.createElement("div");
    sec.className = "sec"; sec.id = "intake-sec";
    const after = $("user-sec");
    if (after) after.after(sec); else if ($("more")) $("more").prepend(sec); else return;
  }
  if (!cloud()) {
    sec.innerHTML = `<h4>📥 책 요청</h4><div class="none">${S.state === "denied" ? "아직 가족 목록에 추가되지 않은 계정이라 요청을 보낼 수 없어요. 관리자에게 이 이메일을 알려 주세요." : "로그인한 가족만 책 요청을 보낼 수 있습니다."}</div>`;
    return;
  }
  const ta = sec.querySelector("textarea");
  if (ta) draft = ta.value;
  const focused = ta && document.activeElement === ta;
  const att = attached
    ? `<div class="iatt">📎 ${esc(attached.name || "링크로 붙인 파일")}${attached.size ? ` · ${mb(attached.size)}` : ""} <button class="btn" type="button" data-ik="detach">빼기</button></div>`
    : INTAKE_FOLDER ? `<div class="row"><button class="btn" type="button" data-ik="pick">파일 첨부</button><span class="hint">pdf·epub·djvu·mobi·azw3·hwp 등, 1GB 이하</span></div>
      <details class="ilink"><summary>첨부가 안 되면</summary>
        <a href="https://drive.google.com/drive/folders/${encodeURIComponent(INTAKE_FOLDER)}" target="_blank" rel="noopener">📂 요청함 열기</a>에 직접 올리고 파일 링크를 붙여 넣으세요.
        <div class="row"><input type="url" placeholder="https://drive.google.com/file/d/…" data-link><button class="btn" type="button" data-ik="link">붙이기</button></div>
      </details>` : "";
  sec.innerHTML = `<h4>📥 책 요청</h4>
    <textarea maxlength="2000" placeholder="예: 이런 책 찾아서 넣어줄 수 있나요? (제목·저자)">${esc(draft)}</textarea>
    ${att}
    <div class="row isend"><span class="hint">${note ? esc(note) : attached ? "'파일 넣어주세요' 요청으로 보냅니다" : "'찾아주세요' 요청으로 보냅니다"}</span>
      <button class="btn ok" type="button" data-ik="send"${sending ? " disabled" : ""}>${sending ? "보내는 중…" : "보내기"}</button></div>`;
  if (focused) { const t = sec.querySelector("textarea"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
}

async function send() {
  const sec = $("intake-sec"), ta = sec && sec.querySelector("textarea");
  if (!cloud() || !ta || sending) return;
  const message = ta.value.trim() || (attached ? "이 파일 넣어주세요" : "");
  if (!message) { note = "메시지를 적어 주세요"; ta.focus(); return render(); }
  const { db, m } = S.fb;
  sending = true; draft = ta.value; render();
  try {
    await m.addDoc(m.collection(db, "requests"), {
      uid: S.user.uid, email: S.user.email, name: String(S.user.displayName || "").slice(0, 100),
      kind: attached ? "file" : "find", message: message.slice(0, 2000),
      file: attached ? { id: attached.id, name: attached.name, size: attached.size ?? null, via: attached.via } : null,
      status: "pending", createdAt: m.serverTimestamp(),
    });
    draft = ""; attached = null; note = "보냈습니다. 처리되면 🔔 알림함에 옵니다.";
    if (ta) ta.value = "";
  } catch (err) {
    console.warn("요청 보내기 실패", err);
    note = "보내지 못했습니다: " + (err.code || err);
  }
  sending = false;
  render();
}

// Google Picker: drive.file 권한 토큰은 Firebase 로그인 계정으로 다시 확인(팝업)해 받는다
let token = null, pickerP = null;
function loadPicker() {
  return pickerP ||= new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.onload = () => window.gapi.load("picker", { callback: ok, onerror: no });
    s.onerror = no;
    document.head.append(s);
  }).catch(err => { pickerP = null; throw err; });
}
async function driveToken() {
  if (token && token.exp > Date.now()) return token.v;
  const { m, auth } = S.fb;
  const p = new m.GoogleAuthProvider();
  p.addScope(DRIVE_SCOPE);
  p.setCustomParameters({ login_hint: S.user.email });
  const res = await m.reauthenticateWithPopup(auth.currentUser, p);
  const cred = m.GoogleAuthProvider.credentialFromResult(res);
  if (!cred || !cred.accessToken) throw new Error("드라이브 권한을 받지 못했습니다");
  token = { v: cred.accessToken, exp: Date.now() + 50 * 60 * 1000 };
  return token.v;
}
async function pick() {
  if (!cloud() || !INTAKE_FOLDER) return;
  let tok;
  try { [tok] = await Promise.all([driveToken(), loadPicker()]); }  // 팝업은 누른 즉시 열려야 막히지 않는다
  catch (err) {
    const code = err && err.code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    console.warn("파일 첨부 준비 실패", err);
    note = code === "auth/popup-blocked" ? "팝업이 막혔습니다. 팝업을 허용하거나 '첨부가 안 되면'을 쓰세요." : "파일 첨부를 열지 못했습니다. '첨부가 안 되면'을 쓰세요.";
    return render();
  }
  const g = window.google.picker, o = S.fb.auth.app.options;
  const view = new g.DocsUploadView().setParent(INTAKE_FOLDER).setIncludeFolders(false);
  new g.PickerBuilder()
    .addView(view)
    .setOAuthToken(tok)
    .setDeveloperKey(o.apiKey)
    .setAppId(o.messagingSenderId)  // 프로젝트 번호: drive.file 로 올린 파일에 이 앱이 접근할 수 있게
    .setLocale("ko")
    .setTitle("책 파일 올리기 (1GB 이하)")
    .setCallback(d => {
      if (d.action !== g.Action.PICKED || !d.docs || !d.docs.length) return;
      const doc = d.docs[0], size = Number(doc.sizeBytes || 0) || null;
      if (!okName(doc.name) || (size && size > MAX_BYTES)) {
        note = `받을 수 없는 파일입니다(${doc.name}). 책 파일(${EXTS.slice(0, 8).join("·")} 등), 1GB 이하만 됩니다.`;
        return render();
      }
      attached = { id: doc.id, name: String(doc.name).slice(0, 300), size, via: "picker" };
      note = "";
      render();
    })
    .build()
    .setVisible(true);
}

// ---------------------------------------------------------------- 화면·이벤트
function render() { bellUI(); secUI(); if ($("inbox") && !$("inbox").hidden) boxUI(); }

document.addEventListener("click", e => {
  const t = e.target.closest("[data-ik]");
  const box = $("inbox");
  if (box && !box.hidden && !e.target.closest("#inbox") && !(t && t.dataset.ik === "bell")) closeBox();
  if (!t) return;
  const act = t.dataset.ik;
  if (act === "bell") { box && !box.hidden ? closeBox() : openBox(); }
  else if (act === "close") closeBox();
  else if (act === "approve" || act === "reject") decide(t.dataset.id, act === "approve", (t.closest(".ireq").querySelector("[data-reply]") || {}).value || "", t);
  else if (act === "send") send();
  else if (act === "reload") requestReload(t);
  else if (act === "pick") pick();
  else if (act === "detach") { attached = null; note = ""; render(); }
  else if (act === "link") {
    const inp = $("intake-sec").querySelector("[data-link]"), id = linkId(inp ? inp.value : "");
    if (!id) { note = "드라이브 파일 링크를 알아보지 못했습니다"; return render(); }
    attached = { id, name: "", size: null, via: "link" };
    note = "";
    render();
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("inbox") && !$("inbox").hidden) closeBox(); });

if (window.bookUser) dispatchEvent(new CustomEvent("userstate", { detail: window.bookUser }));
else render();
