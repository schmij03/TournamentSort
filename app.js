/* Tournamentsort: digitales Legeschema fürs iPad */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const STORE_SEL = 'tsort_selection_v2';
const STORE_GAME = 'tsort_game_v2';
const MAX = 32; // höchstens so viele Karten im Turnier

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- Zahlen ---------------- */
function fmtCount(n) {
  const f = (v, d) => {
    const r = Math.round(v * 10 ** d) / 10 ** d;
    return r.toFixed(d).replace(/\.?0+$/, '').replace('.', ',');
  };
  if (n >= 1e9) return f(n / 1e9, n < 1e10 ? 2 : 1) + ' Mrd.';
  if (n >= 1e6) return f(n / 1e6, n < 1e7 ? 2 : 1) + ' Mio.';
  if (n >= 1e4) return f(n / 1e3, n < 1e5 ? 1 : 0) + 'K';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
}

const CRIT = {
  followers: { label: 'Follower', more: 'mehr Followern', fewer: 'weniger Followern', lessN: 'weniger Follower', moreN: 'mehr Follower' },
  posts: { label: 'Beiträge', more: 'mehr Beiträgen', fewer: 'weniger Beiträgen', lessN: 'weniger Beiträge', moreN: 'mehr Beiträge' }
};

/* ---------------- Accounts ---------------- */
// Die Accounts kommen aus data/accounts.json (von der GitHub Action wöchentlich aktualisiert).
let profiles = [];
let selectedIds = new Set(load(STORE_SEL, []));

function saveSelection() { store(STORE_SEL, [...selectedIds]); }
function selectedProfiles() { return profiles.filter(p => selectedIds.has(p.id)).slice(0, MAX); }

