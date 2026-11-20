/* 시안 D · 명령 팔레트 (Linear·Raycast·VS Code 의 Ctrl+K)
   - 화면에는 검색창과 지금 상태 한 줄('주제 지도 · 큰 분야 색 · 균일 크기')만. 지도가 가장 넓다
   - 상태 줄 조각·[바꾸기]·Ctrl+K → 팔레트. 글자로 찾고(초성도: ㄴㅇㄷ) ↑↓ 로 옮기면 지도에 바로 미리 보인다. Enter 확정, Esc 되돌림
   - 개인 기능도 같은 팔레트의 '내 것' 묶음(아바타 = '내 것'만 걸러 연다). 찾는 말이 명령에 없으면 '책 검색'으로 넘긴다
   - 조건 버블 바는 검색 카드 바로 아래. 팔레트에서 '응용수학'처럼 치면 '조건: 응용수학만'이 떠서 버블을 만든다(설정 = 보는 방식, 버블 = 조건) */
import {
  $, $$, el, esc, ICON, PICT, ready, onChange, act, map, colorPreview, sizePreview, avatar, account, shelfCount, shelfOn,
  setShelfView, openShelf, openRequest, openInbox, unread, labelOf, PRESETS, COLORS, SIZES, VIEWS, protoNav, DEMO, bubbleBar, openCond,
} from "./settings-common.js";

await ready;
protoNav("d", "명령 팔레트");

const go = el(`<button type="button" class="pd-go" title="설정 바꾸기 (Ctrl+K)">${ICON.sliders}<span>바꾸기</span><kbd>Ctrl K</kbd></button>`);
const me = el(`<button type="button" class="pd-me" aria-label="내 것"></button>`);
$("#top").append(go, me);
const sum = el(`<div id="pd-sum" aria-label="지금 보는 방식"></div>`);  // 검색 카드 둘째 줄
const pal = el(`<div class="pd-scrim" hidden><div class="pd-pal" role="dialog" aria-label="명령">
  <div class="pd-in">${ICON.search}<input type="text" placeholder="무엇을 바꿀까요? 예: 색 난이도 · 내 서재 · 요청 · ㄴㅇㄷ" autocomplete="off" spellcheck="false"><button type="button" class="pd-esc">Esc</button></div>
  <div class="pd-crumb" hidden></div>
  <div class="pd-list" role="listbox"></div>
  <div class="pd-foot"><span><kbd>↑</kbd><kbd>↓</kbd> 미리 보기</span><span><kbd>Enter</kbd> 고르기</span><span><kbd>Esc</kbd> 되돌리고 닫기</span></div>
</div></div>`);
$("#ctl").appendChild(sum);
document.body.append(pal);
bubbleBar();
const input = $("input", pal), list = $(".pd-list", pal), crumb = $(".pd-crumb", pal);

// 초성 검색: '난이도' → 'ㄴㅇㄷ'
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const cho = s => [...s].map(c => { const k = c.charCodeAt(0) - 0xac00; return k >= 0 && k < 11172 ? CHO[Math.floor(k / 588)] : c; }).join("");
const norm = s => String(s).toLowerCase().replace(/\s+/g, "");

