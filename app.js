/* Interfaccia dell'app. Tutti i dati restano sul dispositivo (IndexedDB). */
(function () {
  const D = window.GymData, L = window.GymLogic;
  const $app = document.getElementById('app');
  let S = null;
  let view = 'oggi';
  const ui = { chosen: null, cardioSoon: false, histEx: null, cardioKind: 'rulli' };
  const photos = {}; // exId -> object URL

  /* ---------- Archivio locale ---------- */
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('palestra', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('photos'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function idb(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => res(req && req.result);
      tx.onerror = () => rej(tx.error);
    });
  }
  const kvGet = k => idb('kv', 'readonly', s => s.get(k));
  const kvSet = (k, v) => idb('kv', 'readwrite', s => s.put(v, k));
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => kvSet('state', JSON.parse(JSON.stringify(S))).catch(err => toast('Salvataggio non riuscito: ' + err)), 150);
  }
  async function loadPhotos() {
    const keys = await idb('photos', 'readonly', s => s.getAllKeys());
    for (const k of keys || []) {
      const blob = await idb('photos', 'readonly', s => s.get(k));
      if (blob) photos[k] = URL.createObjectURL(blob);
    }
  }
  async function setPhoto(exId, blob) {
    if (blob) await idb('photos', 'readwrite', s => s.put(blob, exId));
    else await idb('photos', 'readwrite', s => s.delete(exId));
    if (photos[exId]) URL.revokeObjectURL(photos[exId]);
    if (blob) photos[exId] = URL.createObjectURL(blob); else delete photos[exId];
  }

  /* ---------- Utilità ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
  const fmt = n => n == null ? '—' : String(Math.round(n * 100) / 100).replace('.', ',');
  const fmtDate = d => new Date(d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtTime = d => new Date(d).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  const fmtSec = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const findEx = id => L.findExercise(S, id);
  const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#ccc"/></svg>');
  const imgSrc = (e, n = 0) => photos[e.id] || (e.img ? `img/${e.img}/${n}.jpg` : PLACEHOLDER);
  const target = (e, sets, w) => {
    const reps = e.mode === 'time' ? `${e.min}-${e.max}"` : `${e.min}-${e.max}`;
    let t = `${sets}×${reps}${e.perSide ? ' per lato' : ''}`;
    if (e.mode === 'weight') t += w == null ? ' · carico da scegliere' : ` · ${fmt(w)} kg`;
    return t;
  };
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'notice accent';
    t.style.cssText = 'position:fixed;left:16px;right:16px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:60;box-shadow:0 8px 24px rgba(0,0,0,.2)';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  /* ---------- Suoni, vibrazione, schermo acceso ---------- */
  let actx = null;
  document.addEventListener('pointerdown', () => {
    if (!actx) try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    else if (actx.state === 'suspended') actx.resume();
  }, { passive: true });
  function beep() {
    if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
    if (!actx) return;
    [0, 0.25, 0.5].forEach(d => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime + d;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    });
  }
  let wake = null;
  async function syncWakeLock() {
    try {
      if (S && S.current && !wake && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        wake = await navigator.wakeLock.request('screen');
        wake.addEventListener('release', () => { wake = null; });
      } else if ((!S || !S.current) && wake) { await wake.release(); wake = null; }
    } catch (e) { }
  }
  document.addEventListener('visibilitychange', () => { syncWakeLock(); tick(); });

  /* ---------- Icone ---------- */
  const ICON = {
    oggi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>',
    storico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16M6 16l4-5 3 3 5-7"/></svg>',
    scheda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/></svg>',
    altro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>'
  };

  /* ---------- Render ---------- */
  function render() {
    let body = '';
    if (view === 'oggi') body = S.current ? viewWorkout() : viewToday();
    else if (view === 'storico') body = viewHistory();
    else if (view === 'scheda') body = viewProgram();
    else body = viewMore();
    const tabs = ['oggi', 'storico', 'scheda', 'altro'].map(t =>
      `<button class="tab ${view === t ? 'on' : ''}" data-act="tab" data-v="${t}">${ICON[t]}${{ oggi: S.current ? 'Allenamento' : 'Oggi', storico: 'Progressi', scheda: 'Scheda', altro: 'Altro' }[t]}</button>`).join('');
    $app.innerHTML = body + timerHtml() + `<nav class="tabbar">${tabs}</nav>`;
    if (view === 'storico') drawChart();
    syncWakeLock();
  }

  function header(title, sub, right = '') {
    return `<header class="app-header"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</header>`;
  }

  function viewToday() {
    const now = new Date();
    const { next, alt, reason } = L.nextSession(S, now);
    const ses = S.program.sessions.find(x => x.id === ui.chosen) || next;
    let h = header('Oggi', now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }));
    h += '<main>';
    h += banners(now);
    if (!ses) return h + '<div class="empty">La scheda è vuota. Aggiungi una seduta in Scheda.</div></main>';
    const p = L.prescribe(S, ses, now, { cardioSoon: ui.cardioSoon });
    h += `<section class="card"><div class="eyebrow">${ses === next ? 'Prossima seduta' : 'Seduta scelta'}</div>
      <h2>${esc(ses.id)} · ${esc(ses.name)}</h2>`;
    if (p.note) h += `<div class="notice warn">${esc(p.note)}</div>`;
    if (p.items.some(it => it.w == null && findEx(it.exId).mode === 'weight')) h += firstTime;
    if (alt && ses === next) h += `<div class="notice accent">${esc(reason)} Meglio la ${esc(alt.id)} (${esc(alt.name)}).
        <div style="margin-top:8px"><button class="btn small primary" data-act="choose" data-id="${esc(alt.id)}">Passa alla ${esc(alt.id)}</button></div></div>`;
    h += '<ul class="ex-list">' + p.items.map(it => {
      const e = findEx(it.exId);
      return `<li><img class="thumb" src="${imgSrc(e)}" alt="" loading="lazy">
        <div><div class="name">${esc(e.name)}</div><div class="target">${target(e, it.sets, it.w)}</div>
        ${it.notes.map(n => `<div class="small" style="color:var(--warn)">${esc(n)}</div>`).join('')}</div></li>`;
    }).join('') + '</ul>';
    h += `<label class="switch"><span class="small">Cardio intenso nelle prossime 24 ore</span><input type="checkbox" data-act="cardioSoon" ${ui.cardioSoon ? 'checked' : ''}></label>`;
    h += `<button class="btn primary block" data-act="start" data-id="${esc(ses.id)}">Inizia allenamento</button>`;
    h += `<div class="chips" style="margin-top:12px">${S.program.sessions.map(x =>
      `<button class="chip ${x === ses ? 'on' : ''}" data-act="choose" data-id="${esc(x.id)}">${esc(x.id)}</button>`).join('')}</div>`;
    h += '</section>';
    const w = L.weekSummary(S, now);
    h += `<section class="card"><div class="row between"><div><div class="eyebrow">Ultimi 7 giorni</div>
      <div style="font-size:18px;font-weight:600;margin-top:2px">${w.gym} palestra · ${w.cardio} cardio</div></div>
      <button class="btn small" data-act="cardio">+ Cardio</button></div></section>`;
    return h + '</main>';
  }

  function banners(now) {
    let h = '';
    const weeks = L.blockWeeks(S, now);
    const b = D.BLOCKS[S.program.block];
    if (S.program.block === 'base' && weeks >= 5)
      h += `<div class="notice good">Sei a ${weeks} settimane di ricondizionamento: puoi passare a un blocco specifico (forza, ipertrofia o supporto ciclismo). <button class="btn ghost small" data-act="tab" data-v="scheda">Scegli il blocco</button></div>`;
    else if (S.program.block !== 'base' && weeks >= 6)
      h += `<div class="notice good">Il blocco ${esc(b.label)} dura da ${weeks} settimane: valuta un cambio o una settimana leggera. <button class="btn ghost small" data-act="tab" data-v="scheda">Vai alla scheda</button></div>`;
    const gyms = S.log.length;
    const lastExp = S.lastExport ? L.daysBetween(S.lastExport, now) : Infinity;
    if (gyms >= 3 && lastExp > 14)
      h += `<div class="notice warn">I dati sono solo su questo telefono: ${S.lastExport ? `ultimo backup ${lastExp} giorni fa` : 'non hai ancora fatto un backup'}. <button class="btn ghost small" data-act="export">Esporta ora</button></div>`;
    return h;
  }

  const firstTime = '<div class="notice accent">Dove manca il carico è la prima volta: scegli un peso che ti lasci 2 ripetizioni di margine (per le trazioni la zavorra, 0 se a corpo libero). Da lì la scheda si regola da sola.</div>';

  function viewWorkout() {
    const c = S.current;
    const ses = S.program.sessions.find(x => x.id === c.sessionId) || { id: c.sessionId, name: '' };
    let h = header(`${esc(ses.id)} · ${esc(ses.name)}`, `Iniziato alle ${fmtTime(c.startedAt)}`);
    h += `<main class="${c.timer ? 'with-timer' : ''}">`;
    if (c.note) h += `<div class="notice warn">${esc(c.note)}</div>`;
    if (c.items.some(it => it.w == null && findEx(it.exId) && findEx(it.exId).mode === 'weight')) h += firstTime;
    c.items.forEach((it, i) => {
      const e = findEx(it.exId);
      if (!e) return;
      const last = L.lastEntry(S, e.id);
      const isTime = e.mode === 'time';
      h += `<section class="card ex-card"><div class="head">
        <img class="thumb" src="${imgSrc(e)}" alt="Come si esegue ${esc(e.name)}" data-act="demo" data-ex="${esc(e.id)}">
        <div class="meta"><h3>${esc(e.name)}</h3><div class="small muted">${target(e, it.sets.length, it.w)} · rec. ${fmtSec(it.rest)}</div></div></div>`;
      it.notes.forEach(n => { h += `<div class="notice warn">${esc(n)}</div>`; });
      if (last) h += `<div class="last">Ultima volta (${fmtDate(last.date)}): ${last.sets.map(x => isTime ? `${x.r}"` : `${fmt(x.w)}×${x.r}`).join(' · ')}</div>`;
      h += `<div class="sets"><div class="sets-head"><span></span><span>${isTime ? '' : 'kg'}</span><span>${isTime ? 'sec' : 'rip.'}</span><span></span></div>`;
      it.sets.forEach((st, j) => {
        h += `<div class="set ${st.done ? 'done' : ''}"><div class="n">${j + 1}</div>
          ${isTime ? '<div></div>' : `<label><input inputmode="decimal" enterkeyhint="next" data-set="${i}:${j}:w" value="${st.w == null ? '' : fmt(st.w)}" aria-label="Peso serie ${j + 1}"><span>kg</span></label>`}
          <label><input inputmode="numeric" enterkeyhint="done" data-set="${i}:${j}:r" value="${st.r == null ? '' : st.r}" aria-label="${isTime ? 'Secondi' : 'Ripetizioni'} serie ${j + 1}"><span>${isTime ? 's' : 'rip'}</span></label>
          <button class="check" data-act="check" data-i="${i}" data-j="${j}" aria-label="Serie fatta">✓</button></div>`;
      });
      h += `</div><div class="row" style="margin-top:6px"><button class="btn ghost small" data-act="addset" data-i="${i}">+ Serie</button>
        ${it.sets.length > 1 ? `<button class="btn ghost small" style="color:var(--muted)" data-act="delset" data-i="${i}">− Serie</button>` : ''}</div></section>`;
    });
    h += `<button class="btn primary block" data-act="finish" style="margin-top:8px">Termina allenamento</button>
      <button class="btn ghost block danger" data-act="cancel" style="margin-top:6px;text-align:center">Annulla allenamento</button>`;
    return h + '</main>';
  }

  function timerHtml() {
    const t = S.current && S.current.timer;
    if (!t) return '';
    return `<div class="timer" id="timer"><div class="t" id="tt"></div><div class="lbl">${esc(t.label)}</div>
      <button data-act="timer" data-d="-15">−15</button><button data-act="timer" data-d="15">+15</button><button data-act="timer" data-d="0">Chiudi</button>
      <div class="bar" id="tb"></div></div>`;
  }
  function tick() {
    const t = S && S.current && S.current.timer;
    const el = document.getElementById('timer');
    if (!t || !el) return;
    const left = (t.end - Date.now()) / 1000;
    document.getElementById('tt').textContent = left >= 0 ? fmtSec(left) : '+' + fmtSec(-left);
    document.getElementById('tb').style.width = Math.max(0, Math.min(100, (1 - left / t.total) * 100)) + '%';
    el.classList.toggle('over', left < 0);
    if (left <= 0 && !t.fired) { t.fired = true; save(); beep(); }
  }
  setInterval(tick, 250);

  function viewHistory() {
    let h = header('Progressi', '');
    h += '<main>';
    const all = [];
    S.program.sessions.forEach(s => s.exercises.forEach(e => { if (e.mode === 'weight') all.push(e); }));
    if (!ui.histEx || !all.find(e => e.id === ui.histEx)) ui.histEx = all[0] && all[0].id;
    const hist = ui.histEx ? L.exerciseHistory(S, ui.histEx) : [];
    h += `<section class="card"><div class="eyebrow">Andamento esercizio</div>
      <label class="field"><select data-act="histEx">${all.map(e => `<option value="${esc(e.id)}" ${e.id === ui.histEx ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select></label>`;
    if (hist.length) {
      const best = hist.reduce((a, b) => b.e1rm > a.e1rm ? b : a);
      const lastH = hist[hist.length - 1];
      h += `<canvas class="chart" id="chart" aria-label="Massimale stimato nel tempo"></canvas>
        <div class="grid2 small" style="margin-top:8px"><div><div class="muted">Massimale stimato</div><b>${fmt(Math.round(best.e1rm))} kg</b> <span class="muted">(${fmtDate(best.date)})</span></div>
        <div><div class="muted">Ultimo carico</div><b>${fmt(lastH.top)} kg</b> <span class="muted">×${lastH.reps}</span></div></div>
        <div class="small muted" style="margin-top:6px">Massimale stimato con la formula di Epley sulla serie migliore di ogni seduta.</div>`;
    } else h += '<div class="empty">Ancora nessun dato per questo esercizio.</div>';
    h += '</section>';
    const logs = S.log.slice().reverse();
    h += `<section class="card"><div class="row between"><div class="eyebrow">Attività</div><button class="btn small" data-act="cardio">+ Cardio</button></div>`;
    if (!logs.length) h += '<div class="empty">Qui compariranno allenamenti e cardio.</div>';
    logs.slice(0, 80).forEach(l => {
      if (l.type === 'gym') {
        h += `<details class="hist-item"><summary><span><span class="badge">${esc(l.sessionId)}</span> <b>${esc(l.sessionName)}</b></span><span class="muted small">${fmtDate(l.date)}</span></summary>
          <div class="small" style="margin-top:8px">${l.minutes ? l.minutes + ' min · ' : ''}${l.factor < 1 ? 'rientro al ' + Math.round(l.factor * 100) + '%' : ''}</div>
          ${l.entries.map(en => `<div class="small" style="margin-top:4px"><b>${esc(en.name)}</b>: ${en.sets.length ? en.sets.map(x => x.w != null && findEx(en.exId)?.mode !== 'time' ? `${fmt(x.w)}×${x.r}` : `${x.r}`).join(' · ') : '<span class="muted">saltato</span>'}</div>`).join('')}
          <button class="btn ghost small danger" data-act="dellog" data-id="${esc(l.id)}">Elimina</button></details>`;
      } else {
        const bits = [l.minutes ? l.minutes + ' min' : '', l.km ? fmt(l.km) + ' km' : '', l.watts ? l.watts + ' W' : '', l.rpe ? 'RPE ' + l.rpe : ''].filter(Boolean).join(' · ');
        h += `<details class="hist-item"><summary><span><span class="badge cardio">${esc({ corsa: 'Corsa', spinning: 'Spinning', rulli: 'Rulli' }[l.kind] || l.kind)}</span> ${bits}${l.intense ? ' · intenso' : ''}</span><span class="muted small">${fmtDate(l.date)}</span></summary>
          ${l.note ? `<div class="small" style="margin-top:6px">${esc(l.note)}</div>` : ''}
          <button class="btn ghost small danger" data-act="dellog" data-id="${esc(l.id)}">Elimina</button></details>`;
      }
    });
    return h + '</section></main>';
  }

  function drawChart() {
    const cv = document.getElementById('chart');
    if (!cv) return;
    const hist = L.exerciseHistory(S, ui.histEx);
    const css = getComputedStyle(document.documentElement);
    const col = n => css.getPropertyValue(n).trim();
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const pad = { l: 36, r: 10, t: 12, b: 22 };
    const ys = hist.map(x => x.e1rm), xs = hist.map(x => new Date(x.date).getTime());
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (y1 - y0 < 5) { y0 -= 3; y1 += 3; }
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const X = t => pad.l + (x1 === x0 ? (W - pad.l - pad.r) / 2 : (t - x0) / (x1 - x0) * (W - pad.l - pad.r));
    const Y = v => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b);
    g.font = '11px -apple-system, sans-serif'; g.fillStyle = col('--muted'); g.strokeStyle = col('--line'); g.lineWidth = 1;
    for (let k = 0; k <= 3; k++) {
      const v = y0 + (y1 - y0) * k / 3, y = Y(v);
      g.beginPath(); g.moveTo(pad.l, y); g.lineTo(W - pad.r, y); g.stroke();
      g.fillText(Math.round(v), 4, y + 4);
    }
    g.fillText(fmtDate(x0), pad.l, H - 6);
    if (x1 !== x0) { const t = fmtDate(x1); g.fillText(t, W - pad.r - g.measureText(t).width, H - 6); }
    g.strokeStyle = col('--accent'); g.lineWidth = 2.5; g.lineJoin = 'round'; g.beginPath();
    hist.forEach((p, i) => { const x = X(xs[i]), y = Y(p.e1rm); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.fillStyle = col('--accent');
    hist.forEach((p, i) => { g.beginPath(); g.arc(X(xs[i]), Y(p.e1rm), 3.5, 0, 7); g.fill(); });
  }

  function viewProgram() {
    let h = header('Scheda', 'Rotazione: fai sempre la seduta successiva');
    h += '<main>';
    const b = D.BLOCKS[S.program.block] || D.BLOCKS.base;
    h += `<section class="card"><div class="eyebrow">Blocco attuale</div>
      <div class="chips" style="margin:8px 0">${Object.entries(D.BLOCKS).map(([id, x]) =>
      `<button class="chip ${id === S.program.block ? 'on' : ''}" data-act="block" data-id="${id}">${esc(x.label)}</button>`).join('')}</div>
      <div class="small">${esc(b.desc)}</div>
      <div class="small muted" style="margin-top:6px">${S.blockStart ? `In corso da ${L.blockWeeks(S, new Date())} settimane.` : 'Parte dal primo allenamento.'}</div></section>`;
    S.program.sessions.forEach((ses, si) => {
      h += `<section class="card"><div class="row between"><h3>${esc(ses.id)} · ${esc(ses.name)}</h3>
        <button class="btn small" data-act="editses" data-si="${si}">Modifica</button></div>
        ${ses.legsHeavy ? '<div class="small muted">Seduta pesante per le gambe</div>' : ''}`;
      ses.exercises.forEach((e, ei) => {
        const st = S.exState[e.id];
        h += `<div class="edit-ex" role="button" data-act="editex" data-si="${si}" data-ei="${ei}">
          <img class="thumb" src="${imgSrc(e)}" alt="" loading="lazy">
          <div class="grow"><div style="font-weight:600">${esc(e.name)}</div><div class="small muted">${target(e, e.sets, st && st.w)} · rec. ${fmtSec(e.rest)}</div></div>
          <span class="muted">›</span></div>`;
      });
      h += `<button class="btn ghost small" data-act="addex" data-si="${si}">+ Aggiungi esercizio</button></section>`;
    });
    h += `<button class="btn block" data-act="addses">+ Aggiungi seduta</button>`;
    return h + '</main>';
  }

  function viewMore() {
    let h = header('Altro', '');
    h += `<main><section class="card stack"><div class="eyebrow">Backup</div>
      <div class="small">I dati sono salvati solo su questo telefono. Esporta un backup ogni tanto e salvalo in File o iCloud.</div>
      <div class="small muted">${S.lastExport ? 'Ultimo backup: ' + fmtDate(S.lastExport) : 'Nessun backup ancora.'}</div>
      <button class="btn primary block" data-act="export">Esporta backup</button>
      <label class="btn block" style="text-align:center">Importa backup<input type="file" accept="application/json,.json" data-act="import" hidden></label></section>
      <section class="card stack"><div class="eyebrow">Installazione</div>
      <div class="small">Su iPhone apri il sito con Safari, tocca Condividi e poi “Aggiungi alla schermata Home”. Installata così funziona offline e iOS non cancella i dati dopo qualche giorno di inutilizzo, cosa che può succedere se la usi solo dentro Safari.</div>
      <div class="small muted" id="persist"></div></section>
      <section class="card stack"><div class="eyebrow">Come si adatta la scheda</div>
      <div class="small">Rotazione: la prossima seduta è quella fatta meno di recente, qualunque giorno sia.<br>
      Progressione: se chiudi tutte le serie al massimo delle ripetizioni, la volta dopo il carico sale. Sotto il minimo due volte di fila: −10%.<br>
      Pause: dopo 8-14 giorni −10%, oltre 14 giorni −20%, con una serie in meno sui fondamentali; poi risale del 10% a seduta.<br>
      Cardio: dopo un cardio intenso (o se ne hai uno in arrivo) una serie in meno sugli esercizi per le gambe e suggerimento della seduta meno pesante per le gambe.</div></section>
      <section class="card stack"><div class="eyebrow">Immagini</div>
      <div class="small">Le immagini degli esercizi vengono da Free Exercise DB (github.com/yuhonas/free-exercise-db), pubblicato come dominio pubblico. Puoi sostituire ognuna con una tua foto dalla Scheda.</div></section>
      <section class="card"><button class="btn block danger" data-act="reset">Cancella tutti i dati</button></section></main>`;
    setTimeout(async () => {
      const el = document.getElementById('persist');
      if (!el || !navigator.storage || !navigator.storage.persisted) return;
      const p = await navigator.storage.persisted();
      el.textContent = p ? 'Archivio protetto: il browser non lo cancellerà automaticamente.' : 'Archivio non ancora protetto dal browser.';
    });
    return h;
  }

  /* ---------- Fogli modali ---------- */
  function openSheet(html) {
    closeSheet();
    const w = document.createElement('div');
    w.className = 'sheet-wrap'; w.id = 'sheet';
    w.innerHTML = `<div class="sheet-backdrop" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(w);
    return w.querySelector('.sheet');
  }
  function closeSheet() { const s = document.getElementById('sheet'); if (s) s.remove(); }

  function sheetDemo(exId) {
    const e = findEx(exId);
    const own = !!photos[e.id];
    openSheet(`<h2>${esc(e.name)}</h2>
      <div class="demo"><img src="${imgSrc(e, 0)}" alt="Posizione iniziale">${own || !e.img ? '' : `<img class="b" src="${imgSrc(e, 1)}" alt="Posizione finale">`}</div>
      <div class="small muted" style="margin:10px 0">${target(e, e.sets, S.exState[e.id] && S.exState[e.id].w)} · recupero ${fmtSec(e.rest)}</div>
      <button class="btn block" data-act="close">Chiudi</button>`);
  }

  function sheetCardio() {
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const kinds = { corsa: 'Corsa', spinning: 'Spinning', rulli: 'Rulli' };
    const sh = openSheet(`<h2>Registra cardio</h2>
      <div class="chips" id="ckind">${Object.entries(kinds).map(([k, v]) => `<button class="chip ${k === ui.cardioKind ? 'on' : ''}" data-act="ckind" data-k="${k}">${v}</button>`).join('')}</div>
      <label class="field"><span>Data e ora</span><input type="datetime-local" id="c-date" value="${now.toISOString().slice(0, 16)}"></label>
      <div class="grid2"><label class="field"><span>Durata (min)</span><input inputmode="numeric" id="c-min" placeholder="60"></label>
      <label class="field" id="c-x-wrap"></label></div>
      <label class="field"><span>Sforzo percepito (RPE 1-10)</span><select id="c-rpe">${[...Array(10)].map((_, i) => `<option ${i + 1 === 6 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
      <label class="switch"><span class="small">Seduta intensa (ripetute, soglia, gara). Dall'RPE 8 è automatico.</span><input type="checkbox" id="c-int"></label>
      <label class="field"><span>Note</span><input id="c-note" placeholder="Facoltative"></label>
      <button class="btn primary block" data-act="savecardio">Salva</button>`);
    setCardioExtra(sh);
  }
  function setCardioExtra(sh) {
    const w = sh.querySelector('#c-x-wrap');
    w.innerHTML = ui.cardioKind === 'corsa'
      ? '<span>Distanza (km)</span><input inputmode="decimal" id="c-x" placeholder="10">'
      : '<span>Potenza media (W)</span><input inputmode="numeric" id="c-x" placeholder="180">';
  }

  function sheetEditEx(si, ei) {
    const ses = S.program.sessions[si];
    const isNew = ei == null;
    const e = isNew ? { id: 'x' + Date.now().toString(36), name: '', img: '', kind: 'acc', sets: 3, min: 10, max: 12, rest: 60, inc: 2.5, mode: 'weight', legs: false, perSide: false } : ses.exercises[ei];
    const st = S.exState[e.id] || {};
    const draft = { img: e.img };
    const sh = openSheet(`<h2>${isNew ? 'Nuovo esercizio' : 'Modifica esercizio'}</h2>
      <label class="field"><span>Nome</span><input id="e-name" value="${esc(e.name)}" placeholder="Es. Leg press"></label>
      <div class="row" style="margin:8px 0"><img class="thumb" id="e-thumb" src="${imgSrc(e)}" alt="">
        <div class="stack" style="flex:1"><button class="btn small block" data-act="pickimg">Scegli immagine</button>
        <label class="btn small block" style="text-align:center">Usa una tua foto<input type="file" accept="image/*" id="e-photo" hidden></label></div></div>
      ${photos[e.id] ? '<button class="btn ghost small" data-act="rmphoto">Torna all\'immagine standard</button>' : ''}
      <div id="imgpick" hidden></div>
      <div class="grid2"><label class="field"><span>Tipo</span><select id="e-kind">
        <option value="main" ${e.kind === 'main' ? 'selected' : ''}>Fondamentale</option>
        <option value="sec" ${e.kind === 'sec' ? 'selected' : ''}>Secondario</option>
        <option value="acc" ${e.kind === 'acc' ? 'selected' : ''}>Complementare</option></select></label>
      <label class="field"><span>Misura</span><select id="e-mode">
        <option value="weight" ${e.mode === 'weight' ? 'selected' : ''}>Peso e ripetizioni</option>
        <option value="time" ${e.mode === 'time' ? 'selected' : ''}>Tempo (secondi)</option></select></label></div>
      <div class="grid4"><label class="field"><span>Serie</span><input inputmode="numeric" id="e-sets" value="${e.sets}"></label>
      <label class="field"><span>Min</span><input inputmode="numeric" id="e-min" value="${e.min}"></label>
      <label class="field"><span>Max</span><input inputmode="numeric" id="e-max" value="${e.max}"></label>
      <label class="field"><span>Rec. (s)</span><input inputmode="numeric" id="e-rest" value="${e.rest}"></label></div>
      <div class="grid2"><label class="field"><span>Incremento (kg)</span><input inputmode="decimal" id="e-inc" value="${fmt(e.inc)}"></label>
      <label class="field"><span>Carico di lavoro (kg)</span><input inputmode="decimal" id="e-w" value="${st.w == null ? '' : fmt(st.w)}" placeholder="vuoto = da scegliere"></label></div>
      <label class="switch"><span class="small">Esercizio per le gambe (si alleggerisce dopo il cardio)</span><input type="checkbox" id="e-legs" ${e.legs ? 'checked' : ''}></label>
      <label class="switch"><span class="small">Ripetizioni per lato</span><input type="checkbox" id="e-side" ${e.perSide ? 'checked' : ''}></label>
      <button class="btn primary block" data-act="saveex">Salva</button>
      ${isNew ? '' : `<div class="grid3" style="margin-top:10px"><button class="btn small" data-act="mvex" data-d="-1">↑ Su</button><button class="btn small" data-act="mvex" data-d="1">↓ Giù</button><button class="btn small danger" data-act="delex">Elimina</button></div>`}`);
    sh._ctx = { si, ei, e, isNew, draft };
    sh.querySelector('#e-photo').addEventListener('change', async ev => {
      const f = ev.target.files[0];
      if (!f) return;
      draft.photo = await resizeImage(f);
      sh.querySelector('#e-thumb').src = URL.createObjectURL(draft.photo);
    });
  }

  function resizeImage(file) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 800 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(b => b ? res(b) : rej(new Error('foto')), 'image/jpeg', 0.8);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }

  function sheetEditSession(si) {
    const isNew = si == null;
    const ses = isNew ? { id: String.fromCharCode(65 + S.program.sessions.length), name: '', legsHeavy: false, exercises: [] } : S.program.sessions[si];
    const sh = openSheet(`<h2>${isNew ? 'Nuova seduta' : 'Modifica seduta'}</h2>
      <div class="grid2"><label class="field"><span>Sigla</span><input id="s-id" value="${esc(ses.id)}" maxlength="3"></label>
      <label class="field"><span>Nome</span><input id="s-name" value="${esc(ses.name)}" placeholder="Es. Gambe"></label></div>
      <label class="switch"><span class="small">Seduta pesante per le gambe (evitata subito dopo il cardio intenso)</span><input type="checkbox" id="s-legs" ${ses.legsHeavy ? 'checked' : ''}></label>
      <button class="btn primary block" data-act="saveses">Salva</button>
      ${isNew ? '' : '<button class="btn ghost block danger" data-act="delses" style="margin-top:8px;text-align:center">Elimina seduta</button>'}`);
    sh._ctx = { si, isNew, ses };
  }

  function sheetSummary(changes) {
    const rows = changes.map(c => `<div class="change"><b>${esc(c.name)}</b>
      ${c.to != null ? ` <span class="${c.up ? 'up' : c.down ? 'down' : ''}">${c.from != null && c.from !== c.to ? fmt(c.from) + ' → ' : ''}<span class="to">${fmt(c.to)} kg</span></span>` : ''}
      <div class="small muted">${esc(c.msg)}</div></div>`).join('');
    const n = L.nextSession(S, new Date()).next;
    openSheet(`<h2>Allenamento salvato</h2>
      <div class="small muted" style="margin-bottom:8px">Ecco come cambia la scheda per la prossima volta${n ? ` (prossima seduta: ${esc(n.id)})` : ''}.</div>
      ${rows || '<div class="empty">Nessuna serie registrata.</div>'}
      <button class="btn primary block" data-act="close" style="margin-top:12px">Fatto</button>`);
  }

  /* ---------- Backup ---------- */
  const blobToDataURL = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
  async function exportData() {
    const keys = await idb('photos', 'readonly', s => s.getAllKeys());
    const ph = {};
    for (const k of keys || []) { const b = await idb('photos', 'readonly', s => s.get(k)); if (b) ph[k] = await blobToDataURL(b); }
    S.lastExport = new Date().toISOString();
    const data = { app: 'palestra', v: 1, exportedAt: S.lastExport, state: S, photos: ph };
    const name = `palestra-backup-${S.lastExport.slice(0, 10)}.json`;
    const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Backup palestra' });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
      save(); render(); toast('Backup esportato');
    } catch (err) { if (err && err.name !== 'AbortError') toast('Esportazione non riuscita'); S.lastExport = null; }
  }
  async function importData(file) {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'palestra' || !data.state || !data.state.program) throw new Error('formato');
      if (!confirm(`Importare il backup del ${fmtDate(data.exportedAt)}? I dati attuali verranno sostituiti.`)) return;
      S = data.state;
      await idb('photos', 'readwrite', s => s.clear());
      Object.keys(photos).forEach(k => { URL.revokeObjectURL(photos[k]); delete photos[k]; });
      for (const [k, url] of Object.entries(data.photos || {})) await setPhoto(k, await (await fetch(url)).blob());
      save(); view = 'oggi'; render(); toast('Backup importato');
    } catch (e) { toast('File di backup non valido'); }
  }

  /* ---------- Azioni ---------- */
  document.addEventListener('click', async ev => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
    const a = el.dataset.act;
    const sh = document.querySelector('#sheet .sheet');
    const ctx = sh && sh._ctx;
    switch (a) {
      case 'tab': closeSheet(); view = el.dataset.v; render(); window.scrollTo(0, 0); break;
      case 'close': closeSheet(); break;
      case 'choose': ui.chosen = el.dataset.id; render(); break;
      case 'start':
        L.startWorkout(S, el.dataset.id, new Date(), { cardioSoon: ui.cardioSoon });
        ui.chosen = null; ui.cardioSoon = false; save(); render(); window.scrollTo(0, 0);
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
        break;
      case 'check': {
        const it = S.current.items[+el.dataset.i], st = it.sets[+el.dataset.j];
        st.done = !st.done;
        if (st.done) {
          const e = findEx(it.exId);
          const nextIdx = it.sets.findIndex(x => !x.done);
          let label = nextIdx >= 0 ? `${e.name} · serie ${nextIdx + 1}` : '';
          if (nextIdx < 0) {
            const nx = S.current.items.slice(+el.dataset.i + 1).find(x => x.sets.some(y => !y.done));
            label = nx ? 'Poi: ' + findEx(nx.exId).name : 'Ultima serie fatta';
          }
          if (nextIdx >= 0 || label !== 'Ultima serie fatta') S.current.timer = { end: Date.now() + it.rest * 1000, total: it.rest, label: 'Recupero · ' + label };
          if (nextIdx >= 0 && it.sets[nextIdx].w == null && st.w != null) it.sets.slice(nextIdx).forEach(x => { if (x.w == null) x.w = st.w; });
        }
        save(); render(); tick(); break;
      }
      case 'timer': {
        const t = S.current && S.current.timer; if (!t) break;
        const d = +el.dataset.d;
        if (!d) S.current.timer = null; else { t.end += d * 1000; t.total = Math.max(t.total + d, 1); if (t.end > Date.now()) t.fired = false; }
        save(); render(); tick(); break;
      }
      case 'addset': { const it = S.current.items[+el.dataset.i]; const l = it.sets[it.sets.length - 1]; it.sets.push({ w: l ? l.w : it.w, r: l ? l.r : it.max, done: false }); save(); render(); break; }
      case 'delset': { const it = S.current.items[+el.dataset.i]; if (it.sets.length > 1) it.sets.pop(); save(); render(); break; }
      case 'demo': sheetDemo(el.dataset.ex); break;
      case 'finish': {
        const any = S.current.items.some(it => it.sets.some(x => x.done));
        if (!any && !confirm('Non hai segnato nessuna serie. Salvare comunque?')) break;
        const pending = S.current.items.reduce((n, it) => n + it.sets.filter(x => !x.done).length, 0);
        if (any && pending && !confirm(`Ci sono ${pending} serie non segnate: verranno considerate non fatte. Terminare?`)) break;
        const changes = L.finishWorkout(S, new Date());
        save(); render(); window.scrollTo(0, 0); sheetSummary(changes); break;
      }
      case 'cancel': if (confirm('Annullare l\'allenamento? Le serie segnate non verranno salvate.')) { S.current = null; save(); render(); } break;
      case 'cardio': sheetCardio(); break;
      case 'ckind': ui.cardioKind = el.dataset.k; sh.querySelectorAll('#ckind .chip').forEach(c => c.classList.toggle('on', c === el)); setCardioExtra(sh); break;
      case 'savecardio': {
        const date = new Date(sh.querySelector('#c-date').value || Date.now());
        const x = num(sh.querySelector('#c-x').value);
        L.addCardio(S, {
          date: date.toISOString(), kind: ui.cardioKind, minutes: num(sh.querySelector('#c-min').value),
          km: ui.cardioKind === 'corsa' ? x : null, watts: ui.cardioKind !== 'corsa' ? x : null,
          rpe: +sh.querySelector('#c-rpe').value, intense: sh.querySelector('#c-int').checked, note: sh.querySelector('#c-note').value.trim()
        });
        save(); closeSheet(); render(); toast('Cardio registrato'); break;
      }
      case 'dellog': if (confirm('Eliminare questa attività? I carichi della scheda non cambiano.')) { S.log = S.log.filter(l => l.id !== el.dataset.id); save(); render(); } break;
      case 'block': {
        const id = el.dataset.id;
        if (id === S.program.block) break;
        if (!confirm(`Passare al blocco ${D.BLOCKS[id].label}? Serie, ripetizioni e recuperi degli esercizi a peso verranno aggiornati e i carichi ricalcolati sul nuovo range.`)) break;
        L.switchBlock(S, id, D.BLOCKS); save(); render(); toast('Blocco aggiornato'); break;
      }
      case 'editses': sheetEditSession(+el.dataset.si); break;
      case 'addses': sheetEditSession(null); break;
      case 'saveses': {
        const id = sh.querySelector('#s-id').value.trim().toUpperCase() || '?';
        if (S.program.sessions.some((x, i) => x.id === id && i !== ctx.si)) { toast('Sigla già usata'); break; }
        const oldId = ctx.ses.id;
        Object.assign(ctx.ses, { id, name: sh.querySelector('#s-name').value.trim() || 'Seduta ' + id, legsHeavy: sh.querySelector('#s-legs').checked });
        if (ctx.isNew) S.program.sessions.push(ctx.ses);
        else if (oldId !== id) S.log.forEach(l => { if (l.sessionId === oldId) l.sessionId = id; });
        save(); closeSheet(); render(); break;
      }
      case 'delses':
        if (S.current && S.current.sessionId === ctx.ses.id) { toast('Prima termina l\'allenamento in corso'); break; }
        if (confirm('Eliminare la seduta e i suoi esercizi dalla scheda? Lo storico resta.')) { S.program.sessions.splice(ctx.si, 1); save(); closeSheet(); render(); }
        break;
      case 'editex': sheetEditEx(+el.dataset.si, +el.dataset.ei); break;
      case 'addex': sheetEditEx(+el.dataset.si, null); break;
      case 'pickimg': {
        const box = sh.querySelector('#imgpick');
        box.hidden = !box.hidden;
        if (!box.innerHTML) box.innerHTML = '<div class="img-grid" style="margin:8px 0">' + D.IMG_LIB.map(x =>
          `<button data-act="setimg" data-img="${x.id}" class="${x.id === ctx.draft.img ? 'on' : ''}" aria-label="${esc(x.label)}"><img src="img/${x.id}/0.jpg" alt="" loading="lazy"></button>`).join('') + '</div>';
        break;
      }
      case 'setimg':
        ctx.draft.img = el.dataset.img; ctx.draft.photo = null; ctx.draft.rmPhoto = true;
        sh.querySelectorAll('.img-grid button').forEach(b => b.classList.toggle('on', b === el));
        sh.querySelector('#e-thumb').src = `img/${el.dataset.img}/0.jpg`;
        if (!sh.querySelector('#e-name').value) sh.querySelector('#e-name').value = D.IMG_LIB.find(x => x.id === el.dataset.img).label;
        break;
      case 'rmphoto': ctx.draft.rmPhoto = true; ctx.draft.photo = null; sh.querySelector('#e-thumb').src = ctx.draft.img ? `img/${ctx.draft.img}/0.jpg` : PLACEHOLDER; el.remove(); break;
      case 'saveex': {
        const v = id => sh.querySelector(id).value;
        const name = v('#e-name').trim();
        if (!name) { toast('Dai un nome all\'esercizio'); break; }
        let min = num(v('#e-min')) || 1, max = num(v('#e-max')) || min;
        if (max < min) [min, max] = [max, min];
        Object.assign(ctx.e, {
          name, img: ctx.draft.img, kind: v('#e-kind'), mode: v('#e-mode'),
          sets: Math.max(1, Math.round(num(v('#e-sets')) || 3)), min, max, rest: Math.max(0, Math.round(num(v('#e-rest')) || 60)),
          inc: Math.max(0, num(v('#e-inc')) || 0), legs: sh.querySelector('#e-legs').checked, perSide: sh.querySelector('#e-side').checked
        });
        const w = num(v('#e-w'));
        const st = S.exState[ctx.e.id] || { fails: 0 };
        if (w !== (st.w == null ? null : st.w)) { st.w = w; st.fails = 0; }
        S.exState[ctx.e.id] = st;
        if (ctx.isNew) S.program.sessions[ctx.si].exercises.push(ctx.e);
        if (ctx.draft.photo) await setPhoto(ctx.e.id, ctx.draft.photo);
        else if (ctx.draft.rmPhoto && photos[ctx.e.id]) await setPhoto(ctx.e.id, null);
        save(); closeSheet(); render(); break;
      }
      case 'mvex': {
        const list = S.program.sessions[ctx.si].exercises, to = ctx.ei + +el.dataset.d;
        if (to < 0 || to >= list.length) break;
        [list[ctx.ei], list[to]] = [list[to], list[ctx.ei]];
        save(); closeSheet(); render(); break;
      }
      case 'delex':
        if (confirm('Eliminare l\'esercizio dalla scheda? Lo storico resta.')) { S.program.sessions[ctx.si].exercises.splice(ctx.ei, 1); save(); closeSheet(); render(); }
        break;
      case 'export': exportData(); break;
      case 'reset':
        if (confirm('Cancellare tutti i dati? Esporta prima un backup se vuoi conservarli.') && confirm('Sicuro? L\'operazione non si può annullare.')) {
          S = L.newState(D.DEFAULT_PROGRAM);
          await idb('photos', 'readwrite', s => s.clear());
          Object.keys(photos).forEach(k => { URL.revokeObjectURL(photos[k]); delete photos[k]; });
          save(); view = 'oggi'; render();
        }
        break;
    }
  });

  document.addEventListener('input', ev => {
    const k = ev.target.dataset.set;
    if (k && S.current) {
      const [i, j, f] = k.split(':');
      const it = S.current.items[+i];
      it.sets[+j][f] = num(ev.target.value);
      // Cambiare il peso della prima serie lo propaga alle serie successive non ancora fatte
      if (f === 'w') it.sets.forEach((x, n) => {
        if (n > +j && !x.done) { x.w = it.sets[+j].w; const inp = document.querySelector(`[data-set="${i}:${n}:w"]`); if (inp) inp.value = x.w == null ? '' : fmt(x.w); }
      });
      save();
    }
  });
  document.addEventListener('change', ev => {
    const a = ev.target.dataset.act;
    if (a === 'cardioSoon') { ui.cardioSoon = ev.target.checked; render(); }
    else if (a === 'histEx') { ui.histEx = ev.target.value; render(); }
    else if (a === 'import' && ev.target.files[0]) importData(ev.target.files[0]);
  });

  /* ---------- Avvio ---------- */
  (async function init() {
    try {
      S = await kvGet('state');
      await loadPhotos();
    } catch (e) { console.warn(e); }
    if (!S || !S.program) S = L.newState(D.DEFAULT_PROGRAM);
    // Versione 2 della scheda: sostituisce gli esercizi cambiati anche nei dati già salvati
    if ((S.v || 1) < 2 && !S.current) {
      for (const ses of S.program.sessions) {
        ses.exercises = ses.exercises.map(e => {
          const n = D.REPLACE_V2[e.id];
          return n && !L.findExercise(S, n.id) ? JSON.parse(JSON.stringify(n)) : e;
        });
        if (ses.id === 'B' && ses.name === 'Tirata + stacco') ses.name = 'Tirata + stacco manubri';
      }
      S.v = 2; save();
    }
    render(); tick();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
  })();
})();
