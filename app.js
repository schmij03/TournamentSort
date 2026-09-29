/* Tournamentsort: digitales Legeschema fürs iPad */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const STORE_PROFILES = 'tsort_profiles_v1';
const STORE_GAME = 'tsort_game_v1';
const MAX = 32; // höchstens so viele Karten im Turnier

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
}
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- Zahlen ---------------- */
function parseCount(input) {
  if (typeof input === 'number') return input;
  let s = String(input || '').toLowerCase()
    .replace(/follower(innen)?|abonnent(inn)?en|abonnenten|fans/g, '')
    .replace(/[\s'’`  ]/g, '');
  if (!s) return NaN;
  const m = s.match(/^([0-9][0-9.,]*)(mrd|mia|b|mio|m|tsd|tausend|k)?\.?$/);
  if (!m) return NaN;
  let num = m[1];
  const mult = { mrd: 1e9, mia: 1e9, b: 1e9, mio: 1e6, m: 1e6, tsd: 1e3, tausend: 1e3, k: 1e3 }[m[2]] || 1;
  if (mult > 1) {
    // "1.234,5 Mio" kommt kaum vor: Das letzte Trennzeichen ist das Dezimalzeichen
    const last = Math.max(num.lastIndexOf('.'), num.lastIndexOf(','));
    if (last >= 0) num = num.slice(0, last).replace(/[.,]/g, '') + '.' + num.slice(last + 1);
    const v = parseFloat(num);
    return isNaN(v) ? NaN : Math.round(v * mult);
  }
  if (/^\d{1,3}([.,]\d{3})+$/.test(num)) return parseInt(num.replace(/[.,]/g, ''), 10);
  if (/^\d+$/.test(num)) return parseInt(num, 10);
  const v = parseFloat(num.replace(',', '.'));
  return isNaN(v) ? NaN : Math.round(v);
}

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

function parseHandle(input) {
  let s = String(input || '').trim();
  let platform = null;
  const m = s.match(/(instagram\.com|tiktok\.com)\/@?([A-Za-z0-9._]+)/i);
  if (m) { platform = /insta/i.test(m[1]) ? 'instagram' : 'tiktok'; s = m[2]; }
  s = s.replace(/^@+/, '').replace(/[^A-Za-z0-9._]/g, '');
  return { handle: s, platform };
}

const CRIT = {
  followers: { label: 'Follower', more: 'mehr Followern', fewer: 'weniger Followern', lessN: 'weniger Follower', moreN: 'mehr Follower' },
  posts: { label: 'Beiträge', more: 'mehr Beiträgen', fewer: 'weniger Beiträgen', lessN: 'weniger Beiträge', moreN: 'mehr Beiträge' }
};

/* ---------------- Profile ---------------- */
let profiles = load(STORE_PROFILES, []);
let editingId = null;
let formImg = null;

function saveProfiles() {
  if (!store(STORE_PROFILES, profiles)) toast('Der Speicher ist voll. Entferne einige Profilbilder.', 'err');
}
function selectedProfiles() { return profiles.filter(p => p.sel).slice(0, MAX); }

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
    return `<div class="av ${cls}" style="${style}"><img src="${esc(p.img)}" alt="" draggable="false" onerror="this.parentNode.textContent='${ini}'"></div>`;
  }
  return `<div class="av ${cls}" style="${style}">${ini}</div>`;
}
const platLabel = p => p === 'tiktok' ? 'TT' : 'IG';
const platName = p => p === 'tiktok' ? 'TikTok' : 'Instagram';

function renderProfiles() {
  const list = $('#profile-list');
  const q = $('#search').value.trim().toLowerCase().replace(/^@/, '');
  $('#search').hidden = profiles.length <= MAX;
  const shown = q ? profiles.filter(p => (p.handle + ' ' + (p.name || '')).toLowerCase().includes(q)) : profiles;
  list.innerHTML = shown.map(p => `
    <li data-id="${p.id}" class="${p.sel ? '' : 'off'}">
      <input type="checkbox" class="chk" ${p.sel ? 'checked' : ''} aria-label="Im Turnier">
      ${avatarHTML(p)}
      <div class="info">
        <b>@${esc(p.handle)} <span class="plat ${p.platform}">${platLabel(p.platform)}</span></b>
        <span>${p.name ? esc(p.name) + ' · ' : ''}${fmtCount(p.followers)} Follower${p.posts != null ? ' · ' + fmtCount(p.posts) + ' Beiträge' : ''}</span>
      </div>
      <div class="acts">
        <button class="icon-btn" data-act="edit" aria-label="Bearbeiten">✏️</button>
        <button class="icon-btn" data-act="del" aria-label="Löschen">🗑️</button>
      </div>
    </li>`).join('');
  $('#empty-hint').hidden = profiles.length > 0;
  const n = profiles.filter(p => p.sel).length;
  const badge = $('#sel-count');
  badge.textContent = `${n}/${MAX} im Turnier`;
  badge.classList.toggle('full', n === MAX);
  $('#go-game').disabled = n < 2;
}