function commands() {
  const S = window.MAP.S, pre = map.preset(), acc = account(), u = unread(), V = window.MAP.VARS;
  const C = [];
  for (const p of PRESETS) C.push({ g: "배치", label: p.label, sub: p.desc, icon: `<span class="pic">${PICT[p.k]}</span>`, on: pre === p.k, run: () => map.setPreset(p.k), pv: "preset", kw: "프리셋 배치 지도 기준" });
  for (const o of COLORS) C.push({ g: "점 색", label: o.label, sub: o.note || o.group, right: colorPreview(o.k), on: S.color === o.k, run: () => map.setColor(o.k), pv: "color", kw: "색 색깔 칠하기" });
  for (const o of SIZES) C.push({ g: "점 크기", label: o.label, icon: sizePreview(o.k), on: S.size === o.k, run: () => map.setSize(o.k), pv: "size", kw: "크기 점크기" });
  for (const v of VIEWS) C.push({ g: "책 보기 방식", label: v.label, sub: v.desc, on: map.view === v.k, run: () => map.setView(v.k), kw: "보기방식 파트 노드" });
  C.push({ g: "보기", label: "자동 회전", right: map.rotating ? "켜짐" : "꺼짐", run: () => map.toggleRotate(), kw: "회전 돌리기" });
  C.push({ g: "보기", label: "처음 보기", sub: "카메라를 처음 자리로", run: () => map.reset(), kw: "리셋 초기화 카메라" });
  C.push({ g: "보기", label: "밝게/어둡게", sub: "테마", run: () => map.theme(), kw: "테마 다크 라이트 어둡게 밝게" });
  C.push({ g: "내 것", label: "내 서재 열기", sub: `폴더로 정리한 책 ${shelfCount()}권`, icon: ICON.shelf, run: () => openShelf(), kw: "서재 폴더 별 즐겨찾기" });
  C.push({ g: "내 것", label: "책 요청하기", sub: "서재에 없는 책 부탁 · 파일 첨부", icon: ICON.request, run: () => openRequest(), kw: "요청 부탁 신청 업로드" });
  C.push({ g: "내 것", label: "알림함", sub: "요청 상태·관리자 답장", icon: ICON.bell, right: u ? `<i class="n">${u}</i>` : "", run: () => openInbox(), kw: "알림 답장 승인 거절" });
  C.push(acc.state === "in" ? { g: "내 것", label: "로그아웃", sub: acc.email, icon: ICON.user, run: () => act("logout"), kw: "계정" }
    : { g: "내 것", label: "Google 로그인", sub: "★·메모를 가족 계정에 저장", icon: ICON.user, run: () => act("login"), kw: "계정 로그인" });
  // 조건(버블): 늘 보이는 셋 + 글자를 치면 본편 필터 값들(분류·난이도·언어…)이 '조건: …'으로 뜬다
  C.push({ g: "조건(버블)", label: "＋ 조건 고르기…", sub: "분류·난이도·언어·읽고싶음…", icon: ICON.eye, run: () => openCond(), kw: "필터 조건 버블 걸러" });
  C.push({ g: "조건(버블)", label: "📚 내 서재만", sub: shelfOn() ? "켜짐 · 버블 ✕로 풀기" : "담은 책만 남기기", on: shelfOn(), run: () => setShelfView(!shelfOn()), kw: "서재 내서재만 필터" });
  C.push({ g: "조건(버블)", label: "고른 책의 이웃만", sub: map.isoCan ? "고른 책과 가까운 책만" : "먼저 지도에서 책을 고르세요", on: map.isoOn, dis: !map.isoCan, run: () => map.toggleIso(), kw: "이웃 비슷한 필터" });
  for (const g of $$("#fbody .fgrp")) {
    const gb = $("b", g); if (!gb) continue;
    const grp = gb.textContent.trim();
    for (const b of $$("button[data-f]", g)) {
      const v = b.textContent.trim(), f = b.dataset.f, val = b.dataset.v;
      C.push({ g: "조건(버블)", label: `조건: ${grp === "난이도" || grp === "읽고싶음" ? grp + " " : ""}${v}만`, sub: grp, on: b.classList.contains("on"), cond: true,
        run: () => { const x = $(`#fbody button[data-f="${f}"][data-v="${val}"]`); if (x) x.click(); }, kw: `필터 조건 ${grp}` });
    }
  }
  for (const [a, lab] of [["x", "가로"], ["y", "깊이"], ["z", "높이"]])
    C.push({ g: "고급", label: `${lab} 축 바꾸기…`, right: esc(V[S[a]].short ?? V[S[a]].label), run: () => drill(a, lab), keep: true, kw: "축 고급 직접" });
  return C;
}
function axisCommands(a) {
  const S = window.MAP.S, V = window.MAP.VARS;
  return window.MAP.AXIS_KEYS.filter(k => a !== "x" || k !== "none").map(k => ({ g: V[k].group || "기타", label: V[k].label, on: S[a] === k, run: () => map.setAxis(a, k), pv: "axis" }));
}

