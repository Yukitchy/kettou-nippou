'use strict';
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MIN = 60000;
const S = { pts: [], meals: [], days: [], i: 0, key: '' };
try { S.key = localStorage.getItem('kn_key') || ''; } catch (e) {}

/* ---------- 取り込み ---------- */
function splitLine(l) { // ダブルクォート対応の最小CSV
  const o = []; let c = '', q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i];
    if (q) { if (ch === '"') { if (l[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { o.push(c); c = ''; }
    else c += ch;
  }
  o.push(c); return o;
}
function parseTs(s) { // MM-DD-YYYY HH:MM(LibreView) / YYYY-MM-DD, YYYY/MM/DD HH:MM
  let m = s.match(/^(\d{2})-(\d{2})-(\d{4}) (\d{1,2}):(\d{2})/);
  if (m) return new Date(+m[3], m[1] - 1, +m[2], +m[4], +m[5]).getTime();
  m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2}) (\d{1,2}):(\d{2})/);
  return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]).getTime() : NaN;
}
function parseCsv(text) {
  const rows = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map(splitLine);
  const hi = rows.findIndex(r => r[0] === 'Device'); // 1行目はメタ行、ヘッダは2行目
  if (hi < 0) throw new Error('LibreViewのCSVではないようです');
  const h = rows[hi], col = re => h.findIndex(x => re.test(x));
  const cT = col(/Device Timestamp/), cR = col(/Record Type/), cH = col(/Historic Glucose/), cS = col(/Scan Glucose/);
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const v = parseFloat(r[cR] === '0' ? r[cH] : r[cR] === '1' ? r[cS] : '');
    const t = parseTs(r[cT] || '');
    if (!isNaN(v) && !isNaN(t)) out.push({ t, v });
  }
  return out.sort((a, b) => a.t - b.t);
}

/* ---------- 計算（SPEC準拠） ---------- */
function dayStats(pts) {
  if (!pts.length) return null;
  const vs = pts.map(p => p.v), avg = vs.reduce((a, b) => a + b, 0) / vs.length;
  return { avg, max: Math.max(...vs), min: Math.min(...vs), tir: 100 * vs.filter(v => v >= 70 && v <= 180).length / vs.length, a1c: 3.31 + 0.02392 * avg };
}
function mealCalc(m) {
  const P = S.pts;
  const pre = [...P].reverse().find(p => p.t <= m.t && m.t - p.t <= 30 * MIN);
  const win = P.filter(p => p.t > m.t && p.t <= m.t + 120 * MIN);
  if (!pre || !win.length) return null;
  const pk = win.reduce((a, b) => b.v > a.v ? b : a);
  const h2 = [...win].reverse().find(p => p.t >= m.t + 90 * MIN);
  const rise = pk.v - pre.v;
  let say = rise >= 60 ? '主食が多かったかも。白米を減らす／野菜から' : rise >= 30 ? 'ふつうの上がり方' : '緩やか。この食べ方を続ける';
  const late = h2 && h2.v >= pre.v + 30;
  return { pre: pre.v, peak: pk.v, rise, mins: Math.round((pk.t - m.t) / MIN), h2: h2 ? h2.v : null, say, late: late ? '戻りが遅い。食後に10分歩く' : '' };
}
const mealsOf = k => S.meals.filter(m => dkey(new Date(m.t)) === k).sort((a, b) => a.t - b.t);
const ptsOf = k => S.pts.filter(p => dkey(new Date(p.t)) === k);

function setData() {
  S.days = [...new Set([...S.pts.map(p => dkey(new Date(p.t))), ...S.meals.map(m => dkey(new Date(m.t)))])].sort();
  S.i = Math.min(Math.max(S.i, 0), S.days.length - 1);
  window.__points = S.pts;
  window.__meals = S.days.flatMap(k => mealsOf(k).map(m => ({ date: k, time: hhmm(m.t), name: m.name, ...mealCalc(m) })));
  window.__stats = Object.fromEntries(S.days.map(k => [k, dayStats(ptsOf(k))]));
  render();
}