function addProfile(data) {
  const n = profiles.filter(p => p.sel).length;
  const p = { id: uid(), platform: 'tiktok', name: '', img: null, ...data, sel: n < 8 };
  profiles.push(p);
  return p;
}

function resetForm() {
  editingId = null; formImg = null;
  $('#profile-form').reset();
  $('#form-title').textContent = 'Profil hinzufügen';
  $('#f-submit').textContent = '＋ Hinzufügen';
  $('#f-cancel').hidden = true;
  updateFollowerPreview();
  updateFormImg();
}
function updateFormImg() {
  const handle = parseHandle($('#f-handle').value).handle || '?';
  $('#f-img-preview').outerHTML = avatarHTML({ handle, name: $('#f-name').value, img: formImg }, 'big').replace('class="av big"', 'id="f-img-preview" class="av big"');
  $('#f-img-clear').hidden = !formImg;
}
function updateFollowerPreview() {
  const el = $('#f-followers-preview');
  const raw = $('#f-followers').value;
  if (!raw.trim()) { el.className = 'muted'; el.textContent = 'So wie es in der App steht, z. B. «1,2 Mio.» oder «45,3K».'; return; }
  const v = parseCount(raw);
  if (isNaN(v)) { el.className = 'bad'; el.textContent = 'Diese Zahl verstehe ich nicht.'; }
  else { el.className = 'good'; el.textContent = `✓ ${v.toLocaleString('de-CH')} Follower (${fmtCount(v)})`; }
}

