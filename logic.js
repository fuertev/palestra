/* Logica della scheda dinamica: rotazione, rientro dopo pause, cardio, progressione, blocchi.
   Funzioni pure sullo stato, testabili anche fuori dal browser. */
(function (root) {
  const DAY = 86400000;

  const roundTo = (x, step) => {
    if (!step) return Math.round(x * 2) / 2;
    return Math.round(Math.round(x / step) * step * 100) / 100;
  };
  const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / DAY);
  const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0);

  function newState(program) {
    return {
      v: 1,
      program: JSON.parse(JSON.stringify(program)),
      exState: {},   // exId -> { w: peso di lavoro, fails: fallimenti consecutivi }
      ramp: 1,       // fattore di carico per il rientro graduale
      log: [],       // sedute palestra e cardio
      current: null, // allenamento in corso
      startDate: null,
      blockStart: null,
      lastExport: null
    };
  }

  const gymLogs = s => s.log.filter(l => l.type === 'gym');
  const lastGym = s => { const g = gymLogs(s); return g.length ? g[g.length - 1] : null; };

  function findExercise(s, exId) {
    for (const ses of s.program.sessions) for (const e of ses.exercises) if (e.id === exId) return e;
    return null;
  }

  // Cardio intenso nelle ultime 36 ore
  function recentIntenseCardio(s, now) {
    const t = new Date(now).getTime();
    return s.log.find(l => l.type === 'cardio' && l.intense && t - new Date(l.date).getTime() <= 36 * 3600000 && t >= new Date(l.date).getTime()) || null;
  }

  // Prossima seduta: quella fatta meno di recente (rotazione che non dipende dai giorni)
  function nextSession(s, now) {
    const lastDone = id => {
      const g = gymLogs(s).filter(l => l.sessionId === id);
      return g.length ? new Date(g[g.length - 1].date).getTime() : -Infinity;
    };
    const ordered = s.program.sessions
      .map((ses, i) => ({ ses, i, t: lastDone(ses.id) }))
      .sort((a, b) => a.t - b.t || a.i - b.i)
      .map(x => x.ses);
    const next = ordered[0] || null;
    let alt = null, reason = null;
    const cardio = recentIntenseCardio(s, now);
    if (next && next.legsHeavy && cardio) {
      alt = ordered.find(x => !x.legsHeavy) || null;
      if (alt) reason = 'Hai fatto cardio intenso da poco: le gambe sono affaticate.';
    }
    return { next, alt, reason };
  }

  // Fattore di carico in base ai giorni di pausa e al rientro graduale
  function loadFactor(s, now) {
    const last = lastGym(s);
    if (!last) return { factor: 1, gap: null, note: null };
    const gap = daysBetween(last.date, now);
    let gapF = 1, note = null;
    if (gap > 14) { gapF = 0.8; note = `Rientro dopo ${gap} giorni: −20% e una serie in meno sui fondamentali, sforzo moderato.`; }
    else if (gap >= 8) { gapF = 0.9; note = `Rientro dopo ${gap} giorni: −10% e una serie in meno sui fondamentali.`; }
    const factor = Math.min(gapF, s.ramp || 1);
    if (!note && factor < 1) note = `Rientro graduale: carichi al ${Math.round(factor * 100)}%.`;
    return { factor, gap, note };
  }

  function prescribe(s, session, now, opts = {}) {
    const { factor, gap, note } = loadFactor(s, now);
    const cardio = recentIntenseCardio(s, now);
    const legsTired = !!cardio || !!opts.cardioSoon;
    const items = session.exercises.map(e => {
      const st = s.exState[e.id] || {};
      let sets = e.sets;
      const notes = [];
      if (factor < 1 && e.kind === 'main') sets -= 1;
      if (legsTired && e.legs && e.mode !== 'time') {
        sets -= 1;
        notes.push(opts.cardioSoon && !cardio ? 'Cardio intenso in arrivo: una serie in meno.' : 'Gambe affaticate dal cardio: una serie in meno.');
      }
      sets = Math.max(2, Math.min(sets, e.sets));
      let w = null;
      if (e.mode === 'weight' && st.w != null) {
        w = Math.max(0, roundTo(st.w * factor, e.inc));
        if (st.fails === 1) notes.push('Ultima volta sotto il minimo: stesso carico, riprova.');
      }
      return { exId: e.id, sets, w, min: e.min, max: e.max, rest: e.rest, notes };
    });
    return { factor, gap, note, items };
  }

  function startWorkout(s, sessionId, now, opts = {}) {
    const session = s.program.sessions.find(x => x.id === sessionId);
    const p = prescribe(s, session, now, opts);
    s.current = {
      sessionId, startedAt: new Date(now).toISOString(), factor: p.factor, note: p.note,
      items: p.items.map(it => {
        const e = findExercise(s, it.exId);
        const target = e.mode === 'time' ? e.min : e.max;
        return Object.assign({}, it, {
          sets: Array.from({ length: it.sets }, () => ({ w: it.w, r: target, done: false })),
          planned: it.sets
        });
      }),
      timer: null
    };
    return s.current;
  }

  // Applica i risultati: aggiorna i carichi per la prossima volta
  function finishWorkout(s, now) {
    const cur = s.current;
    if (!cur) return null;
    const session = s.program.sessions.find(x => x.id === cur.sessionId);
    const changes = [];
    const entries = [];
    for (const it of cur.items) {
      const e = findExercise(s, it.exId);
      if (!e) continue;
      const done = it.sets.filter(x => x.done && x.r > 0);
      entries.push({ exId: e.id, name: e.name, sets: done.map(x => ({ w: x.w, r: x.r })) });
      if (!done.length || e.mode !== 'weight') {
        if (e.mode === 'time' && done.length && done.length >= it.planned && done.every(x => x.r >= e.max))
          changes.push({ exId: e.id, name: e.name, msg: `Tieni ${e.max}" con facilità: aggiungi un disco o passa a una variante più difficile.` });
        continue;
      }
      const st = s.exState[e.id] || { w: null, fails: 0 };
      const used = Math.max(...done.map(x => Number(x.w) || 0));
      const from = st.w;
      if (cur.factor < 1) {
        // Durante il rientro non si giudica la prestazione: si conserva il carico di riferimento
        if (st.w == null || used > st.w) st.w = used;
        changes.push({ exId: e.id, name: e.name, from, to: st.w, msg: 'Rientro: carico di riferimento invariato.' });
      } else {
        const enough = done.length >= it.planned;
        const allMax = enough && done.every(x => x.r >= e.max);
        const allMin = enough && done.every(x => x.r >= e.min);
        if (allMax) {
          st.w = roundTo(used + e.inc, e.inc); st.fails = 0;
          changes.push({ exId: e.id, name: e.name, from, to: st.w, msg: `Range completato: +${String(e.inc).replace('.', ',')} kg.`, up: true });
        } else if (allMin) {
          st.w = used; st.fails = 0;
          changes.push({ exId: e.id, name: e.name, from, to: st.w, msg: 'Nel range: stesso carico, punta al massimo delle ripetizioni.' });
        } else {
          st.fails = (st.fails || 0) + 1;
          if (st.fails >= 2) {
            st.w = Math.max(0, roundTo(used * 0.9, e.inc)); st.fails = 0;
            changes.push({ exId: e.id, name: e.name, from, to: st.w, msg: 'Due volte sotto il minimo: scarico −10% e si riparte.', down: true });
          } else {
            st.w = used;
            changes.push({ exId: e.id, name: e.name, from, to: st.w, msg: 'Sotto il minimo: stesso carico la prossima volta.' });
          }
        }
      }
      s.exState[e.id] = st;
    }
    s.ramp = Math.min(1, Math.round((cur.factor + 0.1) * 100) / 100);
    const date = new Date(now).toISOString();
    s.log.push({
      type: 'gym', id: 'g' + Date.now().toString(36), date, sessionId: cur.sessionId,
      sessionName: session ? session.name : cur.sessionId,
      minutes: Math.round((new Date(now) - new Date(cur.startedAt)) / 60000),
      factor: cur.factor, entries
    });
    if (!s.startDate) s.startDate = date;
    if (!s.blockStart) s.blockStart = date;
    s.current = null;
    return changes;
  }

  function addCardio(s, c) {
    const rec = Object.assign({ type: 'cardio', id: 'c' + Date.now().toString(36) }, c);
    rec.intense = !!(c.intense || (c.rpe && c.rpe >= 8));
    s.log.push(rec);
    s.log.sort((a, b) => new Date(a.date) - new Date(b.date));
    return rec;
  }

  // Cambio blocco: nuovi parametri e carichi riconvertiti sul nuovo range di ripetizioni
  function switchBlock(s, blockId, BLOCKS) {
    const b = BLOCKS[blockId];
    if (!b) return;
    for (const ses of s.program.sessions) for (const e of ses.exercises) {
      if (e.mode !== 'weight' || !b[e.kind]) continue;
      const [sets, min, max, rest] = b[e.kind];
      const oldMid = (e.min + e.max) / 2, newMid = (min + max) / 2;
      const st = s.exState[e.id];
      if (st && st.w > 0) st.w = roundTo(st.w * (1 + oldMid / 30) / (1 + newMid / 30), e.inc);
      Object.assign(e, { sets: e.legs && e.kind === 'sec' && b.legsSecSets ? b.legsSecSets : sets, min, max, rest });
    }
    s.program.block = blockId;
    s.blockStart = new Date().toISOString();
  }

  function weekSummary(s, now) {
    const t = new Date(now).getTime();
    const recent = s.log.filter(l => t - new Date(l.date).getTime() < 7 * DAY);
    return { gym: recent.filter(l => l.type === 'gym').length, cardio: recent.filter(l => l.type === 'cardio').length };
  }

  function blockWeeks(s, now) {
    if (!s.blockStart) return 0;
    return Math.floor(daysBetween(s.blockStart, now) / 7);
  }

  function exerciseHistory(s, exId) {
    return gymLogs(s).map(l => {
      const en = l.entries.find(x => x.exId === exId);
      if (!en || !en.sets.length) return null;
      const best = Math.max(...en.sets.map(x => e1rm(x.w, x.r)));
      const top = Math.max(...en.sets.map(x => x.w || 0));
      const reps = Math.max(...en.sets.map(x => x.r || 0));
      return { date: l.date, e1rm: Math.round(best * 10) / 10, top, reps, sets: en.sets };
    }).filter(Boolean);
  }

  function lastEntry(s, exId) {
    const h = exerciseHistory(s, exId);
    return h.length ? h[h.length - 1] : null;
  }

  root.GymLogic = {
    roundTo, daysBetween, e1rm, newState, nextSession, loadFactor, prescribe, startWorkout,
    finishWorkout, addCardio, switchBlock, weekSummary, blockWeeks, exerciseHistory, lastEntry,
    findExercise, recentIntenseCardio
  };
  if (typeof module !== 'undefined') module.exports = root.GymLogic;
})(typeof window !== 'undefined' ? window : globalThis);
