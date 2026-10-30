/* 시안 C · 하단 독 (Apple 지도의 아래 카드, 모바일 우선 — 엄지가 닿는 곳)
   - 화면 아래 독 한 줄: 프리셋 3개(그림 버튼) + [색·크기] 버튼. 위에는 지금 색의 범례 한 줄
   - [색·크기]나 범례 줄을 누르면 독이 위로 펼쳐져 색 카드(가로로 넘김)·범례 전체·크기·(접힘) 보기 방식·고급
   - 범례가 독 안으로 들어와 왼쪽 아래 범례 상자는 없앤다. 책을 고르면(카드·패널) 독은 비킨다
   - 개인 기능은 오른쪽 위 아바타(배지) → 메뉴
   - 조건 버블 바: 데스크톱은 검색창 아래, 폰은 독 바로 위 한 줄. 독의 범례에서 분류를 누르면 그 분류가 버블이 된다(범례 = 색 = 조건의 출발점) */
import {
  $, el, ICON, PICT, ready, onChange, bind, sync, colorList, sizeChips, viewSeg, switchRow, advancedHTML, legendHTML,
  personalMenu, avatar, account, unread, labelOf, COLORS, SIZES, PRESETS, colorPreview, popover, closePop, protoNav, narrow, DEMO, bubbleBar, legendPick,
} from "./settings-common.js";

await ready;
protoNav("c", "하단 독");
bubbleBar();

const dock = el(`<section id="pc-dock" aria-label="지도 보기">
  <div class="pc-more" id="pc-more">
    <div class="pc-sec"><div class="sx-h">점 색</div><div class="pc-colors">${colorList({ groups: false })}</div><div class="pc-lg"></div></div>
    <div class="pc-sec"><div class="sx-h">점 크기</div>${sizeChips()}</div>
    <div class="pc-sec"><details class="sx-adv"><summary>보기 방식 · 고급${ICON.chev}</summary>
      <div class="pc-in"><div class="sx-h">책 보기 방식</div>${viewSeg()}
      <div class="pc-sws">${switchRow("rot", "자동 회전")}</div>
      <div class="sx-row"><button type="button" class="sx-btn" data-act="reset">처음 보기</button><button type="button" class="sx-btn" data-act="theme">밝게/어둡게</button></div>
      <div class="sx-h pc-advh">축 직접 고르기</div>${advancedHTML({ tools: false })}</div></details></div>
  </div>
  <button type="button" class="pc-lgline" aria-controls="pc-more"></button>
  <div class="pc-bar">
    <div class="pc-presets" role="radiogroup" aria-label="프리셋">${PRESETS.map(p => `<button type="button" class="pc-p" data-preset="${p.k}" role="radio">${PICT[p.k]}<span>${p.label}</span></button>`).join("")}</div>
    <button type="button" class="pc-style" aria-expanded="false" aria-controls="pc-more"><span class="pv"></span><span class="t"><b>색·크기</b><small></small></span>${ICON.chev}</button>
  </div>
</section>`);
const me = el(`<button type="button" id="pc-me" aria-label="내 메뉴" aria-expanded="false"></button>`);
const popMe = el(`<div class="sx-pop" id="pc-mepop"></div>`);
document.body.append(dock, me, popMe);
bind(dock); bind(popMe);

function setOpen(open) {
  dock.classList.toggle("open", open);
  document.body.classList.toggle("pc-open", open);
  $(".pc-style", dock).setAttribute("aria-expanded", open);
  dockH();
}
const dockH = () => document.documentElement.style.setProperty("--pc-dockh", dock.offsetHeight + "px");  // 폰: 버블 바를 독 위에
addEventListener("resize", dockH);
// 독 안 범례의 분류 → 조건 버블(펼친 범례에서만. 접힌 한 줄은 독을 펼친다)
$(".pc-lg", dock).addEventListener("click", e => { const it = e.target.closest(".it[data-name]"); if (it) legendPick(it.dataset.name); });
$(".pc-style", dock).addEventListener("click", () => setOpen(!dock.classList.contains("open")));
$(".pc-lgline", dock).addEventListener("click", () => setOpen(true));
document.addEventListener("pointerdown", e => { if (dock.classList.contains("open") && !dock.contains(e.target) && !e.target.closest(".sx-scrim,.sx-toast")) setOpen(false); });

function renderMe() { popMe.innerHTML = personalMenu(); sync(popMe); }
popover(me, popMe, () => {
  renderMe();
  if (narrow()) return;
  const r = me.getBoundingClientRect();
  popMe.style.top = r.bottom + 8 + "px";
  popMe.style.left = Math.max(8, r.right - popMe.offsetWidth) + "px";
});
popMe.addEventListener("click", e => { if (e.target.closest(".sx-mi")) closePop(); });

let wasSel = false;
onChange(() => {
  const S = window.MAP.S, u = unread();
  $(".pc-style .pv", dock).innerHTML = colorPreview(S.color);
  $(".pc-style small", dock).textContent = `${labelOf(COLORS, S.color)} · ${labelOf(SIZES, S.size)}`;
  $(".pc-lgline", dock).innerHTML = `<span class="k">색 = ${labelOf(COLORS, S.color)}</span>${legendHTML(S.color, 7)}`;
  $(".pc-lg", dock).innerHTML = legendHTML(S.color);
  me.innerHTML = avatar(account()) + `<span class="sx-badge" data-n="${u}">${u || ""}</span>`;
  sync(dock);
  if (popMe.classList.contains("open")) renderMe();
  dockH();
  const sel = document.body.classList.contains("sx-card") || document.body.classList.contains("sx-panel");
  if (sel && !wasSel) setOpen(false);  // 책을 고르면 접는다
  wasSel = sel;
});
if (DEMO === "open") setOpen(true);
else if (DEMO === "me") me.click();