function initProfileView() {
  const form = $('#profile-form');
  $('#f-handle').addEventListener('input', () => {
    const { platform } = parseHandle($('#f-handle').value);
    if (platform) form.platform.value = platform;
    if (!formImg) updateFormImg();
  });
  $('#f-name').addEventListener('input', () => { if (!formImg) updateFormImg(); });
  $('#f-followers').addEventListener('input', updateFollowerPreview);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const { handle } = parseHandle($('#f-handle').value);
    const followers = parseCount($('#f-followers').value);
    if (!handle) return toast('Bitte einen Benutzernamen eingeben.', 'err');
    if (isNaN(followers)) return toast('Bitte eine gültige Follower-Zahl eingeben.', 'err');
    const postsRaw = $('#f-posts').value.trim();
    const posts = postsRaw ? parseCount(postsRaw) : null;
    if (postsRaw && isNaN(posts)) return toast('Bitte eine gültige Anzahl Beiträge eingeben.', 'err');
    const data = { platform: form.platform.value, handle, name: $('#f-name').value.trim(), followers, posts, img: formImg };
    if (editingId) {
      Object.assign(profiles.find(p => p.id === editingId), data);
      toast('Profil gespeichert.', 'ok');
    } else {
      if (profiles.some(p => p.handle.toLowerCase() === handle.toLowerCase() && p.platform === data.platform)) {
        return toast(`@${handle} ist schon in der Liste.`, 'err');
      }
      const p = addProfile(data);
      toast(p.sel ? `@${handle} hinzugefügt.` : `@${handle} hinzugefügt. Setze das Häkchen, damit es im Turnier mitmacht.`, 'ok');
    }
    saveProfiles(); renderProfiles(); resetForm();
  });
  $('#f-cancel').addEventListener('click', resetForm);

  $('#f-file').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) openCropper(file, data => { formImg = data; updateFormImg(); });
  });
  $('#f-web').addEventListener('click', () => {
    const { handle } = parseHandle($('#f-handle').value);
    if (!handle) return toast('Gib zuerst den Benutzernamen ein.', 'err');
    const url = `https://unavatar.io/${form.platform.value}/${encodeURIComponent(handle)}?fallback=false`;
    toast('Bild wird gesucht …');
    const img = new Image();
    img.onload = () => { formImg = url; updateFormImg(); toast('Bild gefunden.', 'ok'); };
    img.onerror = () => toast('Kein Bild gefunden. Mach einen Screenshot vom Profil und wähle ihn mit 📷 aus.', 'err');
    img.src = url;
  });
  $('#f-img-clear').addEventListener('click', () => { formImg = null; updateFormImg(); });

  $('#profile-list').addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    const p = profiles.find(x => x.id === li.dataset.id); if (!p) return;
    if (e.target.classList.contains('chk')) {
      if (e.target.checked && profiles.filter(x => x.sel).length >= MAX) {
        e.target.checked = false;
        return toast(`Es können höchstens ${MAX} Profile ins Turnier. Entferne zuerst ein anderes Häkchen.`, 'err');
      }
      p.sel = e.target.checked; saveProfiles(); renderProfiles(); return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'del') {
      profiles = profiles.filter(x => x !== p);
      if (editingId === p.id) resetForm();
      saveProfiles(); renderProfiles();
    } else if (act === 'edit') {
      editingId = p.id; formImg = p.img || null;
      form.platform.value = p.platform;
      $('#f-handle').value = '@' + p.handle;
      $('#f-name').value = p.name || '';
      $('#f-followers').value = p.followers;
      $('#f-posts').value = p.posts != null ? p.posts : '';
      $('#form-title').textContent = `@${p.handle} bearbeiten`;
      $('#f-submit').textContent = '✓ Speichern';
      $('#f-cancel').hidden = false;
      updateFollowerPreview(); updateFormImg();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  $('#bulk-add').addEventListener('click', () => {
    const lines = $('#bulk').value.split(/\n+/).map(l => l.trim()).filter(Boolean);
    let ok = 0; const bad = [];
    for (const line of lines) {
      const r = parseLine(line);
      if (!r) { bad.push(line); continue; }
      if (profiles.some(p => p.handle.toLowerCase() === r.handle.toLowerCase() && p.platform === r.platform)) continue;
      addProfile(r); ok++;
    }
    saveProfiles(); renderProfiles();
    if (!bad.length) $('#bulk').value = '';
    else $('#bulk').value = bad.join('\n');
    toast(`${ok} Profil(e) eingefügt.` + (bad.length ? ` ${bad.length} Zeile(n) nicht verstanden (stehen noch im Feld).` : ''), bad.length ? 'err' : 'ok');
  });

  $('#load-popular').addEventListener('click', loadPopular);
  $$('#pick-random [data-n]').forEach(b => b.addEventListener('click', () => {
    const N = +b.dataset.n;
    const q = $('#search').value.trim().toLowerCase().replace(/^@/, '');
    const pool = q ? profiles.filter(p => (p.handle + ' ' + (p.name || '')).toLowerCase().includes(q)) : profiles;
    if (pool.length < 2) return toast('Es braucht mindestens 2 Profile.', 'err');
    profiles.forEach(p => { p.sel = false; });
    shuffle(pool.slice()).slice(0, N).forEach(p => { p.sel = true; });
    saveProfiles(); renderProfiles();
    toast(`${Math.min(N, pool.length)} Profile zufällig gewählt.`, 'ok');
  }));
  $('#clear-sel').addEventListener('click', () => { profiles.forEach(p => { p.sel = false; }); saveProfiles(); renderProfiles(); });
  $('#search').addEventListener('input', renderProfiles);

  $('#clear-all').addEventListener('click', () => {
    if (!profiles.length) return;
    confirmModal('Alle Profile löschen?', 'Die Liste wird geleert. Das kann nicht rückgängig gemacht werden.', 'Löschen', () => {
      profiles = []; saveProfiles(); renderProfiles(); resetForm();
    });
  });

  $('#share-set').addEventListener('click', shareSet);
  $('#go-game').addEventListener('click', () => showView('game'));
  resetForm();
  renderProfiles();
}

