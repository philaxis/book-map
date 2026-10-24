/* 설정창 시안 공통(settings-a~d.js 가 import). 시안마다 배치만 다르고 내용물은 여기서 같이 쓴다.
   - 지도 다리: 본편 모듈이 내보낸 window.MAP(S·changed…)과 숨긴 옛 컨트롤(#presets·#iso…)을 눌러 진짜로 바꾼다
   - 선택지: 프리셋·색·크기·보기 방식·고급(축) + 미리보기(팔레트·그라데이션·점 크기)
   - 개인: 로그인·내 서재는 user.js 를 진짜로 부르고(data-u), 책 요청·알림함은 모양만(보내지 않음)
   - 조건 버블 바(본편에 곧 생길 필터 칩): 데스크톱 검색창 아래 / 폰 아래 카드 위. 필터는 설정창이 아니라 여기서 켜고 ✕·ESC 로 푼다
   - 시트(데스크톱 가운데 창 / 폰 하단 시트)·토스트·시안 이동 배지 */

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const narrow = () => innerWidth <= 720;
export const el = html => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
export const ready = new Promise(res => (window.MAP ? res(window.MAP) : addEventListener("mapready", () => res(window.MAP), { once: true })));

// ---------------------------------------------------------------- 아이콘
const line = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  layers: line('<path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>'),
  palette: line('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .9-1.9 2-1.9H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/>'),
  size: line('<circle cx="7.5" cy="15.5" r="3"/><circle cx="16" cy="9.5" r="5"/>'),
  more: line('<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>'),
  map: line('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>'),
  shelf: line('<path d="M5 4h3.5v16H5zM10.5 4H14v16h-3.5zM15.6 5.2l3.2-.9 3.4 14.6-3.2.9z"/>'),
  request: line('<path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M4 13h4l1.5 2.5h5L16 13h4"/><path d="M12 3v8M8.5 7.5 12 11l3.5-3.5"/>'),
  bell: line('<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  user: line('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
  search: line('<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>'),
  sliders: line('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  close: line('<path d="M6 6l12 12M18 6 6 18"/>'),
  chev: line('<path d="m6 9 6 6 6-6"/>'),
  check: line('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  cmd: line('<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z"/>'),
  eye: line('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
};
// 프리셋 미리보기(작은 그림): 주제끼리 모임 / 아래→위 난이도 / 아래 이론·위 응용
const dot = (x, y, c, r = 2.1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const arrow = both => `<path d="M5 24V4M2.6 6.6 5 4l2.4 2.6${both ? "M2.6 21.4 5 24l2.4-2.6" : ""}" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>`;
export const PICT = {
  topic: `<svg viewBox="0 0 40 28" aria-hidden="true">${[[9, 9], [13, 6.5], [12, 12], [7, 13]].map(([x, y]) => dot(x, y, "#4e79a7")).join("")}${[[28, 7], [32, 11], [27, 12], [31, 5]].map(([x, y]) => dot(x, y, "#f28e2b")).join("")}${[[18, 21], [23, 19], [21, 24], [16, 25]].map(([x, y]) => dot(x, y, "#59a14f")).join("")}</svg>`,
  diff: `<svg viewBox="0 0 40 28" aria-hidden="true">${arrow(false)}${[[13, 23], [19, 24], [26, 23], [33, 24]].map(([x, y]) => dot(x, y, "#2c6e9e")).join("")}${[[15, 15], [23, 14], [31, 15.5]].map(([x, y]) => dot(x, y, "#22a08a")).join("")}${[[20, 6], [28, 7]].map(([x, y]) => dot(x, y, "#e0b81f")).join("")}</svg>`,
  th: `<svg viewBox="0 0 40 28" aria-hidden="true">${arrow(true)}${[[14, 21], [20, 23], [27, 20], [33, 22.5]].map(([x, y]) => dot(x, y, "#3b2c84")).join("")}${[[17, 7], [24, 5], [31, 8.5]].map(([x, y]) => dot(x, y, "#d4612a")).join("")}</svg>`,
};

// ---------------------------------------------------------------- 선택지
export const PRESETS = [
  { k: "topic", label: "주제 지도", desc: "비슷한 주제끼리 모여요" },
  { k: "diff", label: "난이도", desc: "위로 갈수록 어려운 책" },
  { k: "th", label: "이론↔응용", desc: "아래는 이론, 위는 응용" },
];
export const COLORS = [
  { k: "k1", label: "큰 분야", group: "분야" },
  { k: "k2", label: "세부 분야", group: "분야" },
  { k: "d", label: "난이도", group: "점수", note: "10단계" },
  { k: "gm", label: "교양↔전공", group: "점수" },
  { k: "th", label: "이론↔응용", group: "점수" },
  { k: "m", label: "수식", group: "점수" },
  { k: "l", label: "언어", group: "자료" },
  { k: "kd", label: "자료 종류", group: "자료" },
];
export const SIZES = [
  { k: "none", label: "균일" }, { k: "w", label: "읽고싶음" }, { k: "d", label: "난이도" }, { k: "gm", label: "교양↔전공" }, { k: "pg", label: "쪽수" },
];
// 보기 방식: 본편은 0(책 하나)·1(파트로 나눠 = 중앙 노드+파트). '파트 여러 점'은 곧 들어올 것이라 시안에선 모양만.
export const VIEWS = [
  { k: "one", label: "평균 하나", desc: "책마다 점 하나", split: 0 },
  { k: "hub", label: "중앙 노드", desc: "가운데 점 + 파트", split: 1 },
  { k: "parts", label: "파트 여러 점", desc: "파트마다 따로", split: 1, shape: true },
];
export const labelOf = (list, k) => (list.find(o => o.k === k) || {}).label || k;

// ---------------------------------------------------------------- 지도 다리
const M = () => window.MAP;
let viewK = null;
export const map = {
  get S() { return M().S; },
  preset() {  // 축(배치)이 같은 프리셋. 색·크기는 따로 바꿔도 프리셋은 켜진 채로 보인다.
    const S = M().S;
    return (Object.entries(M().PRESETS).find(([, p]) => p.x === S.x && p.y === S.y && p.z === S.z) || [null])[0];
  },
  setPreset(k) {  // 본편 프리셋 버튼(카메라도 처음 자리로)을 누르되, 고른 색·크기는 지킨다
    const { color, size } = M().S;
    const b = $(`#presets button[data-p="${k}"]`); if (!b) return;
    b.click();
    if (M().S.color !== color || M().S.size !== size) { Object.assign(M().S, { color, size }); M().changed(false); }
  },
  setColor(k) { M().S.color = k; M().changed(false); },
  setSize(k) { M().S.size = k; M().changed(false); },
  setAxis(key, v) { M().S[key] = v; M().changed(true); },
  get view() { return viewK && VIEWS.find(v => v.k === viewK).split === M().partsMode ? viewK : (M().partsMode ? "hub" : "one"); },
  setView(k) {
    const v = VIEWS.find(o => o.k === k); if (!v) return;
    viewK = k;
    if (v.split !== M().partsMode) $(`#splitmode button[data-split="${v.split}"]`).click();
    if (v.shape) toast("시안: ‘파트 여러 점’은 아직 본편에 없어 중앙 노드로 보여 줘요");
    notify();
  },
  get isoOn() { return $("#iso").classList.contains("on"); },
  get isoCan() { return !$("#iso").disabled; },
  toggleIso() { if (this.isoCan) $("#iso").click(); else toast("먼저 지도에서 책 하나를 고르세요"); },
  get rotating() { return $("#rot").classList.contains("on"); },
  toggleRotate() { $("#rot").click(); },
  reset() { $("#reset").click(); },
  theme() { $("#theme").click(); },
  get k() { return M().S.k; },
  setK(v) { const r = $("#k"); r.value = v; r.dispatchEvent(new Event("input")); },
  get dark() { return getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() !== "#fafaf9"; },
};

// 상태 변화 구독: 본편 changed() 는 #presets 를 다시 그린다. 선택(#iso)·회전·보기 방식·로그인·서재 보기도 지켜본다.
const subs = new Set();
let queued = false;
export function onChange(fn) { subs.add(fn); ready.then(fn); }
export function notify() {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; subs.forEach(f => f()); });
}
let shelfView = false;
ready.then(() => {
  try { shelfView = !!((window.store && window.store.get("bookmap-shelfview", null)) || {}).on; } catch (_) { /* 기본값 */ }
  const mo = new MutationObserver(notify);
  mo.observe($("#presets"), { childList: true });
  for (const id of ["#iso", "#rot"]) mo.observe($(id), { attributes: true, attributeFilter: ["class", "disabled"] });
  mo.observe($("#splitmode"), { attributes: true, subtree: true, attributeFilter: ["class"] });
  for (const id of ["#user-slot", "#user-sec"]) mo.observe($(id), { childList: true, subtree: true, attributes: true, characterData: true });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  mo.observe($("#fbody"), { childList: true, subtree: true });  // 필터(조건 버블)
  mo.observe($("#status"), { childList: true, characterData: true, subtree: true });  // 보이는 책 수
  $("#q").addEventListener("input", notify);  // 검색어 버블
  const body = () => {
    document.body.classList.toggle("sx-panel", $("#panel").classList.contains("open"));
    document.body.classList.toggle("sx-card", $("#card").classList.contains("open"));
    document.body.classList.toggle("sx-results", $("#results").classList.contains("on") && !$("#results").classList.contains("fold"));
    const sh = $("#shelf"); document.body.classList.toggle("sx-shelf", !!sh && sh.classList.contains("open"));
    document.documentElement.style.setProperty("--sx-cardh", ($("#card").offsetHeight || 64) + "px");
    notify();
  };
  const bo = new MutationObserver(body);
  for (const id of ["#panel", "#card", "#results"]) bo.observe($(id), { attributes: true, attributeFilter: ["class"] });
  const watchShelf = () => { const sh = $("#shelf"); if (sh) { bo.observe(sh, { attributes: true, attributeFilter: ["class"] }); return true; } return false; };
  if (!watchShelf()) setTimeout(watchShelf, 800);
  addEventListener("bookfocus", e => { shelfView = Array.isArray(e.detail); notify(); });
  body();
});

// ---------------------------------------------------------------- 미리보기
export function colorPreview(k) {
  const c = M().COLORS[k];
  if (c) return `<span class="sx-pal">${c.pal.slice(0, 5).map(x => `<i style="background:${x}"></i>`).join("")}</span>`;
  return `<span class="sx-ramp" style="background:linear-gradient(90deg,${M().RAMP.join(",")})"></span>`;
}
export function colorEnds(k) {
  const v = M().VARS[k];
  return v && v.ends ? v.ends : null;
}
export function sizePreview(k) {
  const rs = k === "none" ? [3, 3, 3] : [1.8, 3, 4.4];
  return `<svg class="sx-szp" viewBox="0 0 30 12" aria-hidden="true">${rs.map((r, i) => `<circle cx="${5 + i * 10}" cy="6" r="${r}"/>`).join("")}</svg>`;
}
// 범례: 범주면 이름·개수, 점수면 그라데이션과 양 끝
export function legendHTML(k, max = 99) {
  const c = M().COLORS[k];
  if (c) {
    const counts = new Array(c.names.length).fill(0);
    for (const p of window.P) counts[c.get(p)]++;
    const items = c.names.map((nm, i) => [nm, counts[i], c.pal[i % c.pal.length]]).filter(x => x[1]);
    const shown = items.slice(0, max);
    return `<div class="sx-lg">${shown.map(([nm, cnt, col]) => `<span class="it" data-name="${esc(nm)}"><i style="background:${col}"></i>${esc(nm)} <em>${cnt}</em></span>`).join("")}${items.length > max ? `<span class="it more">외 ${items.length - max}개</span>` : ""}</div>`;
  }
  const v = M().VARS[k], e = v.ends || ["", ""];
  return `<div class="sx-lg ramp"><span>${esc(e[0])}</span><i style="background:linear-gradient(90deg,${M().RAMP.join(",")})"></i><span>${esc(e[1])}</span>${v.missing ? `<em>값 없음 ${v.missing}</em>` : ""}</div>`;
}

// ---------------------------------------------------------------- 공통 조각(HTML) + 이벤트
// 조각은 data-* 로 동작을 단다. bind(root) 한 번이면 그 안의 모든 조각이 지도와 이어진다.
export const presetCards = (cls = "") => PRESETS.map(p =>
  `<button type="button" class="sx-preset ${cls}" data-preset="${p.k}"><span class="pic">${PICT[p.k]}</span><b>${p.label}</b><small>${p.desc}</small></button>`).join("");
export const presetSeg = () => `<div class="sx-seg" role="radiogroup" aria-label="프리셋">${PRESETS.map(p =>
  `<button type="button" data-preset="${p.k}" role="radio">${p.label}</button>`).join("")}</div>`;
export const colorList = ({ groups = true } = {}) => {
  let last = "", out = "";
  for (const o of COLORS) {
    if (groups && o.group !== last) { out += `<div class="sx-gh">${o.group}</div>`; last = o.group; }
    const ends = colorEnds(o.k);
    out += `<button type="button" class="sx-opt" data-color="${o.k}"><span class="lab">${o.label}${o.note ? ` <small>${o.note}</small>` : ""}</span>${colorPreview(o.k)}${ends ? `<span class="ends"><small>${esc(ends[0])}</small><small>${esc(ends[1])}</small></span>` : ""}<span class="ck">${ICON.check}</span></button>`;
  }
  return `<div class="sx-opts">${out}</div>`;
};
export const sizeChips = () => `<div class="sx-chips">${SIZES.map(o => `<button type="button" class="sx-chip" data-size="${o.k}">${sizePreview(o.k)}${o.label}</button>`).join("")}</div>`;
const VIEW_PICT = {
  one: `<svg viewBox="0 0 30 18" aria-hidden="true"><circle cx="15" cy="9" r="3.4" fill="currentColor"/></svg>`,
  hub: `<svg viewBox="0 0 30 18" aria-hidden="true"><path d="M15 9 6 4M15 9l9-4M15 9v7" stroke="currentColor" stroke-width="1.2" opacity=".5"/><circle cx="15" cy="9" r="3" fill="currentColor"/><circle cx="6" cy="4" r="2" fill="currentColor" opacity=".7"/><circle cx="24" cy="5" r="2" fill="currentColor" opacity=".7"/><circle cx="15" cy="16" r="2" fill="currentColor" opacity=".7"/></svg>`,
  parts: `<svg viewBox="0 0 30 18" aria-hidden="true"><circle cx="7" cy="5" r="2.2" fill="currentColor"/><circle cx="22" cy="6" r="2.2" fill="currentColor"/><circle cx="14" cy="14" r="2.2" fill="currentColor"/></svg>`,
};
export const viewSeg = () => `<div class="sx-seg sx-views">${VIEWS.map(v =>
  `<button type="button" data-view="${v.k}" title="${v.desc}">${VIEW_PICT[v.k]}<span>${v.label}</span></button>`).join("")}</div>`;
export const switchRow = (act, label, hint = "") =>
  `<button type="button" class="sx-sw" data-act="${act}" role="switch"><span class="t">${label}${hint ? `<small>${hint}</small>` : ""}</span><i></i></button>`;
export function advancedHTML({ tools = true } = {}) {
  const V = M().VARS, keys = M().AXIS_KEYS;
  const opts = (sel, allowNone) => keys.filter(k => allowNone || k !== "none").map(k => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(V[k].label)}</option>`).join("");
  return `<div class="sx-axes">${[["x", "가로"], ["y", "깊이"], ["z", "높이"]].map(([a, lab]) =>
    `<label><span>${lab}</span><select data-axis="${a}">${opts(M().S[a], a !== "x")}</select></label>`).join("")}</div>
    <div class="sx-krow"><span>이웃 수</span><input type="range" min="5" max="30" data-k value="${M().S.k}"><b data-kv>${M().S.k}</b></div>
    ${tools ? `<div class="sx-tools"><button type="button" class="sx-btn" data-act="rot">자동 회전</button><button type="button" class="sx-btn" data-act="reset">처음 보기</button><button type="button" class="sx-btn" data-act="theme">밝게/어둡게</button></div>` : ""}
    <div class="sx-note">필터(분류·난이도·언어…)는 설정창이 아니라 조건 버블 바의 ＋ 조건으로 옮김 · 구성(트리맵)·옛 2D 지도 링크는 여기</div>`;
}

const handlers = { request: () => openRequest(), inbox: () => openInbox() };
export function setHandler(name, fn) { handlers[name] = fn; }
export function bind(root) {
  root.addEventListener("click", e => {
    const t = e.target.closest("[data-preset],[data-color],[data-size],[data-view],[data-act]");
    if (!t || !root.contains(t)) return;
    if (t.dataset.preset) map.setPreset(t.dataset.preset);
    else if (t.dataset.color) map.setColor(t.dataset.color);
    else if (t.dataset.size) map.setSize(t.dataset.size);
    else if (t.dataset.view) map.setView(t.dataset.view);
    else act(t.dataset.act, t);
  });
  root.addEventListener("change", e => { const s = e.target.closest("[data-axis]"); if (s) map.setAxis(s.dataset.axis, s.value); });
  root.addEventListener("input", e => {
    const r = e.target.closest("[data-k]"); if (!r) return;
    map.setK(+r.value); $$("[data-kv]", root).forEach(b => { b.textContent = r.value; });
  });
}
export function act(a, t) {
  if (a === "iso") map.toggleIso();
  else if (a === "rot") map.toggleRotate();
  else if (a === "reset") map.reset();
  else if (a === "theme") map.theme();
  else if (a === "shelf") openShelf();
  else if (a === "shelf-all") setShelfView(false);
  else if (a === "shelf-mine") setShelfView(true);
  else if (a === "shelfview") setShelfView(!shelfView);
  else if (a === "login") clickU("in");
  else if (a === "logout") clickU("out");
  else if (handlers[a]) handlers[a](t);
}
// 켜짐 표시를 지금 상태에 맞춘다(구독에서 부른다)
export function sync(root) {
  const S = M().S, pre = map.preset(), view = map.view;
  $$("[data-preset]", root).forEach(b => { const on = b.dataset.preset === pre; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
  $$("[data-color]", root).forEach(b => b.classList.toggle("on", b.dataset.color === S.color));
  $$("[data-size]", root).forEach(b => b.classList.toggle("on", b.dataset.size === S.size));
  $$("[data-view]", root).forEach(b => b.classList.toggle("on", b.dataset.view === view));
  $$("[data-axis]", root).forEach(s => { if (s.value !== S[s.dataset.axis]) s.value = S[s.dataset.axis]; });
  const sw = (a, on, dis = false) => $$(`[data-act="${a}"]`, root).forEach(b => { b.classList.toggle("on", on); b.setAttribute("aria-checked", on); b.classList.toggle("dis", dis); });
  sw("iso", map.isoOn, !map.isoCan);
  sw("rot", map.rotating);
  sw("shelfview", shelfView, !canShelf());
  $$('[data-act="shelf-all"]', root).forEach(b => b.classList.toggle("on", !shelfView));
  $$('[data-act="shelf-mine"]', root).forEach(b => b.classList.toggle("on", shelfView));
}

// ---------------------------------------------------------------- 개인: 계정·내 서재(진짜, user.js) / 요청·알림(모양만)
function clickU(a) {  // user.js 는 문서 전체에서 [data-u] 클릭을 받는다
  const b = document.createElement("button");
  b.type = "button"; b.dataset.u = a; b.style.display = "none";
  document.body.appendChild(b); b.click(); b.remove();
}
export function account() {
  const slot = $("#user-slot");
  if (!slot || !slot.firstElementChild) return { state: "none" };
  if (slot.querySelector(".busy")) return { state: "busy" };
  if (slot.querySelector('[data-u="in"]')) return { state: "out" };
  const av = slot.querySelector(".av"), email = ((av && av.title) || "").split(" · ")[0];
  const img = av && av.querySelector("img") ? av.querySelector("img").src : "";
  return { state: "in", email, img, initial: (email[0] || "?").toUpperCase(), cloud: /클라우드 저장/.test($("#user-sec").textContent) };
}
export function avatar(acc = account(), cls = "") {
  if (acc.state === "in") return `<span class="sx-av ${cls}">${acc.img ? `<img src="${esc(acc.img)}" alt="" referrerpolicy="no-referrer">` : esc(acc.initial)}</span>`;
  return `<span class="sx-av out ${cls}">${ICON.user}</span>`;
}
export const accountLine = (acc = account()) =>
  acc.state === "in" ? (acc.cloud ? "내 기록은 클라우드에 저장" : "가족 목록에 없는 계정 · 이 기기에만 저장")
    : acc.state === "busy" ? "로그인 확인 중…" : acc.state === "none" ? "로그인을 쓸 수 없음 · 이 기기에만 저장" : "★·메모는 이 기기에만 저장돼요";
export function shelfCount() { const m = ($("#user-sec").textContent || "").match(/내 서재\s*(\d+)권/); return m ? +m[1] : 0; }
export const canShelf = () => { const b = $("#shelf-btn"); return !!b && !b.hidden; };
export const shelfOn = () => shelfView;
export const shelfOpen = () => { const s = $("#shelf"); return !!s && s.classList.contains("open"); };
const EMPTY_SHELF = "내 서재가 비어 있어요. 책 정보의 ☆ 내 서재에 담기로 책을 들이면 열려요.";
export function openShelf() {
  if (!canShelf()) { toast(EMPTY_SHELF); return false; }
  if (shelfOpen()) $('#shelf [data-sh="close"]').click(); else clickU("shelf");
  return true;
}
export function setShelfView(on) {
  if (on === shelfView) return;
  if (!canShelf()) { toast(EMPTY_SHELF); return; }
  const was = shelfOpen();
  if (!was) clickU("shelf");
  const b = $(`#shelf [data-sh="${on ? "mine" : "all"}"]`); if (b) b.click();
  if (!was) { const x = $('#shelf [data-sh="close"]'); if (x) x.click(); }
}
// 계정 칸: 로그인/로그아웃 + 저장 위치
export const accountHTML = (acc = account()) => `<div class="sx-acct">${avatar(acc, "lg")}<div class="who"><b>${acc.state === "in" ? esc(acc.email) : "로그인 안 함"}</b><small>${accountLine(acc)}</small></div>
  ${acc.state === "in" ? `<button type="button" class="sx-btn" data-act="logout">로그아웃</button>` : acc.state === "out" ? `<button type="button" class="sx-btn pri" data-act="login">Google 로그인</button>` : ""}</div>`;

// 개인 메뉴(계정 → 내 서재 → 책 요청·알림함). 시안 A·C 의 아바타 메뉴. '내 서재만 보기'는 조건 버블이라 여기 없다.
export const personalMenu = () => {
  const n = shelfCount(), u = unread();
  return `${accountHTML()}<div class="sx-sep"></div>
    <div class="sx-menu">
      <button type="button" class="sx-mi" data-act="shelf">${ICON.shelf}<span class="tx">내 서재<small>폴더로 정리한 책 ${n}권 · 지도에 내 서재만 보기는 조건 버블로</small></span></button>
      <div class="sx-sep"></div>
      <button type="button" class="sx-mi" data-act="request">${ICON.request}<span class="tx">책 요청<small>서재에 없는 책 부탁하기</small></span></button>
      <button type="button" class="sx-mi" data-act="inbox">${ICON.bell}<span class="tx">알림함<small>요청 상태·관리자 답장</small></span><i class="n" data-n="${u}">${u}</i></button>
    </div>`;
};

// 책 요청·알림함(모형). 문구·상태는 본편 intake.js 와 같게(대기 / 승인·서재에 넣음 / 거절 / 넣었음 / 못 찾음).
// 첨부가 있으면 '파일 넣어주세요'(file), 없으면 '찾아주세요'(find). 보낸 요청은 내 요청 맨 위에 '대기'로 붙는다.
export const inbox = {
  admin: false,
  mine: [
    { kind: "find", msg: "코스모스 — 칼 세이건", status: "approved", reply: "드라이브 ‘과학’ 폴더에 넣었어요. 다음 지도 업데이트부터 보여요.", at: "오늘 09:12", unread: true },
    { kind: "file", msg: "정의란 무엇인가", file: "정의란무엇인가.pdf · 8.4MB", status: "pending", at: "어제" },
    { kind: "find", msg: "중학 수학 3-1 문제집", status: "rejected", reply: "문제집은 서재에 넣지 않기로 했어요. 대신 『수학의 정석』이 있어요.", at: "10월 18일", unread: true },
  ],
  queue: [  // 관리자 화면: 가족이 보낸 대기 요청
    { from: "엄마", kind: "find", msg: "토지 1권 — 박경리. 스캔본이라도 괜찮아요.", at: "오늘 08:40" },
    { from: "동생", kind: "file", msg: "이기적 유전자", file: "이기적유전자.pdf · 12MB", at: "어제" },
  ],
};
export const unread = () => inbox.mine.filter(x => x.unread).length + (inbox.admin ? inbox.queue.length : 0);
const statusText = x => x.status === "pending" ? "대기" : x.kind === "file" ? (x.status === "approved" ? "승인 · 서재에 넣음" : "거절") : (x.status === "approved" ? "넣었음" : "못 찾음");
const kindText = k => k === "file" ? "📎 파일 넣어주세요" : "🔎 찾아주세요";
export function requestForm(box, done) {
  box.innerHTML = `<form class="sx-req">
    <p class="sx-lead">서재에 없는 책을 관리자에게 부탁해요. 파일이 있으면 첨부하면 바로 넣어 드려요.</p>
    <label class="sx-field"><span>어떤 책인가요?</span><textarea name="msg" rows="3" required placeholder="예: 『토지』 1권, 박경리 — 스캔본도 괜찮아요"></textarea></label>
    <label class="sx-file"><input type="file" name="file" accept=".pdf,.epub,.djvu,.mobi,.azw3,.hwp,.hwpx,.txt"><span class="fb">📎 파일 첨부</span><span class="fn">선택 · pdf·epub·djvu·hwp 등, 1GB 이하</span></label>
    <div class="sx-row end"><button type="submit" class="sx-btn pri">보내기</button></div>
    <p class="sx-note">시안: 실제로 보내지 않아요(진짜는 본편 intake.js). 보낸 요청은 🔔 알림함에서 상태와 관리자 답장을 봐요.</p>
  </form>`;
  const f = $("form", box);
  f.file.addEventListener("change", () => { const x = f.file.files[0]; $(".fn", box).textContent = x ? `${x.name} · ${Math.max(1, Math.round(x.size / 1e6))}MB` : "선택 · pdf·epub·djvu·hwp 등, 1GB 이하"; });
  f.addEventListener("submit", e => {
    e.preventDefault();
    const msg = f.msg.value.trim(); if (!msg) return;
    const file = f.file.files[0];
    inbox.mine.unshift({ kind: file ? "file" : "find", msg: msg.split("\n")[0].slice(0, 60), status: "pending", at: "방금", file: file ? file.name : "" });
    toast("요청을 보냈어요 (시안이라 실제로는 안 보냄)");
    notify();
    if (done) done();
  });
  setTimeout(() => f.msg.focus({ preventScroll: true }), 50);
}
export function inboxView(box) {
  const render = () => {
    const mine = inbox.mine.map(x => `<li class="sx-ni${x.unread ? " new" : ""}"><div class="h"><span class="st ${x.status}">${statusText(x)}</span><b>${esc(x.msg)}</b><time>${esc(x.at)}</time></div>
      ${x.reply ? `<p class="rp"><span>관리자</span>${esc(x.reply)}</p>` : x.status === "pending" ? `<p class="rp wait">관리자가 아직 확인하지 않았어요</p>` : ""}${x.file ? `<p class="att">📎 ${esc(x.file)}</p>` : ""}</li>`).join("");
    const queue = inbox.queue.length ? inbox.queue.map((x, i) => `<li class="sx-ni"><div class="h"><span class="kd">${kindText(x.kind)}</span><b>${esc(x.msg)}</b><time>${esc(x.from)} · ${esc(x.at)}</time></div>
      ${x.file ? `<p class="att">📎 ${esc(x.file)}</p>` : ""}
      <input class="sx-reply" placeholder="짧은 답장(선택)" data-i="${i}"><div class="sx-row"><button type="button" class="sx-btn pri" data-adm="ok" data-i="${i}">${x.kind === "file" ? "승인" : "넣었음"}</button><button type="button" class="sx-btn" data-adm="no" data-i="${i}">${x.kind === "file" ? "거절" : "못 찾음"}</button></div></li>`).join("")
      : `<li class="sx-empty">새 요청이 없어요</li>`;
    box.innerHTML = `<div class="sx-inbox"><div class="sx-seg sm"><button type="button" data-tab="mine" class="${inbox.admin ? "" : "on"}">내 요청·알림</button><button type="button" data-tab="admin" class="${inbox.admin ? "on" : ""}">대기 요청 <small>${inbox.queue.length}</small></button></div>
      <ul>${inbox.admin ? queue : mine}</ul>
      <p class="sx-note">${inbox.admin ? "관리자 계정에만 보이는 탭(시안: 누구나 볼 수 있게 열어 둠)" : "시안 예시 데이터 · 요청이 처리되면 여기와 🔔 배지로 알려요"}</p></div>`;
  };
  box.onclick = e => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { inbox.admin = tab.dataset.tab === "admin"; render(); notify(); return; }
    const a = e.target.closest("[data-adm]");
    if (a) {
      const i = +a.dataset.i, x = inbox.queue[i], rp = $(`.sx-reply[data-i="${i}"]`, box).value.trim();
      inbox.queue.splice(i, 1);
      toast(`${x.from}의 요청: ${a.textContent}${rp ? " · 답장 보냄" : ""} (시안)`);
      render(); notify();
    }
  };
  render();
  setTimeout(() => { inbox.mine.forEach(x => { x.unread = false; }); notify(); }, 1500);
}

// ---------------------------------------------------------------- 조건 버블 바(필터 칩) — 본편에 곧 생길 것을 시안 위에 흉내
// 데스크톱 검색창 아래 / 폰 아래 카드 위 가로 한 줄. 분류·난이도·언어·자료 종류·읽고싶음은 본편 필터(숨긴 #fbody 를 눌러 진짜로),
// 내 서재는 user.js 보기, 이웃만 보기는 #iso, 검색어는 #q. 버블끼리는 그리고(AND), ✕ 또는 ESC(마지막 것부터)로만 푼다.
// 만드는 곳: ＋ 조건, 범례의 분류를 누름, 검색, 서재 패널의 '내 서재만'. 설정창(보는 방식)에는 필터 토글이 없다.
const FILTER_COLORS = ["k1", "c", "l", "kd", "sc"];  // 범례를 누르면 같은 이름의 필터로
const fbtn = (f, v) => $(`#fbody button[data-f="${f}"][data-v="${v}"]`);
const fclick = (f, v) => { const b = fbtn(f, v); if (b) b.click(); };
function bubbles() {
  const out = [], q = $("#q").value.trim();
  if (q) out.push({ key: "q", label: `“${q}”`, kind: "검색어", off: () => { const b = $("#q"); b.value = ""; b.dispatchEvent(new Event("input", { bubbles: true })); } });
  for (const g of $$("#fbody .fgrp")) {
    const grp = (($("b", g) || {}).textContent || "").trim();
    for (const b of $$("button[data-f].on", g)) {
      const v = b.textContent.trim(), f = b.dataset.f, val = b.dataset.v;
      out.push({ key: `f:${f}:${val}`, label: grp === "난이도" || grp === "읽고싶음" ? `${grp} ${v}` : v, kind: grp, off: () => fclick(f, val) });
    }
  }
  if (shelfView) out.push({ key: "shelf", label: `📚 내 서재 ${shelfCount()}권`, kind: "내 서재", off: () => setShelfView(false) });
  if (map.isoOn) out.push({ key: "iso", label: "고른 책의 이웃만", kind: "이웃만 보기", off: () => map.toggleIso() });
  return out;
}
let bubOrder = [];
export function legendPick(name) {  // 범례의 분류 이름 → 조건 버블
  const k = M().S.color, c = M().COLORS[k];
  if (!FILTER_COLORS.includes(k) || !c) { toast("이 색은 범주가 아니라 조건으로 못 바꿔요 · ＋ 조건에서 골라 주세요"); return; }
  const i = c.names.indexOf(name), b = fbtn(k, i);
  if (b && !b.classList.contains("on")) b.click();
}
export function overlayOpen() {
  return !!document.querySelector(".sx-pop.open,.sx-scrim,.pd-scrim:not([hidden]),#pc-dock.open,#pb-sheet.open,#shelf.open,#panel.open,#results.on:not(.fold)");
}
export function openCond() {
  sheet("＋ 조건", box => {
    const render = () => {
      const groups = $$("#fbody .fgrp").filter(g => $("b", g)).map(g => {
        const grp = $("b", g).textContent.trim();
        return `<div class="sx-h">${esc(grp)}</div><div class="sx-chips">${$$("button[data-f]", g).map(b =>
          `<button type="button" class="sx-chip${b.classList.contains("on") ? " on" : ""}" data-cf="${b.dataset.f}:${b.dataset.v}">${esc(b.textContent.trim())}</button>`).join("")}</div>`;
      }).join("");
      box.innerHTML = `<p class="sx-lead">고른 조건은 지도 위 버블이 되고, 버블끼리는 '그리고'로 묶여요. 풀 때는 버블의 ✕ 나 ESC.</p>
        <div class="sx-h">내 것 · 고른 책</div><div class="sx-chips">
          <button type="button" class="sx-chip${shelfView ? " on" : ""}" data-cx="shelf">📚 내 서재만</button>
          <button type="button" class="sx-chip${map.isoOn ? " on" : ""}${map.isoCan ? "" : " dis"}" data-cx="iso">고른 책의 이웃만</button></div>
        ${groups}
        <p class="sx-note">본편 버블 바에는 AI 태그·교양/전공·이론/응용 범위·전체/부분 자료도 들어와요(시안엔 지금 본편 필터만). 같은 묶음 안 여러 개는 지금 본편 필터대로 '또는'.</p>`;
    };
    box.onclick = e => {
      const c = e.target.closest("[data-cf]"), x = e.target.closest("[data-cx]");
      if (c) { const [f, v] = c.dataset.cf.split(":"); fclick(f, v); }
      else if (x && x.dataset.cx === "shelf") setShelfView(!shelfView);
      else if (x && x.dataset.cx === "iso") map.toggleIso();
      else return;
      setTimeout(render, 0);
    };
    render();
  }, "sx-cond");
}
export function bubbleBar() {
  const bar = el(`<div id="sx-bub" role="toolbar" aria-label="조건"><div class="bl"></div><button type="button" class="badd" title="조건 더하기">＋ 조건</button><span class="bn"></span></div>`);
  document.body.appendChild(bar);
  bar.addEventListener("click", e => {
    const x = e.target.closest("[data-bx]");
    if (x) { const b = bubbles().find(y => y.key === x.dataset.bx); if (b) b.off(); return; }
    if (e.target.closest(".badd")) openCond();
  });
  onChange(() => {
    const bs = bubbles(), keys = bs.map(b => b.key);
    bubOrder = bubOrder.filter(k => keys.includes(k)).concat(keys.filter(k => !bubOrder.includes(k)));
    $(".bl", bar).innerHTML = bubOrder.map(k => bs.find(b => b.key === k)).map(b =>
      `<span class="sx-bb" title="${esc(b.kind)}">${esc(b.label)}<button type="button" data-bx="${esc(b.key)}" aria-label="${esc(b.label)} 조건 빼기">${ICON.close}</button></span>`).join("");
    const m = ($("#status").textContent || "").match(/(\d+)\s*\/\s*(\d+)/);
    $(".bn", bar).innerHTML = m ? `보이는 책 <b>${m[1]}</b>권 <small>/ ${m[2]}</small>` : `전체 <b>${window.P.length}</b>권`;
    bar.classList.toggle("has", bs.length > 0);
  });
  // 지도 범례(왼쪽 아래)의 분류를 누르면 그 분류만 → 버블
  $("#legend").addEventListener("click", e => {
    const it = e.target.closest(".it"); if (!it) return;
    const t = [...it.childNodes].find(nd => nd.nodeType === 3 && nd.textContent.trim());
    if (t) legendPick(t.textContent.trim());
  });
  // ESC: 열린 시트·팝오버·패널·고른 책이 없을 때 마지막 버블부터 푼다(본편 ESC 보다 먼저 판단)
  addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (overlayOpen() || M().selected >= 0) return;
    const k = bubOrder[bubOrder.length - 1], b = k && bubbles().find(y => y.key === k);
    if (b) { e.preventDefault(); b.off(); }
  }, true);
  // 비교 페이지 스크린샷용: ?bub=1 이면 예시 조건 둘(응용수학 · 난이도 5–6)
  if (new URLSearchParams(location.search).has("bub")) {
    const byText = (grp, v) => { const g = $$("#fbody .fgrp").find(x => ($("b", x) || {}).textContent === grp); const b = g && $$("button[data-f]", g).find(y => y.textContent.trim() === v); if (b && !b.classList.contains("on")) b.click(); };
    byText("큰 분야", "응용수학"); byText("난이도", "5–6");
  }
  return bar;
}

