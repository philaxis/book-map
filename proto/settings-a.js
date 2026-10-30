/* 시안 A · 상단 칩 줄 + 팝오버 (Google·네이버 지도의 검색창 옆 칩, Linear 'Display' 팝오버)
   - 검색창 오른쪽(폰은 아래)에 프리셋 세그먼트와 [색 ▾][크기 ▾][보기 ▾] 칩이 늘 보인다 → 지금 상태를 한눈에
   - 칩을 누르면 팝오버(폰은 지도가 보이는 반쯤 시트)에서 미리보기와 함께 고른다
   - 개인 기능은 검색창의 내 아바타 메뉴로 분리(계정·내 서재·책 요청·알림함)
   - 조건 버블 바(필터)는 검색창 바로 아래(폰은 아래 카드 위): 위 칩 줄 = 어떻게 볼지, 아래 버블 = 무엇만 볼지 */
import {
  $, $$, el, ICON, ready, onChange, bind, sync, presetSeg, colorList, sizeChips, viewSeg, switchRow, advancedHTML,
  personalMenu, avatar, account, unread, labelOf, COLORS, SIZES, colorPreview, popover, closePop, protoNav, narrow, DEMO, bubbleBar,
} from "./settings-common.js";

await ready;
protoNav("a", "상단 칩 + 팝오버");
bubbleBar();

const me = el(`<button type="button" class="pa-me" aria-label="내 메뉴" aria-expanded="false"></button>`);
$("#top").appendChild(me);

const row = el(`<div id="pa-row">
  <div class="pa-pill pa-presets">${presetSeg()}</div>
  <button type="button" class="pa-pill pa-chip" id="pa-c-color" aria-expanded="false"><span class="pv"></span><span class="k desk">색</span><b></b><span class="k ph">색·크기·보기</span>${ICON.chev}</button>
  <button type="button" class="pa-pill pa-chip" id="pa-c-size" aria-expanded="false">${ICON.size}<span class="k">크기</span><b></b>${ICON.chev}</button>
  <button type="button" class="pa-pill pa-chip" id="pa-c-more" aria-expanded="false">${ICON.sliders}<span class="k only">보기</span>${ICON.chev}</button>
</div>`);
const popColor = el(`<div class="sx-pop pa-pop" id="pa-color"><div class="sx-h">점 색</div>${colorList()}</div>`);
const popSize = el(`<div class="sx-pop pa-pop" id="pa-size"><div class="sx-h">점 크기</div>${sizeChips()}<p class="sx-note">값이 클수록 점이 커져요. 값이 없는 책은 작게 보여요.</p></div>`);
const popMore = el(`<div class="sx-pop pa-pop" id="pa-more">
  <div class="sx-h">책 보기 방식</div>${viewSeg()}
  <div class="pa-sws">${switchRow("rot", "자동 회전")}</div>
  <div class="sx-row"><button type="button" class="sx-btn" data-act="reset">처음 보기</button><button type="button" class="sx-btn" data-act="theme">밝게/어둡게</button></div>
  <details class="sx-adv"><summary>고급 <small>· 축 직접 고르기, 이웃 수</small>${ICON.chev}</summary>${advancedHTML({ tools: false })}</details>
</div>`);
const popMe = el(`<div class="sx-pop pa-pop" id="pa-me"></div>`);
// 폰: 칩은 [프리셋][색·크기·보기] 둘만. 시트 하나에 색 → 크기 → (접힘) 보기 방식·고급
const popAll = el(`<div class="sx-pop pa-pop" id="pa-all"><div class="sx-h">점 색</div>${colorList()}
  <div class="sx-h pa-h2">점 크기</div>${sizeChips()}
  <details class="sx-adv pa-alladv"><summary>보기 방식 · 고급${ICON.chev}</summary>
    <div class="sx-h">책 보기 방식</div>${viewSeg()}
    <div class="pa-sws">${switchRow("rot", "자동 회전")}</div>
    <div class="sx-row"><button type="button" class="sx-btn" data-act="reset">처음 보기</button><button type="button" class="sx-btn" data-act="theme">밝게/어둡게</button></div>
    <div class="sx-h pa-h2">축 직접 고르기</div>${advancedHTML({ tools: false })}</details></div>`);
document.body.append(row, popColor, popSize, popMore, popMe, popAll);
[row, popColor, popSize, popMore, popMe, popAll].forEach(bind);

function place(pop, btn) {  // 데스크톱: 칩 바로 아래. 폰은 CSS 가 하단 시트로.
  if (narrow()) { pop.style.left = pop.style.top = ""; return; }
  const r = btn.getBoundingClientRect(), w = pop.offsetWidth;
  pop.style.top = r.bottom + 8 + "px";
  pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
}
popover($("#pa-c-color"), () => (narrow() ? popAll : popColor), pop => place(pop, $("#pa-c-color")));
popover($("#pa-c-size"), popSize, () => place(popSize, $("#pa-c-size")));
popover($("#pa-c-more"), popMore, () => place(popMore, $("#pa-c-more")));
popover(me, popMe, () => { renderMe(); place(popMe, me); });
popMe.addEventListener("click", e => { if (e.target.closest(".sx-mi")) closePop(); });  // 내 서재·요청·알림은 열고 메뉴는 닫는다

function renderMe() { popMe.innerHTML = personalMenu(); sync(popMe); }

let wasPanel = false;
onChange(() => {
  const S = window.MAP.S, u = unread(), panel = document.body.classList.contains("sx-panel");
  $("#pa-c-color .pv").innerHTML = colorPreview(S.color);
  $("#pa-c-color b").textContent = labelOf(COLORS, S.color);
  $("#pa-c-size b").textContent = labelOf(SIZES, S.size);
  me.innerHTML = avatar(account()) + `<span class="sx-badge" data-n="${u}">${u || ""}</span>`;
  [row, popColor, popSize, popMore, popAll].forEach(sync);
  if (popMe.classList.contains("open")) renderMe();
  if (panel && !wasPanel) closePop();  // 책을 고르면(정보 패널) 팝오버는 비킨다
  wasPanel = panel;
});
addEventListener("resize", closePop);
$$("#pa-row .sx-seg button").forEach(b => b.addEventListener("click", closePop));
if (DEMO === "open") $("#pa-c-color").click();
else if (DEMO === "me") me.click();
