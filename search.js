/* 자연어 검색: 키워드 즉시 + 브라우저 무료 임베딩(transformers.js).
   책 벡터는 vectors_e5.bin(int8)·search_meta.json. 로컬 지도와 GitHub Pages 정적판에서 같은 파일을 쓴다. */
(() => {
  // ---------------------------------------------------------------- 순위 계산(순수 함수)
  // 비교용 정규화: 대소문자·공백·구두점·기호를 무시한다(한국어 제목도 공백 무시로 비교).
  function normText(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\p{P}\p{S}\s]+/gu, '');
  }
  // 제목·저자 일치 단계: 3 = 정확 일치, 2 = 검색어로 시작, 1 = 검색어 전체가 연속 포함, 0 = 없음
  function matchTier(text, normQuery) {
    if (!text || !normQuery) return 0;
    const t = normText(text);
    if (!t) return 0;
    if (t === normQuery) return 3;
    if (t.startsWith(normQuery)) return 2;
    if (t.includes(normQuery)) return 1;
    return 0;
  }
  const TITLE_BONUS = [0, 0.35, 0.55, 1.0];
  const AUTHOR_BONUS = [0, 0.15, 0.25, 0.45];
  const BONUS_MIN = 2;  // 한 글자 검색어가 모든 책에 가산되는 것 방지
  function matchBonus(it, normQuery) {
    if (!normQuery || normQuery.length < BONUS_MIN) return 0;
    return TITLE_BONUS[matchTier(it.title, normQuery)] + AUTHOR_BONUS[matchTier(it.author, normQuery)];
  }
  function termsOf(q) { return q.trim().toLowerCase().split(/\s+/).filter(Boolean); }
  function kwScore(it, terms) {
    if (!terms.length) return 0;
    const fields = [[it.title, 3], [it.author, 2], [it.original_title, 2], [it.tags, 2], [it.summary, 1]];
    const low = fields.map(([txt, w]) => [txt ? String(txt).toLowerCase() : '', w]);
    const pathLow = it.path ? String(it.path).toLowerCase() : '';
    let sum = 0;
    for (const t of terms) {
      let best = 0;
      for (const [txt, w] of low) if (txt && txt.includes(t)) best = Math.max(best, w);
      if (!best && pathLow.includes(t)) best = 0.5;
      sum += best;
    }
    return sum / terms.length;
  }
  // items(검색 메타의 책 목록)와 선택적 의미 점수(sem = {cos, lo, hi})로 순위를 매긴다.
  function rankItems(items, query, sem) {
    const terms = termsOf(query);
    const nq = normText(query);
    const rows = [];
    items.forEach((it, i) => {
      const kw = kwScore(it, terms);
      const bonus = matchBonus(it, nq);
      const kn = Math.min(1, kw / 2.2);
      let score = kn;
      let semantic = null;
      if (sem) {
        semantic = (sem.cos[i] - sem.lo) / Math.max(1e-9, sem.hi - sem.lo);
        score = 0.38 * kn + 0.62 * semantic;
      }
      score += bonus;
      if (kw > 0 || sem) rows.push({ it, i, score, kw, semantic, bonus });
    });
    rows.sort((a, b) => b.score - a.score || b.kw - a.kw);
    return rows;
  }
  // 장 제목 앞머리 번호(제 5 장, 6장, Chapter 4., 21 , IV. 등)를 떼어 보인다. 원본은 그대로, 다 떼면 원본.
  const CH_NUM = [
    /^제\s*\d+\s*[장부편절강]\s*[.:·\-–—)]?\s*/,
    /^\d+\s*[장부편절강]\s*[.:·\-–—)]?\s*/,
    /^(?:chapter|chap\.?|ch\.|part|lecture|lesson|unit|section)\s*(?:\d+|[ivxlc]+)\b\s*[.:\-–—)]?\s*/i,
    /^(?:\d+(?:\.\d+)*|[IVXLC]+)\s*[.:\-–—)]\s*/,
    /^\d+(?:\.\d+)*\s+/,
  ];
  function chTitle(t) {
    const raw = String(t == null ? '' : t).trim();
    let s = raw;
    for (const re of CH_NUM) s = s.replace(re, '');
    return s.trim() || raw;
  }
  // 장 행(search_meta_ch.json 의 {point, no, title, desc}) 순위. 점수식은 책과 같고, 책 제목은 보지 않는다(책 목록 담당).
  // 한 책이 독차지하지 않게 같은 point 는 perBook 개까지, 전체 limit 개.
  function rankChapters(chItems, query, sem, opts = {}) {
    const perBook = opts.perBook || 2, limit = opts.limit || 10;
    const terms = termsOf(query);
    const nq = normText(query);
    const rows = [];
    chItems.forEach((it, i) => {
      let kw = 0;
      if (terms.length) {
        const title = it.title ? String(it.title).toLowerCase() : '';
        const desc = it.desc ? String(it.desc).toLowerCase() : '';
        for (const t of terms) kw += title.includes(t) ? 3 : desc.includes(t) ? 1 : 0;
        kw /= terms.length;
      }
      const bonus = nq.length >= BONUS_MIN ? TITLE_BONUS[matchTier(chTitle(it.title), nq)] : 0;
      const kn = Math.min(1, kw / 2.2);
      let score = kn;
      let semantic = null;
      if (sem) {
        semantic = (sem.cos[i] - sem.lo) / Math.max(1e-9, sem.hi - sem.lo);
        score = 0.38 * kn + 0.62 * semantic;
      }
      score += bonus;
      if (kw > 0 || sem) rows.push({ it, i, score, kw, semantic, bonus, ch: true });
    });
    rows.sort((a, b) => b.score - a.score || b.kw - a.kw);
    const seen = new Map(), out = [];
    for (const r of rows) {
      const n = seen.get(r.it.point) || 0;
      if (n >= perBook) continue;
      seen.set(r.it.point, n + 1);
      out.push(r);
      if (out.length >= limit) break;
    }
    return out;
  }
  // 화면(=키보드) 순서: 책 상위 head 개 → 장 구간 → 나머지 책. 장이 키 큰 책 카드 아래에 묻히지 않게.
  const BOOKS_BEFORE_CH = 5;
  function mixRows(books, chRows, head = BOOKS_BEFORE_CH) {
    return books.slice(0, head).concat(chRows, books.slice(head));
  }
  // Node 테스트용 export(브라우저에서는 window/DOM 경로로 이어간다)
  const rankAPI = { normText, matchTier, matchBonus, termsOf, kwScore, rankItems, rankChapters, chTitle, mixRows };
  if (typeof module !== 'undefined' && module.exports) module.exports = rankAPI;
  if (typeof window === 'undefined') { globalThis.__bookSearchRankAPI = rankAPI; return; }

  // ---------------------------------------------------------------- 저장소
  // 저장 접근은 이 객체 하나로 모은다(지금은 localStorage, 나중에 로그인 동기화를 붙일 자리).
  // get/set 은 JSON, on(type, fn) 은 키 이름 또는 'change' 이벤트를 받는다.
  window.store = window.store || (() => {
    const mem = new Map(), subs = new Map();
    let ls = null;
    try { ls = window.localStorage; const k = '__bookmap_probe__'; ls.setItem(k, '1'); ls.removeItem(k); } catch (_) { ls = null; }
    const read = key => {
      try {
        const raw = ls ? ls.getItem(key) : (mem.has(key) ? mem.get(key) : null);
        return raw == null ? undefined : JSON.parse(raw);
      } catch (_) { return undefined; }
    };
    const emit = (type, detail) => {
      for (const fn of (subs.get(type) || []).slice()) { try { fn(detail); } catch (_) { /* 구독자 오류는 삼킨다 */ } }
    };
    return {
      get(key, fallback = null) { const v = read(key); return v === undefined ? fallback : v; },
      set(key, value) {
        try {
          const raw = JSON.stringify(value);
          if (ls) ls.setItem(key, raw); else mem.set(key, raw);
        } catch (_) { /* 저장 불가(사생활 모드 등) */ }
        emit(key, value);
        emit('change', { key, value });
        return value;
      },
      on(type, fn) { if (!subs.has(type)) subs.set(type, []); subs.get(type).push(fn); },
      off(type, fn) { const a = subs.get(type); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    };
  })();
  const store = window.store;

  const MODEL = 'Xenova/multilingual-e5-small';
  const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
  const qEl = document.getElementById('q');
  const box = document.getElementById('results');
  if (!qEl || !box) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const driveURL = fid => fid ? `https://drive.google.com/file/d/${encodeURIComponent(fid)}/view` : '';

  let meta = null;
  let vectors = null;
  let norms = null;
  let modelPromise = null;
  let loadNote = '';
  let timer = 0;
  let seq = 0;
  let semCache = { q: '', qv: null, cos: null, lo: 0, hi: 0, chCos: null };
  // 장 검색 자산(search_meta_ch.json·vectors_e5_ch.bin)은 첫 검색 때 받는다. 없거나 실패하면 장 구간만 없다.
  let ch = null;          // { items, dim, vectors, norms }
  let chPromise = null;
  // 폰·데이터 절약이면 모델(약 130MB)은 버튼으로 동의받은 뒤에 받는다. 한 번 켜면 기억한다.
  const touchy = matchMedia('(pointer: coarse)').matches || innerWidth <= 768;
  const saveData = (() => { try { const c = navigator.connection; return !!(c && (c.saveData || /2g/.test(c.effectiveType || ''))); } catch (_) { return false; } })();
  let semOK = !(touchy || saveData);
  try { if (localStorage.getItem('bookmap-sem') === '1') semOK = true; } catch (_) { /* 저장 불가 */ }
  let chOK = !saveData || semOK;  // 데이터 절약이면 의미 검색을 켠 뒤에만 장 자산(약 5MB)을 받는다

  // 결과 점 번호를 알린다(3D 지도가 강조). null = 검색 없음
  // 지도의 '검색어' 조건 버블은 window.lastSearch(검색어·결과 점)를 읽는다.
  const emit = rows => {
    const pts = rows ? [...new Set(rows.map(r => r.it.point))] : null;  // 책 점 뒤에 장으로 찾은 책 점(중복 제거)
    window.lastSearch = pts ? { q: qEl.value.trim(), pts } : null;
    window.dispatchEvent(new CustomEvent('websearch', { detail: pts }));
  };
  fetch('search_meta.json', { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(async m => {
      const buf = await fetch('vectors_e5.bin').then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
      meta = m;
      vectors = new Int8Array(buf);
      norms = normsOf(vectors, m.items.length, m.dim);
      if (qEl.value.trim()) update();
    })
    .catch(err => { console.warn('검색 자산을 읽지 못했습니다', err); });

  function normsOf(vecs, n, dim) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      const off = i * dim;
      for (let d = 0; d < dim; d++) { const v = vecs[off + d]; s += v * v; }
      out[i] = Math.sqrt(s) || 1;
    }
    return out;
  }

  // 장 자산을 조용히 받는다(상태 문구·스피너 없음). 도착하면 장 구간이 나타난다.
  async function loadChapters() {
    try {
      const m = await fetch('search_meta_ch.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
      const buf = await fetch('vectors_e5_ch.bin', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
      const vecs = new Int8Array(buf);
      if (!Array.isArray(m.items) || vecs.length < m.items.length * m.dim) throw new Error('장 자산 크기 불일치');
      ch = { items: m.items, dim: m.dim, vectors: vecs, norms: normsOf(vecs, m.items.length, m.dim) };
    } catch (err) {
      console.warn('장 검색 자산을 읽지 못했습니다(장 결과 없이 계속)', err);
      ch = null;
      return;
    }
    if (semCache.qv && semCache.q === qEl.value.trim()) semCache.chCos = cosines(semCache.qv, ch.vectors, ch.norms, ch.dim);
    if (view === 'list' && qEl.value.trim()) rerender();
  }

  function ensureModel() {
    if (!modelPromise) {
      loadNote = '의미 검색 모델 불러오는 중…';
      renderStatus();
      modelPromise = (async () => {
        const { pipeline, env } = await import(CDN);
        try { env.allowLocalModels = false; } catch (_) { /* 버전 차이 */ }
        return pipeline('feature-extraction', MODEL, {
          dtype: 'q8',
          progress_callback: p => {
            if (!p) return;
            if (p.status === 'progress' && typeof p.progress === 'number') loadNote = `의미 검색 모델 불러오는 중… ${Math.round(p.progress)}%`;
            else if (p.status === 'ready') loadNote = '의미 검색 모델 준비 완료';
            renderStatus();
          },
        });
      })();
      modelPromise.catch(err => { loadNote = '의미 검색 모델을 불러오지 못했습니다 (키워드 결과만)'; console.warn('임베딩 모델 실패', err); renderStatus(); });
    }
    return modelPromise;
  }

  async function embed(texts) {
    const ex = await ensureModel();
    const out = await ex(texts, { pooling: 'mean', normalize: true });
    const dim = out.dims[out.dims.length - 1];
    const list = [];
    for (let i = 0; i < texts.length; i++) list.push(Float32Array.from(out.data.slice(i * dim, (i + 1) * dim)));
    return list;
  }
  window.__websearchEmbed = embed;
  window.__websearchMeta = () => meta;

  // 질문 벡터와 int8 벡터 묶음(책 또는 장)의 코사인, 정규화용 최소·최대
  function cosines(qvec, vecs, nrm, dim) {
    const out = new Float32Array(nrm.length);
    let qn = 0;
    for (let d = 0; d < dim; d++) qn += qvec[d] * qvec[d];
    qn = Math.sqrt(qn) || 1;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < nrm.length; i++) {
      let dot = 0;
      const off = i * dim;
      for (let d = 0; d < dim; d++) dot += vecs[off + d] * qvec[d];
      const c = dot / (nrm[i] * qn);
      out[i] = c;
      if (c < lo) lo = c;
      if (c > hi) hi = c;
    }
    return { cos: out, lo, hi };
  }

  function rank(query) {
    if (!meta) return { rows: [], status: '검색 자료를 읽는 중…' };
    const sem = semCache.q === query && semCache.cos ? semCache : null;
    const rows = rankItems(meta.items, query, sem);
    let status;
    if (sem) status = '키워드 + 의미';
    else if (modelPromise) status = loadNote || '의미 검색 모델 불러오는 중…';
    else status = semOK ? '키워드' : '키워드 (의미 검색 꺼짐)';
    const books = rows.slice(0, 20);
    const chRows = ch ? rankChapters(ch.items, query, semCache.q === query ? semCache.chCos : null) : [];
    return { rows: mixRows(books, chRows), status, total: rows.length, chTotal: chRows.length };
  }

  // ---------------------------------------------------------------- 결과 패널(구글 지도식)
  // 검색어가 있으면 패널은 '펼침'(카드 목록) 또는 '접힘'(결과 N개 줄)이다. 지도를 만져도 검색어·결과는 남는다.
  const ctl = document.getElementById('ctl');
  const panel = document.getElementById('panel');
  const narrow = () => innerWidth <= 720;
  let last = { rows: [], status: '', total: null };
  let folded = false;
  let active = -1;      // 방향키로 고른 줄
  let current = -1;     // 지도에서 선택된 점(목록에서 강조)
  let leaveTimer = 0;
  let keyAt = 0;
  let view = 'list';    // 'list' = 검색 결과, 'recents' = 최근 검색
  let recActive = -1;
  const SEARCH_KEY = 'bookmap-search';

  // ---------------------------------------------------------------- 최근 검색(로그인 없이 이 브라우저에만)
  function recentList() {
    const a = store.get(SEARCH_KEY, []);
    return (Array.isArray(a) ? a : []).filter(q => typeof q === 'string' && q.trim()).slice(0, 20);
  }
  function saveRecentList(a) { store.set(SEARCH_KEY, a.slice(0, 20)); }
  function rememberSearch(q) {
    q = String(q || '').trim();
    if (!q) return;
    const a = recentList().filter(x => x.toLowerCase() !== q.toLowerCase());
    a.unshift(q);
    saveRecentList(a);
  }

  function place() {
    if (narrow()) { box.style.left = box.style.top = box.style.width = box.style.maxHeight = ''; return; }
    const c = ctl.getBoundingClientRect();
    const right = panel && panel.classList.contains('open') ? panel.getBoundingClientRect().width + 32 : 16;
    const chips = document.getElementById('chips');  // 조건 버블 줄이 있으면 그 아래
    let left = 16, top = (chips && chips.offsetHeight ? chips : document.getElementById('top')).getBoundingClientRect().bottom + 6;
    if (ctl.classList.contains('open')) { left = c.right + 8; top = c.top; }  // 보기 설정이 열려 있으면 그 옆에
    const width = Math.max(260, Math.min(480, innerWidth - left - right));
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = width + 'px';
    box.style.maxHeight = Math.max(160, innerHeight - top - 90) + 'px';
  }
  function setFold(f) {
    folded = f;
    box.classList.toggle('fold', f);
    document.body.classList.toggle('sopen', !f && box.classList.contains('on'));
    place();
  }
  function show() { box.classList.add('on'); setFold(false); }
  function fold() { if (box.classList.contains('on')) setFold(true); }
  function close() { box.classList.remove('on', 'fold'); document.body.classList.remove('sopen'); active = -1; view = 'list'; recActive = -1; }

  const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  function paintRecents() {
    view = 'recents';
    const a = recentList();
    const rows = a.map((q, k) => `<div class="rc${k === recActive ? ' act' : ''}" role="option" data-k="${k}">`
      + `<span class="rci">${CLOCK}</span><span class="rct">${esc(q)}</span>`
      + `<button class="rcx" type="button" data-x="${k}" aria-label="검색어 삭제">×</button></div>`).join('');
    box.innerHTML = `<div class="rch"><b>최근 검색</b>${a.length ? '<button class="rca" type="button">모두 지우기</button>' : ''}</div>`
      + `<div class="slist">${a.length ? rows : '<div class="snone">최근 검색이 없습니다.</div>'}</div>`;
    place();
  }
  function showRecents() {
    if (view !== 'recents') recActive = -1;
    emit(null);
    box.classList.add('on');
    box.classList.remove('fold');
    document.body.classList.toggle('sopen', !narrow());
    paintRecents();
  }
  function runRecent(k) {
    const q = recentList()[k];
    if (!q) return;
    qEl.value = q;
    rememberSearch(q);
    view = 'list';
    recActive = -1;
    show();
    qEl.focus();
    update();
  }

  const kindOf = r => r.semantic == null ? '키워드' : r.kw > 0 && r.semantic >= 0.6 ? '키워드+의미' : r.kw > 0 ? '키워드' : '의미';
  function render(rows, status, total, chTotal = 0) {
    view = 'list';
    last = { rows, status, total, chTotal };
    emit(rows);
    const loading = /중…/.test(status);
    const count = total == null ? '검색 중' : `결과 ${total}개${chTotal ? ` · 장 ${chTotal}` : ''}`;
    const pinned = window.chips && window.chips.has('q', qEl.value.trim());
    const bar = `<div class="shead"><button class="sbar" type="button" aria-expanded="${!folded}">`
      + `<b>${count}</b><span class="sst${loading ? ' ld' : ''}">${esc(status)}</span>`
      + `<span class="sfold">${folded ? '펼치기' : '접기'}<i>⌃</i></span></button>`
      + (rows.length && window.chips ? `<button class="spin${pinned ? ' on' : ''}" type="button" title="이 검색 결과만 지도에 남기기(조건 버블)"${pinned ? ' disabled' : ''}>${pinned ? '거르는 중' : '결과만 보기'}</button>` : '')
      + `</div>`;
    let list;
    if (!rows.length) list = `<div class="snone">${total == null ? '검색 자료를 읽는 중…' : '맞는 책이 없습니다.'}</div>`;
    let bookNo = 0;
    if (rows.length) list = rows.map((r, k) => {
      const it = r.it;
      const prev = rows[k - 1];
      if (r.ch) {  // 장 행: 번호·태그 칩·드라이브·부분 배지 없이 "이 책의 이 장"만
        const b = (meta && meta.items[it.point]) || {};
        const kind = kindOf(r);
        const cls = 'rr ch' + (k === active ? ' act' : '') + (it.point === current ? ' cur' : '');
        return (!prev || !prev.ch ? '<div class="sdiv">장(章)</div>' : '')
          + `<div class="${cls}" role="option" data-k="${k}">`
          + `<span class="rk">장</span>`
          + `<div class="rm"><div class="rt">${esc(chTitle(it.title))}</div><div class="ra">${esc(b.title || '')} · ${esc(b.author || '저자 미상')}</div>`
          + `${it.desc ? `<div class="rs">${esc(it.desc)}</div>` : ''}`
          + `<div class="rf"><span class="rkind ${kind === '의미' ? 'sem' : kind === '키워드' ? 'kw' : 'both'}">${kind}</span>`
          + `<span class="rsc" title="${r.semantic == null ? '키워드 점수' : '키워드+의미 점수'}">${Math.round(r.score * 100)}점</span>`
          + '</div></div></div>';
      }
      const tg = (P[it.point] && P[it.point].tg) || [];  // AI 주제 태그: 누르면 지도에 그 태그 버블(AND)
      const tags = !tg.length && it.tags ? String(it.tags).split(/\s*[,·]\s*/).filter(Boolean).slice(0, 4).join(' · ') : '';
      const link = driveURL(it.fid);
      const kind = kindOf(r);
      const cls = 'rr' + (k === active ? ' act' : '') + (it.point === current ? ' cur' : '');
      return (prev && prev.ch ? '<div class="sdiv">나머지 책</div>' : '')
        + `<div class="${cls}" role="option" data-k="${k}" data-i="${r.i}">`
        + `<span class="rk">${++bookNo}</span>`
        + `<div class="rm"><div class="rt">${esc(it.title)}${it.scope === '부분' ? `<span class="sbadge" title="책 일부만 담긴 파일">부분${it.chapter ? ` · ${esc(it.chapter)}` : ''}</span>` : ''}</div><div class="ra">${esc(it.author || '저자 미상')}${tags ? ` · ${esc(tags)}` : ''}</div>`
        + `${it.summary ? `<div class="rs">${esc(it.summary)}</div>` : ''}`
        + (tg.length && window.tagHTML ? `<div class="rtg">${tg.slice(0, 4).map(window.tagHTML).join('')}</div>` : '')
        + `<div class="rf"><span class="rkind ${kind === '의미' ? 'sem' : kind === '키워드' ? 'kw' : 'both'}">${kind}</span>`
        + `<span class="rsc" title="${r.semantic == null ? '키워드 점수' : '키워드+의미 점수'}">${Math.round(r.score * 100)}점</span>`
        + (link ? `<a class="rd" href="${link}" target="_blank" rel="noopener" title="드라이브에서 열기">드라이브 ↗</a>` : '')
        + '</div></div></div>';
    }).join('');
    if (!semOK && !modelPromise) list = '<button class="semon" type="button">의미 검색 켜기 (모델 약 130MB 내려받기)</button>' + list;
    const y = box.querySelector('.slist') ? box.querySelector('.slist').scrollTop : 0;
    box.innerHTML = bar + `<div class="slist">${list}</div>`;
    box.querySelector('.slist').scrollTop = y;
  }
  function rerender() {
    const query = qEl.value.trim();
    if (!query) { close(); emit(null); return; }
    const r = rank(query);
    render(r.rows, r.status, r.total, r.chTotal);
  }
  function renderStatus() { if (qEl.value.trim()) rerender(); }
  const repaint = () => render(last.rows, last.status, last.total, last.chTotal);

  function choose(k) {
    const r = last.rows[k];
    if (!r || typeof r.it.point !== 'number') return;
    rememberSearch(qEl.value);
    const p = P[r.it.point];
    if (!p) return;
    let target = r.it.point;
    if (typeof member === 'function' && !member(p) && p.parts && p.parts.length) target = repOf(target);
    active = k;
    select(target, true);       // 목록은 그대로 둔다(다른 결과를 이어서 볼 수 있게)
    if (narrow()) fold();       // 폰: 정보 시트가 보이도록 접는다
  }

  async function update(allowSearch = true) {
    const query = qEl.value.trim();
    if (!query) { close(); emit(null); return; }
    const mine = ++seq;
    active = -1;
    const first = rank(query);
    render(first.rows, first.status, first.total, first.chTotal);
    if (query.length >= 2 && chOK && !chPromise) chPromise = loadChapters();  // 의미 검색과 무관하게(키워드 장 결과도 쓰이게)
    if (!allowSearch || !semOK || !meta || query.length < 2) return;
    try {
      const [qv] = await embed(['query: ' + query]);
      if (mine !== seq || qEl.value.trim() !== query) return;
      const c = cosines(qv, vectors, norms, meta.dim);
      semCache = { q: query, qv, ...c, chCos: ch ? cosines(qv, ch.vectors, ch.norms, ch.dim) : null };
      const done = rank(query);
      render(done.rows, done.status, done.total, done.chTotal);
    } catch (_) { /* 상태 문구는 ensureModel 쪽에서 */ }
  }

  box.addEventListener('click', e => {
    if (e.target.closest('.rd')) return;
    if (view === 'recents') {
      const x = e.target.closest('.rcx');
      if (x) { const a = recentList(); a.splice(+x.dataset.x, 1); saveRecentList(a); recActive = -1; paintRecents(); return; }
      if (e.target.closest('.rca')) { saveRecentList([]); recActive = -1; paintRecents(); return; }
      const rc = e.target.closest('.rc');
      if (rc) runRecent(+rc.dataset.k);
      return;
    }
    if (e.target.closest('.sbar')) { setFold(!folded); repaint(); return; }
    const tagB = e.target.closest('[data-tag]');
    if (tagB) { if (window.chips) window.chips.addTag(tagB.dataset.tag); return; }
    if (e.target.closest('.spin')) { const q = qEl.value.trim(); if (q && window.chips) window.chips.set({ k: 'q', v: q }); repaint(); return; }
    if (e.target.closest('.semon')) {
      semOK = true;
      chOK = true;
      try { localStorage.setItem('bookmap-sem', '1'); } catch (_) { /* 저장 불가 */ }
      update();
      return;
    }
    const row = e.target.closest('.rr');
    if (row) choose(+row.dataset.k);
  });
  qEl.addEventListener('input', () => {
    seq++;  // 진행 중인 의미 검색 결과는 버린다(입력이 바뀌었으므로)
    clearTimeout(timer);
    const wasRecents = view === 'recents';
    view = 'list';
    if (!qEl.value.trim()) {  // × 로 지움
      emit(null);
      if (document.activeElement === qEl) showRecents(); else close();
      return;
    }
    if (wasRecents || !box.classList.contains('on')) { show(); rerender(); }
    else if (folded) { setFold(false); repaint(); }
    timer = setTimeout(() => update(), 260);
  });
  const reopen = () => {
    if (!qEl.value.trim()) { showRecents(); return; }  // 빈 검색창: 최근 검색
    if (!box.classList.contains('on') || folded || view !== 'list') { view = 'list'; show(); repaint(); }
  };
  qEl.addEventListener('focus', reopen);
  qEl.addEventListener('pointerdown', reopen);  // 터치: 검색창을 누르면 다시 펼침
  qEl.addEventListener('keydown', e => {
    keyAt = performance.now();
    if (view === 'recents') {
      const recs = recentList();
      if (e.key === 'Escape') { e.preventDefault(); close(); qEl.blur(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!recs.length) return;
        e.preventDefault();
        recActive = e.key === 'ArrowDown' ? (recActive + 1) % recs.length : (recActive <= 0 ? recs.length - 1 : recActive - 1);
        paintRecents();
        const el = box.querySelector('.rc.act');
        if (el) el.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (recActive >= 0) runRecent(recActive);
        return;
      }
      return;
    }
    const n = last.rows.length;
    if (e.key === 'Escape') { e.preventDefault(); if (box.classList.contains('on') && !folded) { setFold(true); repaint(); } else qEl.blur(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!n) return;
      e.preventDefault();
      if (folded) { setFold(false); }
      active = e.key === 'ArrowDown' ? (active + 1) % n : (active <= 0 ? n - 1 : active - 1);
      repaint();
      const el = box.querySelector('.rr.act');
      if (el) el.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      rememberSearch(qEl.value);
      if (touchy && active < 0) { qEl.blur(); return; }  // 폰: 키보드만 내리고 목록을 보여 준다
      if (n) choose(active >= 0 ? active : 0);
    }
  });
  // 지도·정보 패널을 누르면 접는다(지우지 않음)
  document.addEventListener('pointerdown', e => {
    if (box.contains(e.target) || ctl.contains(e.target)) return;
    if (narrow() && panel && panel.contains(e.target)) return;
    clearTimeout(leaveTimer);
    if (view === 'recents') { close(); return; }
    if (box.classList.contains('on') && !folded) { setFold(true); repaint(); }
  });
  // 마우스: 검색창·설정 카드·목록 근처(여유 28px)에 오면 펼치고, 벗어나면 잠시 뒤 접는다
  const near = (el, x, y, pad) => { const r = el.getBoundingClientRect(); return r.width && x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad; };
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons || !qEl.value.trim()) return;
    const inside = near(ctl, e.clientX, e.clientY, 28) || (box.classList.contains('on') && near(box, e.clientX, e.clientY, 28));
    if (inside) { clearTimeout(leaveTimer); leaveTimer = 0; if (folded || !box.classList.contains('on')) { show(); repaint(); } }
    else if (box.classList.contains('on') && !folded && !leaveTimer && performance.now() - keyAt > 1500) {
      leaveTimer = setTimeout(() => { leaveTimer = 0; setFold(true); repaint(); }, 400);
    }
  });
  // 폰 뒤로가기(지도 페이지가 보냄): 펼친 목록을 접는다
  window.addEventListener('searchfold', () => { if (view === 'list' && box.classList.contains('on') && !folded) { setFold(true); repaint(); } });
  // 지도에서 선택이 바뀌면 그 책을 목록에서 강조
  window.addEventListener('bookselect', e => {
    current = e.detail;
    if (view === 'list' && box.classList.contains('on')) repaint();
  });
  new MutationObserver(place).observe(ctl, { attributes: true, attributeFilter: ['class'] });
  if (panel) new MutationObserver(place).observe(panel, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', () => { if (box.classList.contains('on')) place(); });
  window.addEventListener('chipschange', () => { if (box.classList.contains('on')) { place(); if (view === 'list') repaint(); } });
})();
