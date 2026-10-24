/* 시안 B · 왼쪽 아이콘 레일 + 사이드 시트 (Kepler.gl·Figma 의 왼쪽 레일, 폰은 네이버 지도식 하단 탭)
   - 레일 위는 지도 [보기], 선 아래는 개인 [내 서재][요청][알림], 맨 아래 [나]. 레일 자체가 '지도 설정 ↔ 개인'을 나눈다
   - 누르면 레일 옆(폰은 탭 위)에 시트 하나. 보기 시트는 자주 쓰는 순: 프리셋 카드 → 색 → 크기 → (접힘) 보기 방식·고급
   - 내 서재는 진짜 폴더 트리 패널(#shelf)을 시트 자리에 붙여 연다(비어 있으면 안내 시트)
   - 조건 버블 바는 검색창 아래에 떠 있고 시트가 열리면 검색창과 함께 오른쪽으로 비킨다(폰은 하단 탭·카드 위) */
import {
  $, $$, el, ICON, ready, onChange, bind, sync, presetCards, colorList, sizeChips, viewSeg, switchRow, advancedHTML,
  accountHTML, avatar, account, shelfCount, canShelf, shelfOpen, openShelf, unread, requestForm, inboxView, protoNav,
  labelOf, VIEWS, DEMO, bubbleBar,
} from "./settings-common.js";

await ready;
protoNav("b", "왼쪽 레일 + 시트");
bubbleBar();

const rail = el(`<nav id="pb-rail" aria-label="메뉴">
  <div class="pb-logo">서재<br>지도</div>
  <button type="button" class="pb-it" data-tab="view">${ICON.layers}<span>보기</span></button>
  <div class="pb-gap" aria-hidden="true"></div>
  <button type="button" class="pb-it" data-tab="shelf">${ICON.shelf}<span>내 서재</span></button>
  <button type="button" class="pb-it" data-tab="request">${ICON.request}<span>요청</span></button>
  <button type="button" class="pb-it" data-tab="inbox">${ICON.bell}<span>알림</span><i class="sx-badge"></i></button>
  <div class="pb-flex"></div>
  <button type="button" class="pb-it pb-me" data-tab="me"><span class="av"></span><span>나</span></button>
</nav>`);
const side = el(`<aside id="pb-sheet" aria-label="설정"><header><b></b><button type="button" class="sx-x" aria-label="닫기">${ICON.close}</button></header><div class="pb-body"></div></aside>`);
document.body.append(rail, side);
const body = $(".pb-body", side);
bind(side);

const TITLES = { view: "지도 보기", shelf: "📚 내 서재", request: "📥 책 요청", inbox: "🔔 알림함", me: "내 계정" };
const viewHTML = () => `
  <section class="pb-sec"><h3 class="sx-h">무엇을 기준으로 놓을까요</h3><div class="pb-presets">${presetCards()}</div></section>
  <section class="pb-sec"><h3 class="sx-h">점 색</h3>${colorList()}</section>
  <section class="pb-sec"><h3 class="sx-h">점 크기</h3>${sizeChips()}</section>
  <section class="pb-sec"><details class="sx-adv"><summary>책 보기 방식 <small class="pb-vnow"></small>${ICON.chev}</summary>
    <div class="pb-in">${viewSeg()}<div class="pb-sws">${switchRow("rot", "자동 회전")}</div>
    <div class="sx-row"><button type="button" class="sx-btn" data-act="reset">처음 보기</button><button type="button" class="sx-btn" data-act="theme">밝게/어둡게</button></div></div></details></section>
  <section class="pb-sec"><details class="sx-adv"><summary>고급 <small>· 축 직접 고르기, 이웃 수</small>${ICON.chev}</summary><div class="pb-in">${advancedHTML({ tools: false })}</div></details></section>`;
const meHTML = () => `<section class="pb-sec">${accountHTML()}</section>
  <section class="pb-sec"><h3 class="sx-h">내 기록</h3><p class="sx-lead">★ 내 서재 ${shelfCount()}권 · 읽고싶음 · 메모 · 검색 기록. 로그인하면 가족 계정 클라우드에, 아니면 이 기기에만 저장돼요.</p></section>`;
const emptyShelfHTML = () => `<section class="pb-sec pb-empty">${ICON.shelf}<b>내 서재가 비어 있어요</b>
  <p class="sx-lead">지도에서 책을 고른 뒤 정보 패널의 <b>☆ 내 서재에 담기</b>를 누르면 여기 폴더로 정리할 수 있어요. 담은 책만 보려면 조건 버블 <b>＋ 조건 → 📚 내 서재만</b>.</p>
  ${account().state === "out" ? `<button type="button" class="sx-btn pri" data-act="login">Google 로그인하고 기기끼리 맞추기</button>` : ""}</section>`;

let tab = null;
function open(t) {
  if (t === tab) return close();
  if (shelfOpen() && t !== "shelf") openShelf();  // 진짜 서재 패널은 닫는다(openShelf 는 토글)
  side.classList.remove("open");
  body.onclick = null;
  if (t === "shelf" && canShelf()) {
    if (!shelfOpen()) openShelf();
    tab = "shelf"; document.body.classList.remove("pb-open"); syncRail();
    return;
  }
  tab = t;
  side.classList.add("open"); document.body.classList.add("pb-open");
  $("header b", side).textContent = TITLES[t];
  if (t === "view") body.innerHTML = viewHTML();
  else if (t === "request") requestForm(body, () => open("inbox"));
  else if (t === "inbox") inboxView(body);
  else if (t === "me") body.innerHTML = meHTML();
  else body.innerHTML = emptyShelfHTML();
  body.scrollTop = 0;
  sync(body); syncRail();
}
function close() {
  if (tab === "shelf" && shelfOpen()) openShelf();
  tab = null; side.classList.remove("open"); document.body.classList.remove("pb-open"); syncRail();
}
function syncRail() {
  $$(".pb-it", rail).forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
}
rail.addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) open(b.dataset.tab); });
$(".sx-x", side).addEventListener("click", close);
addEventListener("keydown", e => { if (e.key === "Escape" && tab && !document.querySelector(".sx-scrim")) close(); });

onChange(() => {
  const u = unread();
  const badge = $(".sx-badge", rail); badge.dataset.n = u; badge.textContent = u || "";
  $(".pb-me .av", rail).innerHTML = avatar(account());
  if (tab === "shelf" && !shelfOpen()) { tab = null; syncRail(); }  // 서재 패널의 ×로 닫음
  if (tab === "me") body.innerHTML = meHTML();
  const vnow = $(".pb-vnow", body); if (vnow) vnow.textContent = "· 지금 " + labelOf(VIEWS, window.MAP.partsMode ? "hub" : "one");
  sync(body);
});
if (DEMO === "open") open("view");
else if (DEMO === "me") open("inbox");