/* ---------- 描画 ---------- */
const arrow = (d, u = '') => d === 0 ? `→ 0${u}` : `${d > 0 ? '↑' : '↓'} ${Math.abs(d)}${u}`;
function render() {
  const k = S.days[S.i];
  if (!k) {
    $('#report').innerHTML = '<p class="empty">まだデータがありません。下の「サンプル3日分」を押すと、朝のレポートがどう見えるか分かります。</p>';
    $('#chart').innerHTML = ''; $('#meals').innerHTML = ''; return;
  }
  const d = new Date(k + 'T00:00:00'), st = dayStats(ptsOf(k));
  const prev = S.days[S.i - 1], ps = prev && dayStats(ptsOf(prev));
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const ttl = d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
  const lead = dkey(yest) === k ? '昨日' : ttl;
  let h = `<div class="datebar"><button id="prev" aria-label="前の日" ${S.i ? '' : 'disabled'}>←</button><h1>${ttl}</h1><button id="next" aria-label="次の日" ${S.i < S.days.length - 1 ? '' : 'disabled'}>→</button></div>`;
  if (!st) h += '<p class="empty">この日の血糖データがありません。</p>';
  else h += `<div class="hero n"><small>${lead}の平均 mg/dL</small><b>${Math.round(st.avg)}</b></div>
    <div class="stats">
      <div class="n"><small>70〜180の割合</small><b>${Math.round(st.tir)}%</b></div>
      <div class="n"><small>推定A1c</small><b>${st.a1c.toFixed(1)}%</b></div>
      <div class="n"><small>前日比</small>${ps ? `<em>平均 ${arrow(Math.round(st.avg) - Math.round(ps.avg))}</em><em>割合 ${arrow(Math.round(st.tir) - Math.round(ps.tir), 'pt')}</em>` : '<em>前日なし</em>'}</div>
    </div>`;
  $('#report').innerHTML = h;
  $('#prev').onclick = () => { S.i--; render(); };
  $('#next').onclick = () => { S.i++; render(); };
  drawChart(k);
  const ms = mealsOf(k);
  $('#meals').innerHTML = ms.length ? ms.map(cardHtml).join('') : '<p class="empty">この日の食事はまだありません。下から写真を入れてください。</p>';
}
function cardHtml(m) {
  const c = mealCalc(m);
  const th = m.thumb ? `<img src="${m.thumb}" alt="">` : esc(m.emoji || '🍽️');
  const head = `<div class="mh"><div class="th">${th}</div><div><div class="t">${hhmm(m.t)}</div><div class="nm">${esc(m.name)}</div></div></div>`;
  if (!c) return `<article class="meal" id="meal-${m.id}">${head}<p class="cm">この食事の前後の血糖データがありません。</p></article>`;
  const ai = m.ai ? `<span class="ai">写真から: 主食は${esc(m.ai.staple || '?')}${m.ai.veg_first ? '。野菜から食べた可能性あり' : ''}</span>` : '';
  return `<article class="meal" id="meal-${m.id}">${head}
    <div class="rise n ${c.rise >= 60 ? 'hi' : ''}"><small>上昇幅 mg/dL</small><b>${c.rise >= 0 ? '+' : ''}${c.rise}</b></div>
    <div class="row">
      <div class="n"><small>食前</small><b>${c.pre}</b></div>
      <div class="n"><small>ピーク</small><b>${c.peak}</b></div>
      <div class="n"><small>ピークまで</small><b>${c.mins}分</b></div>
      <div class="n"><small>2時間後</small><b>${c.h2 ?? '-'}</b></div>
    </div>
    <p class="cm"><span>${c.say}</span>${c.late ? `<span>${c.late}</span>` : ''}${ai}</p></article>`;
}

function drawChart(k) {
  const el = $('#chart'), W = Math.max(280, el.clientWidth || 340), H = 260;
  const P = ptsOf(k), ms = mealsOf(k);
  if (!P.length) { el.innerHTML = ''; return; }
  const L = 40, R = 10, T = 54, B = 30, t0 = new Date(k + 'T00:00:00').getTime();
  const lo = Math.min(60, Math.floor(Math.min(...P.map(p => p.v)) / 10) * 10), hi = Math.max(200, Math.ceil(Math.max(...P.map(p => p.v)) / 10) * 10);
  const X = t => L + (t - t0) / (24 * 60 * MIN) * (W - L - R), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const path = pts => pts.map((p, i) => `${i && p.t - pts[i - 1].t < 40 * MIN ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  let s = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="1日の血糖カーブ">`;
  s += `<rect x="${L}" y="${Y(180)}" width="${W - L - R}" height="${Y(70) - Y(180)}" fill="var(--band)"/>`;
  [70, 180].forEach(v => s += `<text x="${L - 6}" y="${Y(v) + 4.5}" text-anchor="end">${v}</text>`);
  [0, 6, 12, 18, 24].forEach(h => s += `<text x="${X(t0 + h * 60 * MIN)}" y="${H - 8}" text-anchor="${h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}">${h}時</text>`);
  s += `<path d="${path(P)}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  ms.forEach(m => {
    const w = P.filter(p => p.t >= m.t && p.t <= m.t + 120 * MIN), c = mealCalc(m), x = X(m.t);
    if (w.length > 1) s += `<path d="${path(w)}" fill="none" stroke="var(--acc)" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    s += `<line x1="${x}" x2="${x}" y1="${T - 14}" y2="${H - B}" stroke="var(--ink)" stroke-opacity=".14"/>`;
    if (c) {
      const pk = w.find(p => p.v === c.peak);
      s += `<circle cx="${X(pk.t)}" cy="${Y(pk.v)}" r="5" fill="var(--acc)"/><text class="pk" x="${Math.min(X(pk.t), W - 22)}" y="${Y(pk.v) - 10}" text-anchor="middle">${c.rise >= 0 ? '+' : ''}${c.rise}</text>`;
    }
    const mx = Math.min(Math.max(x, 22), W - 22);
    s += `<g class="mk" data-id="${m.id}" role="button" aria-label="${esc(m.name)}">`
      + (m.thumb ? `<clipPath id="c${m.id}"><circle cx="${mx}" cy="24" r="18"/></clipPath><image href="${m.thumb}" x="${mx - 18}" y="6" width="36" height="36" preserveAspectRatio="xMidYMid slice" clip-path="url(#c${m.id})"/><circle cx="${mx}" cy="24" r="18" fill="none" stroke="var(--acc)" stroke-width="2"/>`
        : `<circle cx="${mx}" cy="24" r="19" fill="#fff" stroke="var(--acc)" stroke-width="2"/><text x="${mx}" y="31" text-anchor="middle">${esc(m.emoji || '🍽️')}</text>`)
      + `</g>`;
  });
  el.innerHTML = s + '</svg>';
  el.querySelectorAll('.mk').forEach(g => g.onclick = () => {
    const c = document.getElementById('meal-' + g.dataset.id);
    c.scrollIntoView({ behavior: 'smooth', block: 'start' });
    c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 1200);
  });
}

