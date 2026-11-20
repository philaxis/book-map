// 세 시안 공통: 색, 정보 패널, 툴팁, 검색. 데이터는 data.js 의 window.BOOKS.
const D = window.BOOKS;
const P = D.points;
const PALETTE = ["#4e79a7","#f28e2b","#e15759","#76b7b2","#59a14f","#edc948","#b07aa1","#ff9da7","#9c755f","#bcbd22","#d37295","#8cd17d","#a0cbe8","#ffbe7d"];
const colorOf = i => PALETTE[P[i].k1 % PALETTE.length];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const driveUrl = fid => `https://drive.google.com/file/d/${fid}/view`;
const isTouch = matchMedia("(pointer: coarse)").matches;
const narrow = () => innerWidth <= 720;
// 폰에선 패널이 화면 아래 절반을 덮으므로, 열려 있는 동안 3D 화면 가운데를 위로 올린다.
function shiftView(camera, open) {
  if (open && narrow()) camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.26, innerWidth, innerHeight);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

const tipEl = document.createElement("div");
tipEl.id = "tip";
document.body.appendChild(tipEl);
function showTip(x, y, text) {
  tipEl.textContent = text;
  tipEl.style.display = "block";
  const w = tipEl.offsetWidth;
  tipEl.style.left = Math.min(x + 14, innerWidth - w - 6) + "px";
  tipEl.style.top = (y + 14) + "px";
}
function hideTip() { tipEl.style.display = "none"; }

// 정보 패널. onPick(j) 은 비슷한 책을 눌렀을 때, onClose 는 닫을 때.
function makePanel({ onPick, onClose, neighbors = 10 }) {
  const el = document.createElement("aside");
  el.id = "panel";
  document.body.appendChild(el);
  const api = {
    el, current: -1, neighbors,
    show(i) {
      api.current = i;
      const p = P[i];
      const k1 = D.coarse[p.k1], k2 = D.fine[p.k2];
      const score = (label, v, l = "", r = "") => v ? `<div class="score"><span>${label}</span><i><b style="width:${v * 20}%"></b></i><span>${v}</span></div>` + (l ? `<div class="score" style="margin-top:-2px;color:var(--mut)"><span></span><span>${l} ↔ ${r}</span><span></span></div>` : "") : "";
      const nb = p.nn.slice(0, api.neighbors).map((j, r) =>
        `<li class="nb" data-j="${j}"><i class="dot" style="background:${colorOf(j)}"></i><span>${esc(P[j].t)}</span><em>${p.ns[r].toFixed(2)}</em></li>`).join("");
      const others = p.o.map(([name, fid, rel]) => `<li>${fid ? `<a href="${driveUrl(fid)}" target="_blank" rel="noopener">${esc(name)}</a>` : esc(name)}${rel ? ` <span style="color:var(--mut)">· ${esc(rel)}</span>` : ""}</li>`).join("");
      const parts = p.p.map(([name, w]) => `<li>${esc(name)} <span style="color:var(--mut)">· ${Math.round(w * 100)}%</span></li>`).join("");
      el.innerHTML = `<button class="x" title="닫기">×</button>
        <a class="drive" href="${driveUrl(p.f)}" target="_blank" rel="noopener">드라이브에서 열기 ↗</a>
        <h2>${esc(p.t)}</h2>
        <div class="au">${esc(p.a) || "저자 미상"}${p.y ? ` · ${p.y}` : ""} · ${esc(D.langs[p.l])}</div>
        <div class="chips"><span class="chip k" style="background:${colorOf(i)}">${esc(k1.name)}</span><span class="chip">${esc(k2.name)}</span></div>
        ${p.g ? `<div class="chips">${p.g.split(/[,#]\s*/).filter(Boolean).slice(0, 10).map(t => `<span class="chip">${esc(t.trim())}</span>`).join("")}</div>` : ""}
        ${p.s ? `<p>${esc(p.s)}</p>` : ""}
        ${p.d || p.th || p.m ? `<h3>점수 (1~5)</h3>${score("난이도", p.d)}${score("이론→응용", p.th)}${score("수식", p.m)}` : ""}
        ${parts ? `<h3>이 책의 주제 파트</h3><ul>${parts}</ul>` : ""}
        ${others ? `<h3>같은 작품의 다른 파일 (${p.o.length})</h3><ul>${others}</ul>` : ""}
        <h3>비슷한 책 (코사인 유사도)</h3><ul>${nb}</ul>`;
      el.classList.add("open");
      el.scrollTop = 0;
    },
    hide() { el.classList.remove("open"); api.current = -1; },
  };
  el.addEventListener("click", e => {
    if (e.target.closest(".x")) { api.hide(); onClose && onClose(); return; }
    const li = e.target.closest("li.nb");
    if (li) onPick(+li.dataset.j);
  });
  return api;
}

// 검색창: 제목·저자·태그 부분 일치. onInput(목록) 으로 일치 전체를, onPick(i) 로 고른 것을 알린다.
function makeSearch(host, { onPick, onInput, placeholder = "책 제목·저자·태그 검색" }) {
  const box = document.createElement("div");
  box.className = "search";
  box.innerHTML = `<input type="search" placeholder="${placeholder}" autocomplete="off"><ul></ul>`;
  host.appendChild(box);
  const input = box.querySelector("input"), list = box.querySelector("ul");
  let hits = [], hi = 0;
  const hay = P.map(p => `${p.t} ${p.a} ${p.g}`.toLowerCase());
  function render() {
    list.innerHTML = hits.slice(0, 12).map((i, r) => `<li data-i="${i}" class="${r === hi ? "hi" : ""}">${esc(P[i].t)}<small>${esc(P[i].a)}</small></li>`).join("");
    list.classList.toggle("open", hits.length > 0 && document.activeElement === input);
  }
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    hits = q ? P.map((_, i) => i).filter(i => hay[i].includes(q)) : [];
    hi = 0;
    render();
    onInput && onInput(q ? hits : null);
  });
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { hi = Math.min(hi + 1, Math.min(hits.length, 12) - 1); render(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { hi = Math.max(hi - 1, 0); render(); e.preventDefault(); }
    else if (e.key === "Enter" && hits.length) { pick(hits[hi]); }
    else if (e.key === "Escape") { input.value = ""; input.dispatchEvent(new Event("input")); input.blur(); }
  });
  input.addEventListener("focus", render);
  input.addEventListener("blur", () => setTimeout(() => list.classList.remove("open"), 150));
  list.addEventListener("pointerdown", e => { const li = e.target.closest("li"); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
  function pick(i) { list.classList.remove("open"); input.blur(); onPick(i); }
  return { input, clear() { input.value = ""; hits = []; render(); onInput && onInput(null); } };
}