function initials(p) {
  const base = (p.name || p.handle || '?').replace(/\(.*?\)/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim() || '?';
  const parts = base.split(/\s+/);
  return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}
function colorFor(str) {
  let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 50%)`;
}
function avatarHTML(p, cls = '') {
  const style = `background:${colorFor(p.handle)}`;
  const ini = esc(initials(p));
  if (p.img) {
    return `<div class="av ${cls}"><div class="av-in" style="${style}"><img src="${esc(p.img)}" alt="" draggable="false" loading="lazy" onerror="this.parentNode.textContent='${ini}'"></div></div>`;
  }
  return `<div class="av ${cls}"><div class="av-in" style="${style}">${ini}</div></div>`;
}
const platLabel = p => p === 'tiktok' ? 'TT' : 'IG';
const norm = s => String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const displayName = p => p.name ? p.name : '@' + p.handle;
const showHandle = p => p.name && norm(p.name) !== norm(p.handle);

async function loadAccounts() {
  try {
    const r = await fetch('data/accounts.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    profiles = (data.accounts || [])
      .filter(a => a.followers > 0)
      .map(a => ({ id: `${a.platform}_${a.handle}`, platform: a.platform, handle: a.handle, name: a.name || '', followers: a.followers, posts: a.posts ?? 0, img: a.img || null }))
      .sort((a, b) => displayName(a).localeCompare(displayName(b), 'de', { sensitivity: 'base' }));
    if (data.updated) $('#data-date').textContent = `Stand ${data.updated.split('-').reverse().join('.')} · ${profiles.length} Accounts`;
  } catch (e) {
    $('#grid').innerHTML = '<p class="muted center">Die Accounts konnten nicht geladen werden. Lade die Seite neu.</p>';
    return;
  }
  // nur Auswahl behalten, die es noch gibt; sonst 8 zufällig vorschlagen
  selectedIds = new Set([...selectedIds].filter(id => profiles.some(p => p.id === id)));
  if (!selectedIds.size) shuffle(profiles.slice()).slice(0, 8).forEach(p => selectedIds.add(p.id));
  saveSelection();
  renderGrid();
}

function renderGrid() {
  const q = $('#search').value.trim().toLowerCase().replace(/^@/, '');
  const shown = q ? profiles.filter(p => (p.handle + ' ' + p.name).toLowerCase().includes(q)) : profiles;
  $('#grid').innerHTML = shown.map(p => `
    <button type="button" class="tile${selectedIds.has(p.id) ? ' sel' : ''}" data-id="${esc(p.id)}" aria-pressed="${selectedIds.has(p.id)}">
      <span class="check" aria-hidden="true">✓</span>
      ${avatarHTML(p, 'big')}
      <b class="tile-name">${esc(displayName(p))}</b>
      <span class="tile-handle">${showHandle(p) ? '@' + esc(p.handle) : 'TikTok'}</span>
      <span class="tile-stats">
        <span><b>${fmtCount(p.followers)}</b><small>Follower</small></span>
        <span><b>${fmtCount(p.posts)}</b><small>Beiträge</small></span>
      </span>
    </button>`).join('');
  $('#grid-empty').hidden = shown.length > 0 || !profiles.length;
  renderSelbar();
}

function renderSelbar() {
  const sel = selectedProfiles();
  const n = sel.length;
  const leaves = n >= 2 ? leafCount(n) : 0;
  $('#sel-count').innerHTML = n
    ? `<b>${n}</b> ausgewählt${n >= 2 ? ` <span class="muted">· Baum mit ${leaves} Startplätzen</span>` : ''}`
    : 'Noch nichts ausgewählt';
  $('#sel-avatars').innerHTML = sel.slice(0, 6).map(p => avatarHTML(p, 'mini')).join('') + (n > 6 ? `<span class="more">+${n - 6}</span>` : '');
  $('#go-game').disabled = n < 2;
}

function initProfileView() {
  $('#grid').addEventListener('click', e => {
    const t = e.target.closest('.tile'); if (!t) return;
    const id = t.dataset.id;
    if (selectedIds.has(id)) selectedIds.delete(id);
    else {
      if (selectedIds.size >= MAX) return toast(`Es können höchstens ${MAX} Accounts ins Turnier.`, 'err');
      selectedIds.add(id);
    }
    t.classList.toggle('sel', selectedIds.has(id));
    t.setAttribute('aria-pressed', selectedIds.has(id));
    saveSelection(); renderSelbar();
  });
  $('#search').addEventListener('input', renderGrid);
  $$('#pick-random [data-n]').forEach(b => b.addEventListener('click', () => {
    const N = +b.dataset.n;
    selectedIds = new Set(shuffle(profiles.slice()).slice(0, N).map(p => p.id));
    saveSelection(); renderGrid();
    toast(`${Math.min(N, profiles.length)} Accounts zufällig gewählt.`, 'ok');
  }));
  $('#clear-sel').addEventListener('click', () => { selectedIds.clear(); saveSelection(); renderGrid(); });
  $('#go-game').addEventListener('click', () => showView('game'));
}

/* ---------------- Turnier ---------------- */
/*
  Baum als Array (wie ein Heap): Index 0 = «Rang», darunter 1..2, 3..6, … bis zur untersten Reihe.
  Kinder von i: 2i+1 und 2i+2. Bei 8 Startplätzen hat der Baum 15 Felder, bei 16 sind es 31, bei 32 sind es 63.
  Plätze heissen t0… (Baum), r0… (Rangliste), b0… (Startkarten).
*/
let game = load(STORE_GAME, null);
let selected = null;
let autoTimer = null;
let L = null; // aktuelles Layout
let rankTimer = null;
const cardEls = new Map();

const parentOf = i => (i - 1) >> 1;
const siblingOf = i => (i % 2 ? i + 1 : i - 1);
const levelOf = i => Math.floor(Math.log2(i + 1));
const leafCount = n => { let l = 2; while (l < n) l *= 2; return l; };
const isLeaf = i => i >= game.leaves - 1;

function newGame() {
  const sel = selectedProfiles();
  const cards = {};
  for (const p of sel) cards[p.id] = { id: p.id, platform: p.platform, handle: p.handle, name: p.name, followers: p.followers, posts: p.posts ?? null, img: p.img };
  const ids = shuffle(sel.map(p => p.id));
  let crit = (game && game.crit) || 'followers';
  if (crit === 'posts' && sel.some(p => p.posts == null)) crit = 'followers';
  const dir = (game && game.dir) || 'desc';
  const leaves = leafCount(ids.length);
  game = {
    crit, dir, leaves,
    sig: signature(),
    cards,
    n: ids.length,
    tree: Array(2 * leaves - 1).fill(null),
    rank: Array(ids.length).fill(null),
    bench: Array.from({ length: leaves }, (_, i) => ids[i] || null),
    phase: 'setup',
    comparisons: 0, mistakes: 0, hints: 0,
    log: [], hist: []
  };
  selected = null;
  saveGame();
}
function signature() { return selectedProfiles().map(p => `${p.id}:${p.followers}:${p.posts}`).join('|'); }
function saveGame() { if (game) store(STORE_GAME, game); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function get(key) { const t = key[0], i = +key.slice(1); return (t === 't' ? game.tree : t === 'r' ? game.rank : game.bench)[i]; }
function set(key, v) { const t = key[0], i = +key.slice(1); (t === 't' ? game.tree : t === 'r' ? game.rank : game.bench)[i] = v; }
function locOf(id) {
  let i = game.tree.indexOf(id); if (i >= 0) return 't' + i;
  i = game.rank.indexOf(id); if (i >= 0) return 'r' + i;
  i = game.bench.indexOf(id); if (i >= 0) return 'b' + i;
  return null;
}
const card = id => game.cards[id];
const crit = () => CRIT[game.crit || 'followers'];
const val = c => c[game.crit || 'followers'] ?? 0;
const who = c => `@${c.handle} (${fmtCount(val(c))} ${crit().label})`;
const desc = () => game.dir !== 'asc';

function subtreeEmpty(i) {
  if (i >= game.tree.length) return true;
  if (game.tree[i]) return false;
  return subtreeEmpty(2 * i + 1) && subtreeEmpty(2 * i + 2);
}
// Gewinnt a gegen b? Gleichstand (auch gleich angezeigte Zahlen) zählt für beide.
function beats(a, b) {
  if (fmtCount(val(a)) === fmtCount(val(b))) return true;
  return desc() ? val(a) > val(b) : val(a) < val(b);
}

function snapshot() {
  game.hist.push(JSON.stringify({ tree: game.tree, rank: game.rank, bench: game.bench, phase: game.phase, comparisons: game.comparisons, log: game.log }));
  if (game.hist.length > 200) game.hist.shift();
}

/* Alle erlaubten Züge, von unten nach oben (die Karte bei «Rang» wird automatisch eingeordnet) */
function validMoves() {
  const moves = [];
  if (game.phase !== 'play') return moves;
  for (let i = game.tree.length - 1; i >= 1; i--) {
    const id = game.tree[i]; if (!id) continue;
    const p = parentOf(i); if (game.tree[p]) continue;
    const s = siblingOf(i), sid = game.tree[s];
    if (sid ? beats(card(id), card(sid)) : subtreeEmpty(s)) {
      // bei Gleichstand nur einen der beiden vorschlagen
      if (sid && beats(card(sid), card(id)) && s > i) continue;
      moves.push({ id, to: 't' + p });
    }
  }
  return moves;
}

function tryMove(id, to, auto = false) {
  const from = locOf(id);
  clearSelection();
  if (!from || from === to) { layoutCards(); return false; }
  const ft = from[0], fi = +from.slice(1), tt = to[0], ti = +to.slice(1);

  if (game.phase === 'done') { layoutCards(); return false; }

  if (game.phase === 'setup') {
    if (tt === 'r' || (tt === 't' && !isLeaf(ti))) return fail(id, 'Lege zuerst alle Karten in die unterste Reihe und tippe dann auf «Turnier starten».');
    const other = get(to);
    snapshot();
    set(to, id); set(from, other);
    return after();
  }

  // Spielphase
  if (ft === 'r') return fail(id, 'Diese Karte hat ihren Platz in der Rangliste schon. Sie bleibt dort.');
  if (ft === 'b') return fail(id, 'Das Turnier läuft schon.');
  if (fi === 0) {
    const next = game.rank.indexOf(null);
    if (tt !== 'r') return fail(id, 'Die Karte im Feld «Rang» kommt jetzt in die Rangliste.');
    if (ti !== next) return fail(id, `Die Karte kommt auf den nächsten freien Platz der Rangliste: Platz ${next + 1}.`);
    snapshot();
    game.rank[ti] = id; game.tree[0] = null;
    game.log.push(`🏆 ${who(card(id))} erreicht Platz ${ti + 1}.`);
    if (!auto) toast(`🏆 Platz ${ti + 1}: @${card(id).handle}`, 'ok');
    return after(id);
  }
  if (tt === 'r') return fail(id, 'In die Rangliste darf nur die Karte, die im Feld «Rang» (ganz oben) steht.');
  if (tt === 'b') return fail(id, 'Das Turnier läuft schon. Karten steigen nur nach oben auf.');
  const p = parentOf(fi);
  if (ti !== p) {
    return fail(id, levelOf(ti) < levelOf(fi)
      ? 'Eine Karte steigt immer nur eine Ebene auf, und zwar auf das Feld direkt über ihrem Paar.'
      : 'Karten steigen nur nach oben auf, nie zur Seite oder nach unten.');
  }
  if (game.tree[p]) return fail(id, 'Dieses Feld ist noch besetzt. Zuerst muss die Karte darüber weiterziehen.');
  const s = siblingOf(fi), sid = game.tree[s];
  const a = card(id);
  if (sid) {
    const b = card(sid);
    if (!beats(a, b)) return fail(id, `Zweikampf verloren: ${who(a)} hat ${desc() ? crit().lessN : crit().moreN} als ${who(b)}. Die Siegerkarte steigt auf.`, sid);
    snapshot();
    game.comparisons++;
    game.tree[p] = id; game.tree[fi] = null;
    game.log.push(`⚔️ ${who(a)} gegen ${who(b)}: @${a.handle} gewinnt.`);
  } else {
    if (!subtreeEmpty(s)) return fail(id, 'Der Gegner fehlt noch: Zuerst muss von unten eine Karte auf das leere Nachbarfeld nachrücken.');
    snapshot();
    game.tree[p] = id; game.tree[fi] = null;
    game.log.push(`➡️ ${who(a)} rückt ohne Gegner nach oben.`);
  }
  return after(id);
}

function fail(id, msg, foeId) {
  game.mistakes++;
  saveGame();
  updateGameUI();
  layoutCards();
  const el = cardEls.get(id);
  if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  if (foeId) {
    const f = cardEls.get(foeId);
    if (f) { f.classList.add('foe'); setTimeout(() => f.classList.remove('foe'), 1600); }
  }
  toast(msg, 'err', 4200);
  return false;
}

function after(movedId) {
  if (game.phase === 'play' && game.rank.every(Boolean)) game.phase = 'done';
  saveGame();
  updateGameUI();
  layoutCards();
  if (movedId) {
    const el = cardEls.get(movedId);
    if (el) { el.classList.remove('win'); void el.offsetWidth; el.classList.add('win'); }
  }
  if (game.phase === 'done') { stopAuto(); setTimeout(showResult, 700); }
  scheduleAutoRank();
  return true;
}

/* Ist eine Karte zuoberst («Rang»), kommt sie automatisch auf den nächsten freien Platz der Rangliste. */
function scheduleAutoRank() {
  clearTimeout(rankTimer);
  if (!game || game.phase !== 'play' || !game.tree[0]) return;
  rankTimer = setTimeout(() => {
    const id = game.tree[0];
    if (!id || game.phase !== 'play') return;
    if (drag && drag.id === id) return scheduleAutoRank();
    const ti = game.rank.indexOf(null);
    game.rank[ti] = id; game.tree[0] = null;
    if (selected === id) selected = null;
    game.log.push(`🏆 ${who(card(id))} ist zuoberst und kommt auf Platz ${ti + 1}.`);
    toast(`🏆 Platz ${ti + 1}: @${card(id).handle}`, 'ok');
    after(id);
  }, 700);
}

function undo() {
  stopAuto();
  const h = game.hist.pop();
  if (!h) return toast('Es gibt nichts mehr rückgängig zu machen.');
  clearTimeout(rankTimer);
  Object.assign(game, JSON.parse(h));
  saveGame(); clearSelection(); relayout();
}

function startTournament() {
  if (game.bench.some(Boolean)) return toast('Lege zuerst alle Karten in die unterste Reihe.', 'err');
  snapshot();
  game.phase = 'play';
  game.log.push('▶️ Das Turnier beginnt.');
  saveGame(); relayout();
}

function shuffleOntoLeaves() {
  snapshot();
  const ids = shuffle(Object.keys(game.cards));
  const Lf = game.leaves;
  game.bench = Array(Lf).fill(null);
  game.tree = Array(2 * Lf - 1).fill(null);
  // gleichmässig verteilen: zuerst in jedes Paar eine Karte, dann auffüllen
  const order = [];
  for (let k = 0; k < Lf; k += 2) order.push(Lf - 1 + k);
  for (let k = 1; k < Lf; k += 2) order.push(Lf - 1 + k);
  const slots = order.slice(0, ids.length).sort((a, b) => a - b);
  slots.forEach((s, k) => { game.tree[s] = ids[k]; });
  clearSelection(); saveGame(); updateGameUI(); layoutCards();
}

function hint(perform = false) {
  const m = validMoves()[0];
  if (!m) return toast('Einen Moment: Die Karte bei «Rang» wird gerade eingeordnet.');
  game.hints++; saveGame();
  if (perform) { tryMove(m.id, m.to, true); return; }
  const el = cardEls.get(m.id), sl = $(`.slot[data-key="${m.to}"]`);
  [el, sl].forEach(x => { if (x) { x.classList.remove('hint'); void x.offsetWidth; x.classList.add('hint'); } });
  const c = card(m.id), from = +locOf(m.id).slice(1);
  let msg;
  {
    const sid = game.tree[siblingOf(from)];
    msg = sid ? `Tipp: Zweikampf! @${c.handle} gegen @${card(sid).handle}.` : `Tipp: @${c.handle} hat keinen Gegner mehr und rückt nach oben.`;
  }
  toast(msg, '', 3500);
}

function toggleAuto() {
  if (autoTimer) return stopAuto();
  $('#btn-auto').classList.add('on');
  $('#btn-auto').textContent = '⏸ Stopp';
  const tick = () => {
    const m = validMoves()[0];
    if (!m) {
      // Karte bei «Rang» wird gerade automatisch eingeordnet: kurz warten
      if (game.phase === 'play' && game.tree[0]) { autoTimer = setTimeout(tick, 400); return; }
      return stopAuto();
    }
    tryMove(m.id, m.to, true);
    autoTimer = setTimeout(tick, game.leaves >= 32 ? 350 : game.leaves >= 16 ? 550 : 900);
  };
  tick();
}
function stopAuto() {
  clearTimeout(autoTimer); autoTimer = null;
  const b = $('#btn-auto'); if (b) { b.classList.remove('on'); b.textContent = '⏩ Automatisch'; }
}

function showResult() {
  const rows = game.rank.map(id => `<li>${esc(who(card(id)))}</li>`).join('');
  $('#modal-body').innerHTML = `
    <h2>🏆 Geschafft!</h2>
    <p>Alle ${game.n} Karten sind sortiert.</p>
    <ol class="ranklist">${rows}</ol>
    <p><strong>Vergleiche (Zweikämpfe):</strong> ${game.comparisons}<br>
       <strong>Fehler:</strong> ${game.mistakes} &nbsp; <strong>Tipps:</strong> ${game.hints}</p>
    <p class="muted">Überlege: Wie viele Vergleiche brauchst du mit dem Insertionsort? Probiere es gleich mit denselben Accounts aus.</p>`;
  openModal([
    { label: '📋 Protokoll', cls: 'ghost', fn: () => setTimeout(showLog, 50) },
    { label: '🔄 Nochmal', cls: 'ghost', fn: () => { newGame(); relayout(); } },
    { label: '🃏 Weiter mit Insertionsort', cls: 'primary', fn: startInsertionFromGame }
  ]);
}

function showLog() {
  const items = game.log.length ? game.log.map(l => `<li>${esc(l)}</li>`).join('') : '<li>Noch keine Züge.</li>';
  $('#modal-body').innerHTML = `<h2>📋 Protokoll</h2>
    <p class="muted">Vergleiche: ${game.comparisons} · Fehler: ${game.mistakes} · Tipps: ${game.hints}</p>
    <ul class="log">${items}</ul>`;
  openModal([{ label: 'Schliessen', cls: 'primary' }]);
  const box = $('.modal-box'); box.scrollTop = box.scrollHeight;
}

/* ---------- Layout ---------- */
function computeLayout() {
  const board = $('#board');
  const W = board.clientWidth, H = board.clientHeight;
  const Lf = game.leaves, depth = Math.log2(Lf);
  const setup = game.phase === 'setup';
  const rows = 1 + (depth + 1) + (setup ? 1 : 0);
  const CAP = 22, PAD = 10;
  const caps = setup ? 2 : 1;
  const RATIO = 1.32, GAP = 0.34;
  const span = Lf * 1.08 + (Lf / 2 - 1) * 0.22; // Breite der untersten Reihe in Kartenbreiten
  let cw = Math.min((H - 2 * PAD - caps * CAP) / (rows * RATIO + (rows - 1) * GAP), (W - 2 * PAD) / span, 150);
  const compact = cw < 66;
  cw = Math.max(cw, compact ? 50 : 40); // nicht kleiner als fingerfreundlich, sonst wird gescrollt
  const ch = cw * RATIO, g = cw * GAP;
  const step = cw * 1.08, extra = cw * 0.22;
  const totalW = Lf * step + (Lf / 2 - 1) * extra;
  const stageW = Math.max(W, totalW + 2 * PAD);
  const x0 = (stageW - totalW) / 2;
  const colX = k => x0 + k * step + Math.floor(k / 2) * extra + (step - cw) / 2; // linke Kante

  const pos = {}; const captions = [];
  let y = PAD;
  captions.push({ text: 'Rangliste', x: Math.max(8, colX(0)), y });
  y += CAP;
  for (let k = 0; k < game.n; k++) pos['r' + k] = { x: colX(k), y };
  y += ch + g;
  const size = 2 * Lf - 1;
  const treeX = Array(size);
  for (let k = 0; k < Lf; k++) treeX[Lf - 1 + k] = colX(k);
  for (let i = Lf - 2; i >= 0; i--) treeX[i] = (treeX[2 * i + 1] + treeX[2 * i + 2]) / 2;
  const rowY = [];
  for (let lv = 0; lv <= depth; lv++) { rowY[lv] = y; y += ch + g; }
  for (let i = 0; i < size; i++) pos['t' + i] = { x: treeX[i], y: rowY[levelOf(i)] };
  const labelX = treeX[0] - 78;
  captions.push(labelX >= PAD
    ? { text: 'Rang ➜', x: labelX, y: rowY[0] + ch / 2 - 8 }
    : { text: '⬅ Rang', x: treeX[0] + cw + 10, y: rowY[0] + ch / 2 - 8 });
  if (setup) {
    y += CAP - g + 6;
    captions.push({ text: 'Startkarten: Lege sie in die unterste Reihe', x: Math.max(8, colX(0)), y: y - CAP });
    for (let k = 0; k < Lf; k++) pos['b' + k] = { x: colX(k), y };
    y += ch;
  }
  return { W, H, cw, ch, g, pos, captions, rowY, compact, stageW, height: Math.max(H, y + PAD) };
}

function relayout() {
  if (!game) return;
  L = computeLayout();
  const board = $('#board'), stage = $('#stage');
  board.style.setProperty('--cw', L.cw + 'px');
  board.style.setProperty('--ch', L.ch + 'px');
  board.classList.toggle('compact', L.compact);
  stage.style.width = L.stageW + 'px';
  stage.style.height = L.height + 'px';

  // Plätze
  const slots = $('#slots');
  let html = '';
  for (const [key, p] of Object.entries(L.pos)) {
    const t = key[0], i = +key.slice(1);
    let cls = 'slot', inner = '';
    if (t === 'r') { cls += ' rank'; inner = `<span class="num">${i + 1}</span>`; }
    if (t === 'b') cls += ' bench';
    if (t === 't' && i === 0) { cls += ' root'; inner = '<span class="num">🏆</span>'; }
    html += `<div class="${cls}" data-key="${key}" style="left:${p.x}px;top:${p.y}px;width:${L.cw}px;height:${L.ch}px">${inner}</div>`;
  }
  for (const c of L.captions) html += `<div class="caption${c.side ? ' side' : ''}" style="left:${c.x}px;top:${c.y}px">${c.text}</div>`;
  slots.innerHTML = html;

  // Linien
  let d = '';
  for (let p = 0; p < game.leaves - 1; p++) {
    const a = L.pos['t' + (2 * p + 1)], b = L.pos['t' + (2 * p + 2)], par = L.pos['t' + p];
    const cx = L.cw / 2;
    const mid = par.y + L.ch + L.g / 2;
    d += `M${a.x + cx},${a.y} V${mid} H${b.x + cx} V${b.y} M${par.x + cx},${mid} V${par.y + L.ch} `;
  }
  $('#lines').innerHTML = `<path d="${d}"/>`;

  // Karten
  const wrap = $('#cards');
  for (const [id, el] of cardEls) if (!game.cards[id]) { el.remove(); cardEls.delete(id); }
  for (const c of Object.values(game.cards)) {
    let el = cardEls.get(c.id);
    const sig = `${game.crit}|${val(c)}|${c.handle}|${c.followers}|${c.platform}|${c.img ? c.img.length : 0}`;
    if (!el || el.dataset.sig !== sig) {
      if (el) el.remove();
      el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = c.id; el.dataset.sig = sig;
      el.innerHTML = `${avatarHTML(c)}<div class="h">@${esc(c.handle)}</div><div class="f">${fmtCount(val(c))}<small>${crit().label}</small></div>`;
      el.style.transition = 'none';
      wrap.appendChild(el); cardEls.set(c.id, el);
      requestAnimationFrame(() => { el.style.transition = ''; });
    }
  }
  updateGameUI();
  layoutCards();
  scheduleAutoRank();
}

function layoutCards() {
  if (!L) return;
  for (const [id, el] of cardEls) {
    const key = locOf(id); const p = key && L.pos[key];
    if (!p) { el.hidden = true; continue; }
    el.hidden = false;
    el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    el.classList.toggle('ranked', key[0] === 'r');
    el.classList.toggle('selected', id === selected);
  }
  $$('.slot').forEach(s => s.classList.remove('target'));
}

function updateGameUI() {
  const setup = game.phase === 'setup';
  $('#toolbar-setup').hidden = !setup;
  $('#toolbar-play').hidden = setup;
  $('#btn-start').disabled = game.bench.some(Boolean);
  $$('#crit button').forEach(b => b.classList.toggle('on', b.dataset.crit === (game.crit || 'followers')));
  $$('#dir button').forEach(b => b.classList.toggle('on', b.dataset.dir === (game.dir || 'desc')));
  $('#st-comp').textContent = game.comparisons;
  $('#st-err').textContent = game.mistakes;
  $('#btn-hint').disabled = $('#btn-step').disabled = game.phase !== 'play';
  $('#btn-undo').disabled = !game.hist.length;
  let text;
  if (setup) {
    text = game.bench.some(Boolean)
      ? 'Schritt 1: Ziehe alle Karten in die unterste Reihe des Turnierbaums (oder tippe auf «Zufällig hinlegen»).'
      : 'Alle Karten liegen bereit. Tippe auf «Turnier starten».';
  } else if (game.phase === 'done') {
    text = '🏆 Fertig! Alle Karten sind in der Rangliste.';
  } else if (game.tree[0]) {
    text = `🏆 @${card(game.tree[0]).handle} ist zuoberst und kommt auf Platz ${game.rank.indexOf(null) + 1} der Rangliste.`;
  } else {
    text = `Lass immer zwei Karten gegeneinander antreten: Die Karte mit ${desc() ? crit().more : crit().fewer} steigt eine Ebene auf.`;
  }
  $('#instruction').textContent = text;
}

/* ---------- Eingabe: Ziehen und Antippen ---------- */
let drag = null;
function slotAt(x, y) {
  if (!L) return null;
  let best = null, bestD = Infinity;
  for (const [key, p] of Object.entries(L.pos)) {
    const cx = p.x + L.cw / 2, cy = p.y + L.ch / 2;
    const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
    if (dx < L.cw * 0.75 && dy < L.ch * 0.75) {
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = key; }
    }
  }
  return best;
}
function boardPoint(e) { const r = $('#stage').getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function clearSelection() { selected = null; $$('.card.selected').forEach(c => c.classList.remove('selected')); }

function initBoard() {
  const board = $('#board');
  board.addEventListener('pointerdown', e => {
    const el = e.target.closest('.card');
    if (!el || game.phase === 'done' || autoTimer) return;
    e.preventDefault();
    const pt = boardPoint(e);
    const p = L.pos[locOf(el.dataset.id)];
    drag = { id: el.dataset.id, el, sx: pt.x, sy: pt.y, ox: p.x, oy: p.y, moved: false, pid: e.pointerId };
    el.setPointerCapture(e.pointerId);
  });
  board.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pid) return;
    const pt = boardPoint(e);
    const dx = pt.x - drag.sx, dy = pt.y - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    if (!drag.moved) { drag.moved = true; drag.el.classList.add('dragging'); clearSelection(); }
    drag.el.style.transform = `translate(${drag.ox + dx}px, ${drag.oy + dy}px)`;
    const key = slotAt(pt.x, pt.y);
    $$('.slot').forEach(s => s.classList.toggle('target', s.dataset.key === key));
  });
  const end = e => {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag; drag = null;
    d.el.classList.remove('dragging');
    if (d.moved) {
      const pt = boardPoint(e);
      const key = slotAt(pt.x, pt.y);
      if (key && key !== locOf(d.id)) tryMove(d.id, key);
      else layoutCards();
    } else if (e.type === 'pointerup') {
      onTapCard(d.id);
    }
  };
  board.addEventListener('pointerup', end);
  board.addEventListener('pointercancel', end);

  board.addEventListener('click', e => {
    const s = e.target.closest('.slot');
    if (!s || !selected) return;
    tryMove(selected, s.dataset.key);
  });
}

function onTapCard(id) {
  if (selected && selected !== id && game.phase === 'setup') {
    // in der Vorbereitung: Karten tauschen
    tryMove(selected, locOf(id));
    return;
  }
  if (selected === id) { clearSelection(); return; }
  selected = id;
  layoutCards();
  const c = card(id);
  toast(`@${c.handle}: ${fmtCount(c.followers)} Follower` + (c.posts != null ? `, ${fmtCount(c.posts)} Beiträge` : ''), '', 2200);
}

/* ---------------- Insertionsort ---------------- */
/*
  Alle Karten liegen verdeckt auf dem Stapel. Die aufgedeckte Karte wird rechts an die sortierte Reihe
  angelegt und immer mit der Karte links daneben verglichen: Sie rutscht nach links oder bleibt.
  Das wiederholt sich, bis sie bleibt oder ganz links ist. Jede Entscheidung ist ein Vergleich.
*/
const STORE_INS = 'tsort_insertion_v2';
let ins = load(STORE_INS, null);
let insAnim = null; // 'in' = neu angelegt, 'left' = nach links gerutscht

function saveIns() { if (ins) store(STORE_INS, ins); }

function newIns(crit, dir) {
  const sel = selectedProfiles();
  const cards = {};
  for (const p of sel) cards[p.id] = { id: p.id, platform: p.platform, handle: p.handle, name: p.name, followers: p.followers, posts: p.posts ?? 0, img: p.img };
  ins = {
    sig: signature(),
    crit: crit || (ins && ins.crit) || (game && game.crit) || 'followers',
    dir: dir || (ins && ins.dir) || (game && game.dir) || 'desc',
    cards,
    pile: shuffle(sel.map(p => p.id)),
    sorted: [], current: null, pos: null,
    comparisons: 0, mistakes: 0, hints: 0, log: [], hist: [], done: false
  };
  saveIns();
}

const icard = id => ins.cards[id];
const icrit = () => CRIT[ins.crit];
const ival = c => c[ins.crit] ?? 0;
const iwho = c => `@${c.handle} (${fmtCount(ival(c))} ${icrit().label})`;
// Darf a vor (links von) b stehen? Gleichstand (auch gleich angezeigte Zahlen) zählt in beide Richtungen.
function iBefore(a, b) {
  if (fmtCount(ival(a)) === fmtCount(ival(b))) return true;
  return ins.dir === 'asc' ? ival(a) < ival(b) : ival(a) > ival(b);
}
const started = () => ins.sorted.length > 0 || ins.current !== null;
const leftId = () => (ins.current && ins.pos > 0 ? ins.sorted[ins.pos - 1] : null);
const shouldMove = () => iBefore(icard(ins.current), icard(leftId())) && !iBefore(icard(leftId()), icard(ins.current));

function insSnapshot() {
  ins.hist.push(JSON.stringify({ pile: ins.pile, sorted: ins.sorted, current: ins.current, pos: ins.pos, comparisons: ins.comparisons, log: ins.log, done: ins.done }));
  if (ins.hist.length > 300) ins.hist.shift();
}

function icardHTML(c, cls = '') {
  return `<div class="icard open ${cls}" data-id="${esc(c.id)}">
    <div class="inner">
      <div class="face back"><span>?</span></div>
      <div class="face front">${avatarHTML(c)}<div class="h">@${esc(c.handle)}</div><div class="f">${fmtCount(ival(c))}<small>${icrit().label}</small></div></div>
    </div></div>`;
}

function renderIns() {
  if (!ins) return;
  const setup = !started() && !ins.done;
  $('#ins-setup').hidden = !setup;
  $$('#ins-crit button').forEach(b => b.classList.toggle('on', b.dataset.crit === ins.crit));
  $$('#ins-dir button').forEach(b => b.classList.toggle('on', b.dataset.dir === ins.dir));
  $('#ins-comp').textContent = ins.comparisons;
  $('#ins-err').textContent = ins.mistakes;
  $('#ins-draw').disabled = ins.done || ins.current !== null || !ins.pile.length;
  $('#ins-hint').disabled = ins.done;
  $('#ins-undo').disabled = !ins.hist.length;

  // Stapel
  const n = ins.pile.length;
  $('#ins-pile-count').textContent = n ? `${n} Karte${n === 1 ? '' : 'n'}` : 'leer';
  $('#ins-pile').innerHTML = n
    ? Array.from({ length: Math.min(n, 6) }, (_, k) => `<div class="icard pile-card" style="--k:${k}"><div class="inner"><div class="face back"><span>?</span></div></div></div>`).join('')
    : '<div class="empty-note">Alle Karten sind aufgedeckt.</div>';
  $('#ins-pile').classList.toggle('can-draw', !$('#ins-draw').disabled);

  // Vergleich: neue Karte gegen die Karte links daneben
  const cmp = $('#ins-compare');
  const lid = leftId();
  if (ins.current && lid) {
    const cur = icard(ins.current), left = icard(lid);
    cmp.innerHTML = `
      <div class="duel">
        <div class="duel-card"><small>links daneben</small>${icardHTML(left, 'cmp')}</div>
        <div class="vs">?</div>
        <div class="duel-card"><small>neue Karte</small>${icardHTML(cur, 'big')}</div>
      </div>
      <p class="duel-q">Muss <b>@${esc(cur.handle)}</b> links von <b>@${esc(left.handle)}</b> stehen?</p>
      <div class="duel-btns">
        <button type="button" class="btn big-btn" id="ins-left">⬅ Nach links rutschen</button>
        <button type="button" class="btn big-btn primary" id="ins-stay">✓ Bleibt hier</button>
      </div>`;
  } else {
    cmp.innerHTML = `<div class="empty-note">${ins.done ? 'Fertig!' : 'Tippe auf den Stapel, um die nächste Karte aufzudecken.'}</div>`;
  }

  // Sortierte Reihe (alle Karten offen)
  $('#ins-row').innerHTML = ins.sorted.map((id, i) => {
    let cls = '';
    if (id === ins.current) cls = 'moving' + (insAnim === 'left' ? ' slide-left' : insAnim === 'in' ? ' slide-in' : '');
    else if (id === lid) cls = 'cmp';
    return icardHTML(icard(id), cls);
  }).join('') || '<div class="empty-note">Noch leer.</div>';
  insAnim = null;
  $('#ins-row-ends').innerHTML = ins.sorted.length > 1
    ? `<span>⬅ ${ins.dir === 'asc' ? 'kleinste' : 'grösste'}</span><span>${ins.dir === 'asc' ? 'grösste' : 'kleinste'} ➡</span>`
    : '';

  // Anleitung
  let text;
  if (ins.done) text = '🏆 Fertig! Alle Karten sind in der sortierten Reihe.';
  else if (!ins.current) text = ins.sorted.length ? 'Decke die nächste Karte vom Stapel auf. Sie wird rechts an die Reihe angelegt.' : 'Stelle ein, wonach sortiert wird, und decke dann die erste Karte vom Stapel auf.';
  else text = `Vergleiche die neue Karte mit der Karte links daneben: Hat sie ${ins.dir === 'asc' ? icrit().lessN : icrit().moreN}, rutscht sie nach links. Sonst bleibt sie.`;
  $('#ins-instruction').textContent = text;
}

function insDraw() {
  if (ins.done) return;
  if (ins.current) return toast('Ordne zuerst die aufgedeckte Karte ein.', 'err');
  if (!ins.pile.length) return;
  insSnapshot();
  ins.current = ins.pile.shift();
  ins.sorted.push(ins.current);
  ins.pos = ins.sorted.length - 1;
  ins.log.push(`🂠 Neue Karte rechts angelegt: ${iwho(icard(ins.current))}`);
  insAnim = 'in';
  if (ins.pos === 0) {
    ins.log.push('   Die erste Karte bildet die sortierte Reihe.');
    toast('Die erste Karte bildet die sortierte Reihe. Decke die nächste auf.', 'ok');
    insFinish();
  }
  saveIns(); renderIns();
}

function insDecide(moveLeft) {
  if (ins.done || !ins.current || !leftId()) return;
  const cur = icard(ins.current), left = icard(leftId());
  const leftOk = iBefore(cur, left), stayOk = iBefore(left, cur);
  if (moveLeft ? !leftOk : !stayOk) {
    ins.mistakes++;
    const has = ins.dir === 'asc'
      ? (moveLeft ? icrit().moreN : icrit().lessN)
      : (moveLeft ? icrit().lessN : icrit().moreN);
    toast(`Falsch: ${iwho(cur)} hat ${has} als ${iwho(left)}. Sie muss ${moveLeft ? 'rechts davon bleiben' : 'nach links rutschen'}.`, 'err', 4500);
    const b = $(moveLeft ? '#ins-left' : '#ins-stay'); if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
    saveIns(); $('#ins-err').textContent = ins.mistakes;
    return;
  }
  insSnapshot();
  ins.comparisons++;
  if (moveLeft) {
    ins.log.push(`⬅ ${iwho(cur)} gegen ${iwho(left)}: nach links.`);
    [ins.sorted[ins.pos - 1], ins.sorted[ins.pos]] = [ins.sorted[ins.pos], ins.sorted[ins.pos - 1]];
    ins.pos--;
    insAnim = 'left';
    if (ins.pos === 0) {
      ins.log.push(`   @${cur.handle} ist ganz links angekommen.`);
      toast(`@${cur.handle} ist ganz links angekommen.`, 'ok');
      insFinish();
    }
  } else {
    ins.log.push(`✓ ${iwho(cur)} gegen ${iwho(left)}: bleibt.`);
    insFinish();
  }
  saveIns(); renderIns();
  if (ins.done) setTimeout(showInsResult, 600);
}

function insFinish() {
  ins.current = null; ins.pos = null;
  if (!ins.pile.length) ins.done = true;
}

function insUndo() {
  const h = ins.hist.pop();
  if (!h) return;
  Object.assign(ins, JSON.parse(h));
  saveIns(); renderIns();
}

function pulseEls(selectors) {
  selectors.forEach(s => { const el = $(s); if (el) { el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint'); } });
}

function insHint() {
  if (ins.done) return;
  ins.hints++; saveIns();
  if (!ins.current) { pulseEls(['#ins-pile']); return toast('Tipp: Decke die nächste Karte vom Stapel auf.'); }
  const move = shouldMove();
  pulseEls([move ? '#ins-left' : '#ins-stay']);
  toast(move ? 'Tipp: Die neue Karte muss weiter nach links.' : 'Tipp: Die neue Karte ist am richtigen Ort.', '', 3000);
}

function insLog() {
  const items = ins.log.length ? ins.log.map(l => `<li>${esc(l)}</li>`).join('') : '<li>Noch keine Schritte.</li>';
  $('#modal-body').innerHTML = `<h2>📋 Protokoll Insertionsort</h2>
    <p class="muted">Vergleiche: ${ins.comparisons} · Fehler: ${ins.mistakes} · Tipps: ${ins.hints}</p>
    <ul class="log">${items}</ul>`;
  openModal([{ label: 'Schliessen', cls: 'primary' }]);
  const box = $('.modal-box'); box.scrollTop = box.scrollHeight;
}

function showInsResult() {
  const rows = ins.sorted.map(id => `<li>${esc(iwho(icard(id)))}</li>`).join('');
  const sameTournament = game && game.phase === 'done' && game.sig === ins.sig && game.crit === ins.crit && game.dir === ins.dir;
  const compare = sameTournament
    ? `<div class="compare">
        <div><small>Tournamentsort</small><b>${game.comparisons}</b><span>Vergleiche</span></div>
        <div><small>Insertionsort</small><b>${ins.comparisons}</b><span>Vergleiche</span></div>
      </div>
      <p class="muted">Welches Verfahren brauchte weniger Vergleiche? Woran liegt das?</p>`
    : `<p><strong>Vergleiche:</strong> ${ins.comparisons}</p>
      <p class="muted">Tipp: Spiele mit denselben Accounts und derselben Einstellung auch das Turnier, dann siehst du hier den Vergleich.</p>`;
  $('#modal-body').innerHTML = `
    <h2>🃏 Geschafft!</h2>
    <p>Alle ${ins.sorted.length} Karten sind mit dem Insertionsort sortiert.</p>
    <ol class="ranklist">${rows}</ol>
    ${compare}
    <p><strong>Fehler:</strong> ${ins.mistakes} &nbsp; <strong>Tipps:</strong> ${ins.hints}</p>`;
  openModal([
    { label: '📋 Protokoll', cls: 'ghost', fn: () => setTimeout(insLog, 50) },
    { label: '🔄 Nochmal', cls: 'ghost', fn: () => { newIns(ins.crit, ins.dir); renderIns(); } },
    { label: 'OK', cls: 'primary' }
  ]);
}

function startInsertionFromGame() {
  newIns(game.crit, game.dir);
  showView('insert');
}

function initInsertion() {
  $('#ins-draw').addEventListener('click', insDraw);
  $('#ins-pile').addEventListener('click', insDraw);
  $('#ins-hint').addEventListener('click', insHint);
  $('#ins-undo').addEventListener('click', insUndo);
  $('#ins-log').addEventListener('click', insLog);
  $('#ins-reset').addEventListener('click', () => confirmModal('Neu starten?', 'Alle Karten werden gemischt und kommen verdeckt auf den Stapel.', 'Neu starten', () => { newIns(ins.crit, ins.dir); renderIns(); }));
  $('#ins-compare').addEventListener('click', e => {
    if (e.target.closest('#ins-left')) insDecide(true);
    else if (e.target.closest('#ins-stay')) insDecide(false);
  });
  $$('#ins-crit button').forEach(b => b.addEventListener('click', () => { if (started()) return; ins.crit = b.dataset.crit; saveIns(); renderIns(); }));
  $$('#ins-dir button').forEach(b => b.addEventListener('click', () => { if (started()) return; ins.dir = b.dataset.dir; saveIns(); renderIns(); }));
}

/* ---------------- Views, Toast, Modal ---------------- */
function showView(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  document.body.classList.toggle('on-profiles', name === 'profiles');
  if (name !== 'game') stopAuto();
  if (name === 'game') {
    if (selectedProfiles().length < 2) {
      showView('profiles');
      return toast('Wähle zuerst mindestens 2 Accounts für das Turnier aus.', 'err');
    }
    if (!game || !game.leaves || game.sig !== signature()) newGame();
    fitBoard();
    relayout();
  }
  if (name === 'insert') {
    if (selectedProfiles().length < 2) {
      showView('profiles');
      return toast('Wähle zuerst mindestens 2 Accounts aus.', 'err');
    }
    if (!ins || ins.sig !== signature()) newIns();
    renderIns();
  }
  window.scrollTo(0, 0);
}

function fitBoard() {
  const board = $('#board');
  const top = board.getBoundingClientRect().top + window.scrollY;
  const h = window.innerHeight - top - 12;
  board.style.height = Math.max(420, h) + 'px';
}

let toastTimer = null;
function toast(msg, type = '', ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast ' + type; }, ms);
}

function openModal(actions) {
  const box = $('#modal-actions');
  box.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.className = 'btn ' + (a.cls || '');
    b.textContent = a.label;
    b.addEventListener('click', () => { closeModal(); if (a.fn) a.fn(); });
    box.appendChild(b);
  }
  $('#modal').hidden = false;
}
function closeModal() { $('#modal').hidden = true; }
function confirmModal(title, text, okLabel, fn) {
  $('#modal-body').innerHTML = `<h2>${esc(title)}</h2><p>${esc(text)}</p>`;
  openModal([{ label: 'Abbrechen', cls: 'ghost' }, { label: okLabel, cls: 'primary', fn }]);
}

/* ---------------- Start ---------------- */
function init() {
  $$('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
  document.body.classList.add('on-profiles');
  initProfileView();
  initBoard();
  initInsertion();
  $('#btn-shuffle').addEventListener('click', shuffleOntoLeaves);
  $$('#crit button').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.crit;
    if (game.phase !== 'setup') return;
    game.crit = c; saveGame(); relayout();
  }));
  $$('#dir button').forEach(b => b.addEventListener('click', () => {
    if (game.phase !== 'setup') return;
    game.dir = b.dataset.dir; saveGame(); updateGameUI();
  }));
  $('#btn-start').addEventListener('click', startTournament);
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-hint').addEventListener('click', () => hint(false));
  $('#btn-step').addEventListener('click', () => hint(true));
  $('#btn-auto').addEventListener('click', toggleAuto);
  $('#btn-log').addEventListener('click', showLog);
  $('#btn-reset').addEventListener('click', () => confirmModal('Neu starten?', 'Alle Karten gehen zurück zu den Startkarten.', 'Neu starten', () => { stopAuto(); newGame(); relayout(); }));

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if ($('#view-game').classList.contains('active')) { fitBoard(); relayout(); } }, 120);
  });
  loadAccounts();
}
init();