/* ---------- 入力 ---------- */
const msg = t => $('#msg').textContent = t;
let uid = 0;
const mk = o => ({ id: ++uid, ...o });
async function loadSample() {
  try {
    const [csv, ml] = await Promise.all([fetch('packs/sample/sample.csv').then(r => r.text()), fetch('packs/sample/meals.json').then(r => r.json())]);
    S.pts = parseCsv(csv);
    S.meals = S.meals.filter(m => m.thumb).concat(ml.map(m => mk({ t: new Date(`${m.date}T${m.time}:00`).getTime(), name: m.name, emoji: m.emoji })));
    S.i = 1e9; setData(); $('#inputs').open = false;
    msg(`サンプル ${S.pts.length} 点を読み込みました`);
  } catch (e) { msg('サンプルを読めませんでした。サーバー経由（http）で開いてください: ' + e.message); }
}
async function loadCsv(file) {
  try { S.pts = parseCsv(await file.text()); S.i = 1e9; setData(); $('#inputs').open = false; msg(`CSV ${S.pts.length} 点を読み込みました`); }
  catch (e) { msg(e.message); }
}
async function shotTime(f) {
  try { const x = window.exifr && await exifr.parse(f); if (x && x.DateTimeOriginal) return +x.DateTimeOriginal; } catch (e) {}
  return f.lastModified;
}
async function ask(f) { // キーがある時だけ写真をClaudeへ送る
  const bmp = await createImageBitmap(f), r = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = bmp.width * r; cv.height = bmp.height * r;
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': S.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 200, messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: cv.toDataURL('image/jpeg', .8).split(',')[1] } },
      { type: 'text', text: 'この食事写真を見て、JSONだけ返してください。{"name":"料理名(日本語で短く)","staple":"多|普|少","veg_first":true|false} staple=ごはん・パン・麺など主食の量、veg_first=野菜から食べた可能性。' }] }] })
  });
  const j = await res.json();
  return JSON.parse(j.content[0].text.match(/\{[\s\S]*\}/)[0]);
}
async function addPhotos(files) {
  const fs = [...files].filter(f => f.type.startsWith('image/'));
  for (const [n, f] of fs.entries()) {
    msg(`写真 ${n + 1}/${fs.length} を処理中`);
    const m = mk({ t: await shotTime(f), name: 'ご飯の写真', emoji: '🍽️', thumb: URL.createObjectURL(f) });
    if (S.key) try { const a = await ask(f); m.name = a.name || m.name; m.ai = a; } catch (e) { msg('AI判定は使えませんでした（キーか通信を確認）。計算は通常どおり出します'); }
    S.meals.push(m);
  }
  setData();
  const j = S.days.indexOf(dkey(new Date(S.meals[S.meals.length - 1].t))); if (j >= 0) { S.i = j; render(); }
  if (fs.length) msg(`写真 ${fs.length} 枚を食事に追加しました`);
}
function dropZone(id, fn) {
  const z = $(id), inp = z.querySelector('input');
  inp.onchange = () => { fn(inp.files); inp.value = ''; };
  ['dragenter', 'dragover'].forEach(e => z.addEventListener(e, ev => { ev.preventDefault(); z.classList.add('on'); }));
  ['dragleave', 'drop'].forEach(e => z.addEventListener(e, () => z.classList.remove('on')));
  z.addEventListener('drop', ev => { ev.preventDefault(); fn(ev.dataTransfer.files); });
}
$('#btn-sample').onclick = loadSample;
dropZone('#drop-csv', fs => fs[0] && loadCsv(fs[0]));
dropZone('#drop-photo', addPhotos);
$('#in-key').value = S.key;
$('#in-key').onchange = e => { S.key = e.target.value.trim(); try { localStorage.setItem('kn_key', S.key); } catch (x) {} };
addEventListener('resize', () => { const k = S.days[S.i]; if (k) drawChart(k); });
render();