// ---------------------------------------------------------------- 시트·토스트·배지
let sheetEl = null;
export function sheet(title, fill, cls = "") {
  closeSheet();
  sheetEl = el(`<div class="sx-scrim ${cls}"><section class="sx-sheet" role="dialog" aria-label="${esc(title)}"><header><b>${esc(title)}</b><button type="button" class="sx-x" aria-label="닫기">${ICON.close}</button></header><div class="sx-body"></div></section></div>`);
  document.body.appendChild(sheetEl);
  sheetEl.addEventListener("click", e => { if (e.target === sheetEl || e.target.closest(".sx-x")) closeSheet(); });
  fill($(".sx-body", sheetEl), closeSheet);
  requestAnimationFrame(() => sheetEl && sheetEl.classList.add("in"));
  return sheetEl;
}
export function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; } }
addEventListener("keydown", e => { if (e.key === "Escape" && sheetEl) closeSheet(); });
export const openRequest = () => sheet("📥 책 요청", (b, close) => requestForm(b, close));
export const openInbox = () => sheet("🔔 알림함", b => inboxView(b));

let toastT = 0;
export function toast(msg) {
  let t = $(".sx-toast");
  if (!t) { t = el(`<div class="sx-toast" role="status"></div>`); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600);
}
const SHOT = new URLSearchParams(location.search).has("shot");  // 비교 페이지 스크린샷용: 시안 배지 숨김
export const DEMO = new URLSearchParams(location.search).get("demo");  // open = 설정 연 상태, me = 개인 메뉴 연 상태
export function protoNav(cur, name) {
  document.body.classList.add("sx-" + cur);
  document.body.classList.toggle("sx-shot", SHOT);
  document.body.appendChild(el(`<nav class="sx-nav" aria-label="시안 바꾸기"><span class="nm">시안 ${cur.toUpperCase()} · ${esc(name)}</span>${"abcd".split("").map(v =>
    `<a href="proto/settings-${v}.html"${v === cur ? ' class="on" aria-current="page"' : ""}>${v.toUpperCase()}</a>`).join("")}<a href="proto/settings.html" class="home">비교</a></nav>`));
}
// 바깥을 누르면 닫히는 팝오버(열린 것 하나만)
let popOpen = null;
export function popover(btn, which, onOpen) {  // which = 팝오버 요소, 또는 화면에 따라 고르는 함수
  btn.addEventListener("click", e => {
    e.stopPropagation();
    const pop = typeof which === "function" ? which() : which;
    const open = popOpen !== pop;
    closePop();
    if (open) { pop.classList.add("open"); btn.classList.add("open"); btn.setAttribute("aria-expanded", "true"); popOpen = pop; pop._btn = btn; if (onOpen) onOpen(pop); }
  });
}
export function closePop() {
  if (!popOpen) return;
  popOpen.classList.remove("open"); popOpen._btn.classList.remove("open"); popOpen._btn.setAttribute("aria-expanded", "false"); popOpen = null;
}
document.addEventListener("pointerdown", e => { if (popOpen && !popOpen.contains(e.target) && !popOpen._btn.contains(e.target)) closePop(); });
addEventListener("keydown", e => { if (e.key === "Escape") closePop(); });