let items = [], at = 0, scope = null, drillAxis = null, snap = null;
function filter(all, q) {
  const toks = q.trim().split(/\s+/).filter(Boolean).map(norm);
  if (!toks.length) return all;
  return all.filter(c => {
    const hay = norm(`${c.g} ${c.label} ${c.sub || ""} ${c.kw || ""}`), hc = cho(hay);
    return toks.every(t => hay.includes(t) || hc.includes(t));
  });
}
function render() {
  const q = input.value;
  let all = drillAxis ? axisCommands(drillAxis.a) : commands();
  if (scope && !q) all = all.filter(c => c.g === scope);
  items = filter(q.trim() ? all : all.filter(c => !c.cond), q);  // 필터 값 목록은 글자를 쳤을 때만
  if (q.trim() && !drillAxis) items.push({ g: "책 찾기", label: `‘${q.trim()}’ 책 검색`, icon: ICON.search, run: () => bookSearch(q.trim()) });
  at = Math.max(0, Math.min(at, items.length - 1));
  let last = "";
  list.innerHTML = items.map((c, i) => {
    const head = c.g !== last ? `<div class="pd-gh">${esc(c.g)}</div>` : ""; last = c.g;
    return `${head}<button type="button" class="pd-it${i === at ? " act" : ""}${c.on ? " on" : ""}${c.dis ? " dis" : ""}" data-i="${i}" role="option">
      <span class="ic">${c.icon || (c.on ? ICON.check : "")}</span><span class="tx"><b>${esc(c.label)}</b>${c.sub ? `<small>${esc(c.sub)}</small>` : ""}</span>
      <span class="rt">${c.right || ""}</span>${c.on && c.icon ? `<span class="ck">${ICON.check}</span>` : ""}</button>`;
  }).join("") || `<div class="pd-none">맞는 명령이 없어요</div>`;
  crumb.hidden = !drillAxis && !scope;
  crumb.innerHTML = drillAxis ? `<button type="button" data-back>← 전체</button> ${esc(drillAxis.lab)} 축 고르기` : scope ? `<button type="button" data-back>← 전체</button> ${esc(scope)}만 보는 중` : "";
  const a = $(".pd-it.act", list); if (a) a.scrollIntoView({ block: "nearest" });
}
// 미리 보기: 색·크기·배치·축은 ↑↓ 로 옮기기만 해도 지도에 바로 적용. Esc 면 연 때 상태로 되돌린다.
function preview() {
  const c = items[at];
  if (c && c.pv && !c.dis) c.run();
}
function restore() {
  if (!snap) return;
  const S = window.MAP.S;
  if (["x", "y", "z"].some(k => S[k] !== snap.x[k])) { Object.assign(S, snap.x); window.MAP.changed(true); }
  if (S.color !== snap.color) map.setColor(snap.color);
  if (S.size !== snap.size) map.setSize(snap.size);
}
function open(g = null) {
  const S = window.MAP.S;
  snap = { x: { x: S.x, y: S.y, z: S.z }, color: S.color, size: S.size };
  scope = g; drillAxis = null; input.value = ""; at = 0;
  pal.hidden = false; document.body.classList.add("pd-open");
  render();
  const cur = items.findIndex(c => c.on); if (g && cur >= 0) { at = cur; render(); }
  setTimeout(() => input.focus(), 20);
}
function close(revert) { if (revert) restore(); pal.hidden = true; document.body.classList.remove("pd-open"); snap = null; }
function choose(i) {
  const c = items[i]; if (!c || c.dis) { if (c && c.dis) c.run(); return; }
  if (c.keep) { c.run(); return; }
  snap = null;
  close(false);
  c.run();
}
function drill(a, lab) { drillAxis = { a, lab }; input.value = ""; at = Math.max(0, axisCommands(a).findIndex(c => c.on)); render(); input.focus(); }
function bookSearch(q) { const box = $("#q"); box.value = q; box.dispatchEvent(new Event("input", { bubbles: true })); box.focus(); }

input.addEventListener("input", () => { at = 0; render(); });
input.addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!items.length) return;
    at = (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    render(); preview();
  } else if (e.key === "Enter") { e.preventDefault(); choose(at); }
  else if (e.key === "Escape") { e.preventDefault(); close(true); }
  else if (e.key === "Backspace" && !input.value && (drillAxis || scope)) { drillAxis = null; scope = null; render(); }
});
list.addEventListener("click", e => { const b = e.target.closest(".pd-it"); if (b) choose(+b.dataset.i); });
list.addEventListener("pointermove", e => { const b = e.target.closest(".pd-it"); if (b && +b.dataset.i !== at) { at = +b.dataset.i; $$(".pd-it", list).forEach(x => x.classList.toggle("act", x === b)); } });
crumb.addEventListener("click", e => { if (e.target.closest("[data-back]")) { drillAxis = null; scope = null; render(); input.focus(); } });
pal.addEventListener("pointerdown", e => { if (e.target === pal) close(true); });
$(".pd-esc", pal).addEventListener("click", () => close(true));
go.addEventListener("click", () => open());
me.addEventListener("click", () => open("내 것"));
sum.addEventListener("click", e => { const b = e.target.closest("[data-g]"); if (b) open(b.dataset.g); });
addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal.hidden ? open() : close(true); }
});

onChange(() => {
  const S = window.MAP.S, pre = map.preset(), u = unread();
  sum.innerHTML = `<button type="button" data-g="배치">${pre ? `<span class="pic">${PICT[pre]}</span>${labelOf(PRESETS, pre)}` : "직접 고른 축"}</button>`
    + `<button type="button" data-g="점 색">${colorPreview(S.color)}${labelOf(COLORS, S.color)} 색</button>`
    + `<button type="button" data-g="점 크기">${sizePreview(S.size)}${labelOf(SIZES, S.size)}</button>`
    + `<button type="button" class="ed" data-g="">${ICON.sliders}<span>바꾸기</span></button>`;
  me.innerHTML = avatar(account()) + `<span class="sx-badge" data-n="${u}">${u || ""}</span>`;
  if (!pal.hidden) { const keep = at; render(); at = keep; }
});
if (DEMO === "open") open();
else if (DEMO === "me") open("내 것");