function parseLine(line) {
  const tokens = line.split(/[\s;|\t]+/).filter(Boolean);
  let platform = null, handle = null;
  const rest = [];
  for (const t of tokens) {
    const low = t.toLowerCase();
    if (!platform && /^(instagram|insta|ig|tiktok|tt)[:]?$/.test(low)) { platform = low.startsWith('t') ? 'tiktok' : 'instagram'; continue; }
    if (!handle && (t.startsWith('@') || /\.com\//i.test(t))) {
      const r = parseHandle(t); handle = r.handle; platform = platform || r.platform; continue;
    }
    rest.push(t);
  }
  if (!handle) {
    const i = rest.findIndex(t => /[a-z_]/i.test(t) && isNaN(parseCount(t)));
    if (i >= 0) handle = parseHandle(rest.splice(i, 1)[0]).handle;
  }
  const followers = parseCount(rest.join(''));
  if (!handle || isNaN(followers)) return null;
  return { platform: platform || 'instagram', handle, followers };
}

/* Beliebte Accounts aus data/accounts.json (von der GitHub Action aktualisiert) */
async function loadPopular() {
  let data;
  try {
    const r = await fetch('data/accounts.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    data = await r.json();
  } catch (e) {
    return toast('Die Liste der beliebten Accounts konnte nicht geladen werden.', 'err');
  }
  const noneSelected = !profiles.some(p => p.sel);
  let added = 0, updated = 0;
  for (const acc of data.accounts || []) {
    if (acc.followers == null) continue;
    const p = profiles.find(x => x.platform === acc.platform && x.handle.toLowerCase() === acc.handle.toLowerCase());
    const fields = { name: acc.name || '', followers: acc.followers, posts: acc.posts ?? null };
    if (acc.img) fields.img = acc.img;
    if (p) { Object.assign(p, fields); updated++; }
    else { profiles.push({ id: uid(), platform: acc.platform, handle: acc.handle, img: null, ...fields, sel: false }); added++; }
  }
  if (noneSelected) shuffle(profiles.slice()).slice(0, 8).forEach(p => { p.sel = true; });
  saveProfiles(); renderProfiles();
  const stand = data.updated ? ` (Stand ${data.updated.split('-').reverse().join('.')})` : '';
  toast(`${added} Accounts geladen, ${updated} aktualisiert${stand}.` + (noneSelected ? ' 8 davon sind zufällig fürs Turnier gewählt.' : ''), 'ok', 4000);
}

/* Set als Link teilen (ohne Bilder) */
function b64encode(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function b64decode(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); return decodeURIComponent(escape(atob(str))); }

function shareSet() {
  const sel = selectedProfiles();
  if (!sel.length) return toast('Wähle zuerst Profile für das Turnier aus.', 'err');
  const data = sel.map(p => [p.platform === 'tiktok' ? 't' : 'i', p.handle, p.followers, p.name || '', p.posts ?? null]);
  const url = location.href.split('#')[0] + '#set=' + b64encode(JSON.stringify(data));
  const done = () => toast('Link kopiert. Andere können damit dieselben Profile laden.', 'ok');
  if (navigator.share) {
    navigator.share({ title: 'Tournamentsort Profile', url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(done, () => prompt('Link kopieren:', url));
  } else {
    prompt('Link kopieren:', url);
  }
}

function importFromHash() {
  const m = location.hash.match(/#set=([A-Za-z0-9_-]+)/);
  if (!m) return;
  let data;
  try { data = JSON.parse(b64decode(m[1])); } catch (e) { return; }
  if (!Array.isArray(data)) return;
  const items = data.filter(d => Array.isArray(d) && d[1] && isFinite(d[2])).slice(0, 30);
  history.replaceState(null, '', location.pathname + location.search);
  if (!items.length) return;
  confirmModal('Profile übernehmen?', `Mit dem Link wurden ${items.length} Profile geteilt. Sollen sie deine aktuelle Liste ersetzen?`, 'Übernehmen', () => {
    profiles = [];
    for (const [pl, handle, followers, name, posts] of items) {
      addProfile({ platform: pl === 't' ? 'tiktok' : 'instagram', handle: parseHandle(handle).handle, followers: Number(followers), posts: isFinite(posts) && posts !== null ? Number(posts) : null, name: String(name || '') });
    }
    saveProfiles(); renderProfiles(); game = null; store(STORE_GAME, null);
    toast('Profile übernommen.', 'ok');
  });
}

/* ---------------- Bild zuschneiden ---------------- */
function openCropper(file, cb) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const S = 280;
    const body = $('#modal-body');
    body.innerHTML = `<h2>Profilbild zuschneiden</h2>
      <div class="crop-wrap">
        <canvas width="${S * 2}" height="${S * 2}" style="width:${S}px;height:${S}px"></canvas>
        <label>🔍 Zoom <input type="range" min="1" max="8" step="0.01" value="1"></label>
        <p class="muted center" style="margin:0">Mit dem Finger verschieben, mit dem Regler vergrössern.</p>
      </div>`;
    const cv = $('canvas', body), ctx = cv.getContext('2d'), range = $('input', body);
    const base = Math.max(S / img.width, S / img.height);
    let zoom = 1, ox, oy;
    const clamp = () => {
      const w = img.width * base * zoom, h = img.height * base * zoom;
      ox = Math.min(0, Math.max(S - w, ox)); oy = Math.min(0, Math.max(S - h, oy));
    };
    ox = (S - img.width * base) / 2; oy = (S - img.height * base) / 2;
    const draw = (c = ctx, k = 2, overlay = true) => {
      c.setTransform(k, 0, 0, k, 0, 0);
      c.clearRect(0, 0, S, S);
      c.drawImage(img, ox, oy, img.width * base * zoom, img.height * base * zoom);
      if (overlay) {
        c.fillStyle = 'rgba(0,0,0,.45)';
        c.beginPath(); c.rect(0, 0, S, S); c.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2, true); c.fill();
      }
    };
    draw();
    range.addEventListener('input', () => {
      const cx = S / 2, cy = S / 2, nz = parseFloat(range.value);
      ox = cx - (cx - ox) * nz / zoom; oy = cy - (cy - oy) * nz / zoom; zoom = nz;
      clamp(); draw();
    });
    let drag = null;
    cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ox, oy }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const r = S / cv.getBoundingClientRect().width;
      ox = drag.ox + (e.clientX - drag.x) * r; oy = drag.oy + (e.clientY - drag.y) * r; clamp(); draw();
    });
    cv.addEventListener('pointerup', () => { drag = null; });
    openModal([
      { label: 'Abbrechen', cls: 'ghost', fn: () => URL.revokeObjectURL(url) },
      {
        label: '✓ Übernehmen', cls: 'primary', fn: () => {
          const out = document.createElement('canvas'); const O = 160;
          out.width = O; out.height = O;
          draw(out.getContext('2d'), O / S, false);
          URL.revokeObjectURL(url);
          cb(out.toDataURL('image/jpeg', 0.82));
        }
      }
    ]);
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Dieses Bild kann nicht geöffnet werden.', 'err'); };
  img.src = url;
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
function signature() { return selectedProfiles().map(p => `${p.id}:${p.followers}:${p.posts}:${p.handle}:${p.platform}:${p.img ? p.img.length : 0}`).join('|'); }
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
    <p class="muted">Überlege: Wie viele Vergleiche hättest du mit dem Insertionsort gebraucht?</p>`;
  openModal([
    { label: '📋 Protokoll', cls: 'ghost', fn: () => setTimeout(showLog, 50) },
    { label: '🔄 Nochmal', cls: 'ghost', fn: () => { newGame(); relayout(); } },
    { label: 'OK', cls: 'primary' }
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
      el.innerHTML = `<span class="plat ${c.platform}">${platLabel(c.platform)}</span>${avatarHTML(c)}<div class="h">@${esc(c.handle)}</div><div class="f">${fmtCount(val(c))}<small>${crit().label}</small></div>`;
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
  $$('#crit .btn').forEach(b => b.classList.toggle('on', b.dataset.crit === (game.crit || 'followers')));
  $$('#dir .btn').forEach(b => b.classList.toggle('on', b.dataset.dir === (game.dir || 'desc')));
  $('#st-comp').textContent = `Vergleiche: ${game.comparisons}`;
  $('#st-err').textContent = `Fehler: ${game.mistakes}`;
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

/* ---------------- Views, Toast, Modal ---------------- */
function showView(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if (name !== 'game') stopAuto();
  if (name === 'game') {
    if (selectedProfiles().length < 2) {
      showView('profiles');
      return toast('Wähle zuerst mindestens 2 Profile für das Turnier aus.', 'err');
    }
    if (!game || !game.leaves || game.sig !== signature()) newGame();
    fitBoard();
    relayout();
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
  initProfileView();
  initBoard();
  $('#btn-shuffle').addEventListener('click', shuffleOntoLeaves);
  $$('#crit .btn').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.crit;
    if (game.phase !== 'setup') return;
    if (c === 'posts' && Object.values(game.cards).some(x => x.posts == null)) {
      return toast('Nicht bei allen Karten ist die Anzahl Beiträge bekannt. Ergänze sie unter «1. Profile».', 'err', 4000);
    }
    game.crit = c; saveGame(); relayout();
  }));
  $$('#dir .btn').forEach(b => b.addEventListener('click', () => {
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
  importFromHash();
  window.addEventListener('hashchange', importFromHash);
}
init();
