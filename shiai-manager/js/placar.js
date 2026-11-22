(function() {
  'use strict';

  var KEY = 'shiai-mesa-v2';
  var SID = Math.random().toString(36).slice(2);
  var PEN_DEFAULT = ['Chukoku', 'Keikoku', 'Hansoku-chui', 'Hansoku'];
  var MODS = { sanbon: { label: 'Shobu Sanbon', target: 6 }, nihon: { label: 'Shobu Nihon', target: 4 }, livre: { label: 'Kumite', target: 0 } };
  var SIDES = ['aka', 'ao'];
  var LABEL = { aka: 'AKA', ao: 'AO' };

  function other(s) {
    return s === 'aka' ? 'ao' : 'aka';
  }

  function $(s, r) {
    return (r || document).querySelector(s);
  }

  function $$(s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function abbr(n) {
    return String(n).split(/[-\s]+/).filter(Boolean).map(function(w) {
      return w[0];
    }).join('').toUpperCase();
  }

  function athlete(name) {
    return { name: name, score: 0, senshu: false, pen: [0, 0, 0] };
  }

  function newKumite(prev) {
    var p = prev || {};
    var dur = p.duration || 120000;

    return {
      category: p.category != null ? p.category : 'Kumite Adulto Masculino', modality: p.modality || 'sanbon', duration: dur,
      aka: athlete(''), ao: athlete(''),
      timer: { remaining: dur, running: false, startedAt: 0 }, winner: null, senshuGiven: false, warned: false, tie: false, lastEvent: null
    };
  }

  function newKata(prev) {
    var p = prev || {};

    return {
      category: p.category != null ? p.category : 'Kata Individual Masculino', judges: p.judges || 5, method: p.method || 'notas', format: p.format || 'simultanea', current: null,
      aka: { name: '', kata: '', scores: ['', '', '', '', '', '', ''] },
      ao: { name: '', kata: '', scores: ['', '', '', '', '', '', ''] },
      reveal: false, winner: null
    };
  }

  function fresh() {
    return {
      seq: 0, mode: 'kumite', event: 'Campeonato de Karatê',
      settings: { penalties: PEN_DEFAULT.slice(), cats: ['Jogai', 'Atenai', 'Comport.'], autoSenshu: true, sound: true, swap: false, warnSec: 15 },
      kumite: newKumite(), kata: newKata()
    };
  }

  function readStore() {
    try {
      var r = localStorage.getItem(KEY);

      if (!r) {
        return null;
      }

      var w = JSON.parse(r);

      if (!w || !w.s || !w.s.kumite || !w.s.kata || !w.s.settings) {
        return null;
      }

      return w;
    } catch (e) {
      return null;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ sid: SID, s: state }));
    } catch (e) { }
  }

  function newPause() {
    return { active: false, running: false, startedAt: 0, base: 0, mode: 'up', duration: 60000 };
  }

  function normalize(s) {
    if (!s.pause) {
      s.pause = newPause();
    }

    if (!s.kata.format) {
      s.kata.format = 'simultanea';
    }

    if (s.kata.current === undefined) {
      s.kata.current = null;
    }

    while (s.settings.cats.length < 3) {
      s.settings.cats.push(['Jogai', 'Atenai', 'Comport.'][s.settings.cats.length]);
    }

    SIDES.forEach(function(lado) {
      while (s.kumite[lado].pen.length < s.settings.cats.length) {
        s.kumite[lado].pen.push(0);
      }
    });

    return s;
  }

  var stored = readStore();
  var state = normalize(stored ? stored.s : fresh());
  var lastSid = stored ? stored.sid : null;
  var isDisplay = false;
  var displayWin = null;
  var undoStack = [];
  var shownFlash = state.kumite.lastEvent ? state.kumite.lastEvent.id : null;

  function rem(t) {
    return t.running ? Math.max(0, t.remaining - (Date.now() - t.startedAt)) : Math.max(0, t.remaining);
  }

  function fmt(ms) {
    var s = Math.ceil(ms / 1000);
    var m = Math.floor(s / 60);

    return m + ':' + String(s % 60).padStart(2, '0');
  }

  function parseDur(v) {
    v = String(v || '').trim();

    if (!v) {
      return null;
    }

    var m = v.match(/^(\d{1,2}):(\d{1,2})$/);

    if (m) {
      return (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) * 1000;
    }

    if (/^\d+$/.test(v)) {
      var n = parseInt(v, 10);

      return (n <= 10 ? n * 60 : n) * 1000;
    }

    return null;
  }

  function num(v) {
    if (v === '' || v == null) {
      return NaN;
    }

    return parseFloat(String(v).replace(',', '.'));
  }

  function fmtScore(v) {
    if (v == null || isNaN(v)) {
      return '—';
    }

    return Math.abs(v * 10 - Math.round(v * 10)) < 1e-6 ? v.toFixed(1) : v.toFixed(2);
  }

  var APP = window.placarApp || null;
  var ch = null;

  try {
    if (!APP && 'BroadcastChannel' in window) {
      ch = new BroadcastChannel('shiai-mesa');
    }
  } catch (e) { }

  function broadcast() {
    var msg = { t: 'state', sid: SID, s: state };

    try {
      if (APP) {
        APP.send(msg);
      }
    } catch (e) { }

    try {
      if (ch) {
        ch.postMessage(msg);
      }
    } catch (e) { }

    try {
      if (displayWin && !displayWin.closed) {
        displayWin.postMessage(msg, '*');
      }
    } catch (e) { }
  }

  function receive(m) {
    if (!m || m.t !== 'state' || !m.s || !m.s.kumite) {
      return;
    }

    if (m.sid === SID) {
      return;
    }

    if (m.sid === lastSid && m.s.seq <= state.seq) {
      return;
    }

    lastSid = m.sid;
    state = normalize(m.s);

    if (isDisplay) {
      renderDisplay();
    } else {
      renderControl();
    }
  }

  function onMsg(m, source) {
    if (!m) {
      return;
    }

    if (m.t === 'hello') {
      if (!isDisplay) {
        if (source) {
          displayWin = source;
        }

        broadcast();
      }

      return;
    }

    receive(m);
  }

  if (ch) {
    ch.onmessage = function(e) {
      onMsg(e.data, null);
    };
  }

  if (APP) {
    APP.onMessage(function(m) {
      onMsg(m, null);
    });
  }

  window.addEventListener('message', function(e) {
    if (e.data && typeof e.data === 'object' && (e.data.t === 'state' || e.data.t === 'hello')) {
      onMsg(e.data, e.source);
    }
  });

  window.addEventListener('storage', function(e) {
    if (e.key !== KEY || !e.newValue) {
      return;
    }

    try {
      var w = JSON.parse(e.newValue);

      receive({ t: 'state', sid: w.sid, s: w.s });
    } catch (err) { }
  });

  function hello() {
    try {
      if (APP) {
        APP.send({ t: 'hello' });
      }
    } catch (e) { }

    try {
      if (ch) {
        ch.postMessage({ t: 'hello' });
      }
    } catch (e) { }

    try {
      if (window.opener) {
        window.opener.postMessage({ t: 'hello' }, '*');
      }
    } catch (e) { }
  }

  var ouvintes = [];

  function avisar() {
    ouvintes.forEach(function(cb) {
      try {
        cb(state);
      } catch (e) {
        if (window.console) {
          console.error(e);
        }
      }
    });
  }

  function commit() {
    state.seq++;
    save();
    broadcast();

    if (isDisplay) {
      renderDisplay();
    } else {
      renderControl();
      avisar();
    }
  }

  function snap() {
    undoStack.push(JSON.stringify(state));

    if (undoStack.length > 100) {
      undoStack.shift();
    }
  }

  function swapLabelText(s) {
    return s == null ? s : String(s).replace(/\b(AKA|AO)\b/g, function(m) {
      return m === 'AKA' ? 'AO' : 'AKA';
    });
  }

  function swapColors(mode) {
    snap();

    var k = state[mode], tmp = k.aka;

    k.aka = k.ao;
    k.ao = tmp;

    if (k.winner && k.winner.side) {
      k.winner.side = other(k.winner.side);
      k.winner.text = swapLabelText(k.winner.text);
    }

    if (mode === 'kumite' && k.lastEvent && k.lastEvent.side) {
      k.lastEvent.side = other(k.lastEvent.side);
    }

    if (mode === 'kata') {
      if (k.current) {
        k.current = other(k.current);
      }

      var c = kataCustom.aka;

      kataCustom.aka = kataCustom.ao;
      kataCustom.ao = c;
    }

    commit();
  }

  function doUndo() {
    var r = undoStack.pop();

    if (!r) {
      return;
    }

    var s = JSON.parse(r);

    s.kumite.timer = state.kumite.timer;
    s.kumite.warned = state.kumite.warned;
    s.kumite.lastEvent = state.kumite.lastEvent;
    s.pause = state.pause;
    s.seq = state.seq;
    state = s;
    commit();
  }

  var actx = null;

  function unlockAudio() {
    try {
      if (!actx) {
        var C = window.AudioContext || window.webkitAudioContext;

        if (C) {
          actx = new C();
        }
      }

      if (actx && actx.state === 'suspended') {
        actx.resume();
      }
    } catch (e) { }
  }

  function tone(f, dur, type, at, vol) {
    var o = actx.createOscillator(), g = actx.createGain();

    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.setValueAtTime(vol, at + dur - 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  function sound(kind) {
    if (!state.settings.sound || !actx) {
      return;
    }

    try {
      var n = actx.currentTime;

      if (kind === 'warn') {
        tone(880, .16, 'square', n, .25);
        tone(880, .16, 'square', n + .28, .25);
      } else {
        tone(220, 1.5, 'sawtooth', n, .3);
        tone(165, 1.5, 'sawtooth', n, .3);
      }
    } catch (e) { }
  }

  function kTarget() {
    var m = MODS[state.kumite.modality];

    return m ? m.target : 0;
  }

  function stopClock() {
    var t = state.kumite.timer;

    if (t.running) {
      t.remaining = rem(t);
      t.running = false;
    }
  }

  function setWin(side, type, text) {
    state.kumite.winner = { side: side, type: type, text: text };
    stopClock();
  }

  function evalAuto() {
    var k = state.kumite, t = kTarget(), P = state.settings.penalties.length;

    if (k.winner && (k.winner.type === 'target' || k.winner.type === 'hansoku')) {
      k.winner = null;
    }

    if (k.winner) {
      return;
    }

    for (var i = 0; i < 2; i++) {
      var s = SIDES[i];

      if (k[s].pen.some(function(v) {
        return v >= P;
      })) {
        setWin(other(s), 'hansoku', state.settings.penalties[P - 1] + ' de ' + LABEL[s]);
        return;
      }
    }

    if (t) {
      for (var j = 0; j < 2; j++) {
        var s2 = SIDES[j];

        if (k[s2].score >= t) {
          setWin(s2, 'target', t + ' pontos');
          return;
        }
      }
    }
  }

  function addPoints(side, v) {
    var k = state.kumite;

    if (k.winner && v > 0) {
      return;
    }

    if (v < 0 && k[side].score === 0) {
      return;
    }

    snap();

    var s = k[side];

    if (v > 0 && state.settings.autoSenshu && !k.senshuGiven && k.aka.score === 0 && k.ao.score === 0) {
      s.senshu = true;
      k.senshuGiven = true;
    }

    s.score = Math.max(0, s.score + v);

    if (v > 0) {
      k.lastEvent = { id: Math.random().toString(36).slice(2), side: side, v: v, t: Date.now() };
    }

    evalAuto();
    commit();
  }

  function setPenalty(side, c, level) {
    var k = state.kumite, P = state.settings.penalties.length;

    snap();

    var cur = k[side].pen[c];

    k[side].pen[c] = Math.min(P, Math.max(0, cur === level ? level - 1 : level));
    evalAuto();
    commit();
  }

  function toggleSenshu(side) {
    var k = state.kumite;

    snap();

    var on = !k[side].senshu;

    k[side].senshu = on;

    if (on) {
      k[other(side)].senshu = false;
      k.senshuGiven = true;
    }

    commit();
  }

  function timeUp() {
    var k = state.kumite;

    k.timer.running = false;
    k.timer.remaining = 0;

    if (k.winner) {
      return;
    }

    var a = k.aka.score, b = k.ao.score;

    if (a !== b) {
      setWin(a > b ? 'aka' : 'ao', 'time', 'Mais pontos no fim do tempo');
    } else if (k.aka.senshu || k.ao.senshu) {
      setWin(k.aka.senshu ? 'aka' : 'ao', 'senshu', 'Empate decidido pelo senshu');
    } else {
      k.tie = true;
    }
  }

  function toggleTimer() {
    var t = state.kumite.timer;

    unlockAudio();

    if (t.running) {
      t.remaining = rem(t);
      t.running = false;
    } else {
      if (t.remaining <= 0 || state.kumite.winner) {
        return;
      }

      t.startedAt = Date.now();
      t.running = true;
    }

    commit();
  }

  function adjTime(d) {
    var t = state.kumite.timer, r = rem(t) + d;

    r = Math.max(0, Math.min(r, 59 * 60000));
    t.remaining = r;

    if (t.running) {
      t.startedAt = Date.now();
    }

    if (r > state.settings.warnSec * 1000) {
      state.kumite.warned = false;
    }

    if (r > 0) {
      state.kumite.tie = false;
    }

    commit();
  }

  function resetTime() {
    var k = state.kumite;

    k.timer = { remaining: k.duration, running: false, startedAt: 0 };
    k.warned = false;
    k.tie = false;
    commit();
  }

  function kataCalc(a, n) {
    var vals = a.scores.slice(0, n).map(num);

    var complete = vals.every(function(v) {
      return !isNaN(v);
    });

    if (!complete || n < 3) {
      return {
        complete: complete && n > 0, vals: vals, total: complete ? vals.reduce(function(s, v) {
          return s + v;
        }, 0) : null, hi: -1, lo: -1
      };
    }

    var hi = 0, lo = 0;

    vals.forEach(function(v, i) {
      if (v > vals[hi]) {
        hi = i;
      }

      if (v < vals[lo]) {
        lo = i;
      }
    });

    if (hi === lo) {
      lo = (hi === 0 ? 1 : 0);
    }

    var total = vals.reduce(function(s, v, i) {
      return (i === hi || i === lo) ? s : s + v;
    }, 0);

    return { complete: true, vals: vals, total: Math.round(total * 100) / 100, hi: hi, lo: lo, hiV: vals[hi], loV: vals[lo] };
  }

  function kataLeader() {
    var k = state.kata, a = kataCalc(k.aka, k.judges), b = kataCalc(k.ao, k.judges);

    if (!a.complete || !b.complete) {
      return null;
    }

    if (a.total !== b.total) {
      return a.total > b.total ? 'aka' : 'ao';
    }

    if (a.loV !== b.loV) {
      return a.loV > b.loV ? 'aka' : 'ao';
    }

    if (a.hiV !== b.hiV) {
      return a.hiV > b.hiV ? 'aka' : 'ao';
    }

    return 'tie';
  }

  function buildKumiteSides() {
    $('#kSides').innerHTML = SIDES.map(function(s) {
      return '<div class="side ' + s + '" data-side="' + s + '">' +
        '<div class="side-head"><span class="tag">' + LABEL[s] + '</span><input data-f="name" id="kName-' + s + '" type="text" placeholder="Nome do atleta" aria-label="Nome do atleta ' + LABEL[s] + '"></div>' +
        '<div class="score-row"><div class="score-big" data-out="score">0</div>' +
        '<div class="score-btns">' +
        '<button type="button" class="btn-pt" data-act="pt" data-v="1"><b>Wazari</b><small>+1 ponto</small></button>' +
        '<button type="button" class="btn-pt" data-act="pt" data-v="2"><b>Ippon</b><small>+2 pontos</small></button>' +
        '<button type="button" class="btn-fix" data-act="pt" data-v="-1">Corrigir: tirar 1 ponto</button>' +
        '</div></div>' +
        '<button type="button" class="senshu-btn" data-act="senshu" aria-pressed="false">Senshu</button>' +
        '<div class="sub">Penalidades · clique para marcar ou desmarcar</div>' +
        '<div data-out="pens" style="display:grid;gap:6px"></div>' +
        '<button type="button" class="win-btn" data-act="win" aria-pressed="false">' + LABEL[s] + ' venceu</button>' +
        '</div>';
    }).join('');
  }

  var KATAS = [
    ['Shitei', ['Heian Shodan', 'Heian Nidan', 'Heian Sandan', 'Heian Yondan', 'Heian Godan', 'Tekki Shodan']],
    ['Sentei', ['Jion', 'Empi', 'Bassai Dai', 'Kanku Dai', 'Hangetsu']],
    ['Tokui', ['Tekki Nidan', 'Tekki Sandan', 'Jitte', 'Gankaku', 'Bassai Sho', 'Kanku Sho', 'Chinte', 'Sochin', 'Nijushiho', 'Meikyo', 'Jiin', 'Wankan', 'Unsu', 'Gojushiho Sho', 'Gojushiho Dai']]
  ];

  var KATA_ALL = [];

  KATAS.forEach(function(g) {
    KATA_ALL = KATA_ALL.concat(g[1]);
  });

  var KATA_OPTIONS = '<option value="">Escolha o kata…</option>' + KATAS.map(function(g) {
    return '<optgroup label="' + g[0] + '">' + g[1].map(function(n) {
      return '<option value="' + n + '">' + n + '</option>';
    }).join('') + '</optgroup>';
  }).join('') + '<option value="__outro">Outro (digitar o nome)</option>';

  var kataCustom = { aka: false, ao: false };
  var kataKey = '';

  function buildKataSides() {
    if (kataKey) {
      return;
    }

    kataKey = 'x';

    $('#tSides').innerHTML = SIDES.map(function(s) {
      return '<div class="side ' + s + '" data-side="' + s + '">' +
        '<div class="side-head"><span class="tag">' + LABEL[s] + '</span><input data-f="name" id="tName-' + s + '" type="text" placeholder="Nome do atleta" aria-label="Nome do atleta ' + LABEL[s] + '"></div>' +
        '<label class="field">Kata apresentado<select data-f="katasel" id="tKataSel-' + s + '">' + KATA_OPTIONS + '</select></label>' +
        '<input data-f="kata" id="tKata-' + s + '" type="text" placeholder="Digite o nome do kata" aria-label="Nome do kata de ' + LABEL[s] + '" hidden>' +
        '<button type="button" class="turn-btn" data-turn="' + s + '" aria-pressed="false">Mostrar ' + LABEL[s] + ' apresentando</button>' +
        '<button type="button" class="win-btn" data-win="' + s + '" aria-pressed="false">' + LABEL[s] + ' venceu</button>' +
        '</div>';
    }).join('');
  }

  function setVal(el, v) {
    if (!el) {
      return;
    }

    v = v == null ? '' : String(v);

    if (document.activeElement !== el && el.value !== v) {
      el.value = v;
    }
  }

  function renderControl() {
    var st = state, k = st.kumite, P = st.settings.penalties.length;

    $$('.seg button').forEach(function(b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === st.mode));
    });

    $('#kumitePanel').hidden = st.mode !== 'kumite';
    $('#kataPanel').hidden = st.mode !== 'kata';
    setVal($('#evName'), st.event);
    setVal($('#evName2'), st.event);
    setVal($('#kCat'), k.category);
    setVal($('#kMod'), k.modality);
    setVal($('#kDur'), fmt(k.duration));

    SIDES.forEach(function(s) {
      var box = $('#kSides [data-side="' + s + '"]'), a = k[s];

      setVal($('input[data-f="name"]', box), a.name);
      $('[data-out="score"]', box).textContent = a.score;
      $('.senshu-btn', box).setAttribute('aria-pressed', String(!!a.senshu));
      $('.win-btn', box).setAttribute('aria-pressed', String(!!(k.winner && k.winner.side === s)));

      $('[data-out="pens"]', box).innerHTML = st.settings.cats.map(function(_, c) {
        return '<div class="pen"><span class="pc">' + esc(st.settings.cats[c]) + '</span><div class="cells" style="--n:' + P + '">' +
          st.settings.penalties.map(function(n, i) {
            return '<button type="button" class="cell' + (i < a.pen[c] ? ' on' : '') + (i === P - 1 ? ' last' : '') + '" data-act="pen" data-c="' + c + '" data-l="' + (i + 1) + '" title="' + esc(n) + '">' + esc(n) + '</button>';
          }).join('') +
          '</div></div>';
      }).join('');
    });

    var w = k.winner, stEl = $('#kStatus');

    if (w) {
      stEl.textContent = w.side ? ('Vencedor na tela: ' + LABEL[w.side] + (k[w.side].name ? ' · ' + k[w.side].name : '') + ' (' + w.text + ')') : w.text;
      stEl.className = 'status' + (w.side ? ' win-' + w.side : '');
    } else if (k.tie) {
      stEl.textContent = 'Empate sem senshu. Escolha quem venceu ou marque Hikiwake.';
      stEl.className = 'status warn';
    } else {
      stEl.textContent = k.timer.running ? 'Luta em andamento' : (k.timer.remaining < k.duration ? 'Luta parada' : 'Pronto para começar');
      stEl.className = 'status';
    }

    var sb = $('#tStart');

    sb.textContent = k.timer.running ? '❚❚ Pausar' : '▶ Iniciar';
    sb.classList.toggle('running', k.timer.running);
    tickControl();

    var pz = state.pause;

    setVal($('#pMode'), pz.mode);
    setVal($('#pDur'), fmt(pz.duration));
    $('#pDurWrap').hidden = pz.mode !== 'down';

    var ps = $('#pStart');

    ps.textContent = !pz.active ? '▶ Iniciar pausa' : (pz.running ? '❚❚ Pausar' : '▶ Continuar');
    ps.classList.toggle('running', pz.active && pz.running);
    $('#pEnd').disabled = !pz.active;

    var pc = $('#pauseCard');

    pc.classList.toggle('on', !!pz.active);

    if (pz.active) {
      pc.open = true;
    }

    tickPause();

    var t = st.kata;

    buildKataSides();

    var indiv = t.format === 'individual';

    setVal($('#tCat'), t.category);
    setVal($('#tMethod'), t.method || 'notas');
    setVal($('#tFormat'), t.format || 'simultanea');

    SIDES.forEach(function(s) {
      var box = $('#tSides [data-side="' + s + '"]'), a = t[s];

      setVal($('input[data-f="name"]', box), a.name);

      var known = KATA_ALL.indexOf(a.kata) > -1, custom = kataCustom[s] || (!!a.kata && !known);

      setVal($('select[data-f="katasel"]', box), custom ? '__outro' : (known ? a.kata : ''));

      var ki = $('input[data-f="kata"]', box);

      ki.hidden = !custom;
      setVal(ki, a.kata);

      var tb = $('.turn-btn', box);

      tb.hidden = !indiv;
      tb.setAttribute('aria-pressed', String(t.current === s));
      tb.textContent = t.current === s ? '● ' + LABEL[s] + ' está na tela' : 'Mostrar ' + LABEL[s] + ' apresentando';
      $('.win-btn', box).setAttribute('aria-pressed', String(t.winner === s));
    });

    var ts = $('#tStatus');

    if (t.winner) {
      ts.textContent = 'Vencedor na tela: ' + LABEL[t.winner] + (t[t.winner].name ? ' · ' + t[t.winner].name : '');
      ts.className = 'status win-' + t.winner;
    } else if (indiv && t.current) {
      ts.textContent = 'Na tela: ' + LABEL[t.current] + (t[t.current].name ? ' · ' + t[t.current].name : '') + ' apresentando';
      ts.className = 'status win-' + t.current;
    } else if (indiv) {
      ts.textContent = 'Escolha quem está apresentando';
      ts.className = 'status';
    } else {
      ts.textContent = 'Aguardando a decisão (' + ((t.method || 'notas') === 'notas' ? 'notas' : 'bandeiras') + ')';
      ts.className = 'status';
    }

    setVal($('#sPen'), st.settings.penalties.join(', '));
    setVal($('#sCat1'), st.settings.cats[0]);
    setVal($('#sCat2'), st.settings.cats[1]);
    setVal($('#sCat3'), st.settings.cats[2]);
    setVal($('#sWarn'), st.settings.warnSec);
    $('#sSenshu').checked = !!st.settings.autoSenshu;
    $('#sSound').checked = !!st.settings.sound;
    $('#sSwap').checked = !!st.settings.swap;
  }

  function pElapsed(p) {
    return (p.base || 0) + (p.running ? Date.now() - p.startedAt : 0);
  }

  function pShown(p) {
    var e = pElapsed(p);

    return p.mode === 'down' ? Math.max(0, p.duration - e) : e;
  }

  function fmtPause(p) {
    var ms = pShown(p), s = p.mode === 'down' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');

    return h ? h + ':' + String(m).padStart(2, '0') + ':' + ss : m + ':' + ss;
  }

  function tickPause() {
    var el = $('#pTime');

    if (!el) {
      return;
    }

    var p = state.pause, txt = fmtPause(p);

    if (el.textContent !== txt) {
      el.textContent = txt;
    }

    el.classList.toggle('zero', p.active && p.mode === 'down' && pShown(p) === 0);
  }

  function tickControl() {
    var k = state.kumite, r = rem(k.timer), el = $('#cTime');

    el.textContent = fmt(r);
    el.classList.toggle('warn', r > 0 && r <= state.settings.warnSec * 1000);
    el.classList.toggle('zero', r === 0);
  }

  function winnerScreen(side, name) {
    return '<div class="winner-screen ' + side + '"><span class="ws-label">VENCEDOR</span><span class="ws-name">' + (esc(name) || LABEL[side]) + '</span><span class="ws-side">' + LABEL[side] + '</span></div>';
  }

  function renderDisplay() {
    var st = state, order = st.settings.swap ? ['ao', 'aka'] : ['aka', 'ao'], html = '';

    if (st.mode === 'kumite') {
      var k = st.kumite, m = MODS[k.modality] || MODS.sanbon, P = st.settings.penalties.length, w = k.winner;

      if (st.pause && st.pause.active) {
        html = '<div class="pause-screen"><span class="pause-time" id="dPause">' + fmtPause(st.pause) + '</span></div>';
      } else if (w && w.side) {
        html = winnerScreen(w.side, k[w.side].name);
      } else {
        html += '<header class="d-head"><span>' + esc(st.event) + '</span><span class="d-cat">' + esc(k.category) + '</span><span class="mod">' + esc(m.label) + (m.target ? ' · ' + m.target + ' pts' : '') + '</span></header>';
        html += '<div class="d-clock"><div></div><div class="d-timer" id="dTimer">' + fmt(rem(k.timer)) + '</div><div class="d-msg right" id="dMsg"></div></div>';

        html += '<main class="d-main">' + order.map(function(s) {
          var a = k[s];

          return '<section class="half ' + s + '">' +
            '<div class="h-top"><div class="h-id"><span class="h-label">' + LABEL[s] + '</span><span class="h-name">' + (esc(a.name) || '&nbsp;') + '</span></div>' + (a.senshu ? '<span class="senshu">SENSHU</span>' : '') + '</div>' +
            '<div class="h-center"><span class="h-score">' + a.score + '</span></div>' +
            '<div class="h-pen">' + st.settings.cats.map(function(_, c) {
              return '<div class="pr"><span class="pc">' + esc(st.settings.cats[c]) + '</span><div class="cells" style="--n:' + P + '">' +
                st.settings.penalties.map(function(n, i) {
                  return '<span class="pcell' + (i < a.pen[c] ? ' on' : '') + (i === P - 1 ? ' last' : '') + '">' + esc(abbr(n)) + '</span>';
                }).join('') + '</div></div>';
            }).join('') + '</div>' +
            '</section>';
        }).join('') + '</main>';
      }
    } else {
      var t = st.kata;

      if (t.winner) {
        html = winnerScreen(t.winner, t[t.winner].name);
      } else if (t.format === 'individual' && t.current) {
        var c = t.current;

        html = '<div class="winner-screen ' + c + '"><span class="ws-side">' + LABEL[c] + '</span><span class="ws-name">' + (esc(t[c].name) || LABEL[c]) + '</span><span class="ws-kata">' + esc(t[c].kata) + '</span></div>';
      } else {
        var sys = (t.method || 'notas') === 'notas' ? 'Notas' : 'Bandeiras';

        html += '<header class="d-head"><span>' + esc(st.event) + '</span><span class="d-cat">' + esc(t.category) + '</span><span class="mod">Kata · ' + sys + '</span></header>';

        html += '<main class="d-main">' + order.map(function(s) {
          var a = t[s];

          return '<section class="half ' + s + '">' +
            '<div class="h-top"><div class="h-id"><span class="h-label">' + LABEL[s] + '</span><span class="h-name">' + (esc(a.name) || '&nbsp;') + '</span></div></div>' +
            '<div class="h-center"><span class="h-kata">' + esc(a.kata) + '</span></div><div></div>' +
            '</section>';
        }).join('') + '</main>';

        html += '<footer class="d-foot"><div class="d-msg left">Kata</div><div class="d-system">' + sys.toUpperCase() + '</div><div></div></footer>';
      }
    }

    $('#dBoard').innerHTML = html;
    displayTick();

    if (html.indexOf('winner-screen') > -1 || html.indexOf('pause-screen') > -1 || st.mode !== 'kumite') {
      var ev = state.kumite.lastEvent;

      if (ev) {
        shownFlash = ev.id;
      }

      clearTimeout(flashT);

      var fl = $('#dFlash');

      fl.hidden = true;
      fl.classList.remove('show');
    } else {
      maybeFlash();
    }
  }

  var flashT = null;

  function maybeFlash() {
    if (state.mode !== 'kumite') {
      return;
    }

    var ev = state.kumite.lastEvent;

    if (!ev || ev.id === shownFlash) {
      return;
    }

    shownFlash = ev.id;

    if (Date.now() - ev.t > 2400) {
      return;
    }

    var el = $('#dFlash'), nm = state.kumite[ev.side].name;

    el.className = 'flash ' + ev.side;
    el.innerHTML = '<small>' + LABEL[ev.side] + (nm ? ' · ' + esc(nm) : '') + '</small><b>' + (ev.v === 2 ? 'IPPON' : 'WAZARI') + '</b><span>+' + ev.v + '</span>';
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(flashT);

    flashT = setTimeout(function() {
      el.hidden = true;
      el.classList.remove('show');
    }, 2400);
  }

  function displayTick() {
    if (!isDisplay || state.mode !== 'kumite') {
      return;
    }

    var dp = document.getElementById('dPause');

    if (dp && state.pause) {
      var pt = fmtPause(state.pause);

      if (dp.textContent !== pt) {
        dp.textContent = pt;
      }

      dp.classList.toggle('zero', state.pause.mode === 'down' && pShown(state.pause) === 0);
      return;
    }

    var el = document.getElementById('dTimer');

    if (!el) {
      return;
    }

    var k = state.kumite, r = rem(k.timer), txt = fmt(r);

    if (el.textContent !== txt) {
      el.textContent = txt;
    }

    var warn = r > 0 && r <= state.settings.warnSec * 1000;

    el.classList.toggle('warn', warn);
    el.classList.toggle('zero', r === 0);

    var msg = '';

    if (k.winner && !k.winner.side) {
      msg = 'Hikiwake';
    } else if (k.tie && !k.winner) {
      msg = 'Empate';
    } else if (warn && !k.winner) {
      msg = 'Atoshi baraku';
    }

    var m = document.getElementById('dMsg');

    if (m && m.textContent !== msg) {
      m.textContent = msg;
    }
  }

  function loop() {
    displayTick();
    requestAnimationFrame(loop);
  }

  var wakeLock = null;

  function setView() {
    isDisplay = location.hash === '#placar';
    $('#control').hidden = isDisplay;
    $('#display').hidden = !isDisplay;
    document.body.classList.toggle('is-display', isDisplay);

    if (isDisplay) {
      renderDisplay();
      hello();

      try {
        if (navigator.wakeLock) {
          navigator.wakeLock.request('screen').then(function(l) {
            wakeLock = l;
          }).catch(function() { });
        }
      } catch (e) { }
    } else {
      if (wakeLock) {
        try {
          wakeLock.release();
        } catch (e) { }

        wakeLock = null;
      }

      renderControl();
    }
  }

  function fullscreen() {
    if (APP) {
      APP.toggleFullscreen();
      return;
    }

    try {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        var p = document.documentElement.requestFullscreen();

        if (p && p.catch) {
          p.catch(function() { });
        }
      }
    } catch (e) { }
  }

  var UIKEY = 'placar-karate-tema';

  function applyTheme(t) {
    document.body.classList.toggle('light-ui', t === 'light');

    var b = $('#btnTheme');

    if (b) {
      b.textContent = t === 'light' ? '☾ Tema escuro' : '☀ Tema claro';
    }
  }

  function initTheme() {
    var t = null;

    try {
      t = localStorage.getItem(UIKEY);
    } catch (e) { }

    if (t !== 'light' && t !== 'dark') {
      try {
        t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      } catch (e) {
        t = 'dark';
      }
    }

    applyTheme(t);

    $('#btnTheme').addEventListener('click', function() {
      var n = document.body.classList.contains('light-ui') ? 'dark' : 'light';

      applyTheme(n);

      try {
        localStorage.setItem(UIKEY, n);
      } catch (e) { }
    });
  }

  function bind() {
    buildKumiteSides();
    initTheme();
    document.addEventListener('pointerdown', unlockAudio);

    $$('.seg button').forEach(function(b) {
      b.addEventListener('click', function() {
        state.mode = b.dataset.mode;
        commit();
      });
    });

    if (APP) {
      $('#btnHere').hidden = true;
      $('#dBack').hidden = true;
      $('#openHint').textContent = 'Ligue a TV ou o projetor no computador (cabo HDMI) e clique em “Abrir placar da TV”. O placar abre na TV em tela cheia. Sem TV ligada, ele abre numa janela neste computador.';
    }

    $('#btnOpen').addEventListener('click', function() {
      if (APP) {
        APP.openDisplay();
        return;
      }

      var url = location.href.split('#')[0] + '#placar', w = null;

      try {
        w = window.open(url, 'shiai-mesa-tv');
      } catch (e) { }

      var h = $('#openHint');

      if (w) {
        displayWin = w;
        h.classList.remove('alert');
        setTimeout(broadcast, 400);
      } else {
        h.classList.add('alert');
        h.textContent = 'O navegador não abriu a janela. Abra este mesmo endereço em outra aba ou janela e clique em “Usar esta aba como placar”. As duas abas ficam sincronizadas.';
      }
    });

    $('#btnHere').addEventListener('click', function() {
      location.hash = 'placar';
    });

    $('#btnUndo').addEventListener('click', doUndo);

    $('#dBack').addEventListener('click', function() {
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch (e) {
        location.hash = '';
      }

      setView();
    });

    $('#dFs').addEventListener('click', fullscreen);
    window.addEventListener('hashchange', setView);

    function onEvent(v) {
      state.event = v;
      commit();
    }

    $('#evName').addEventListener('input', function(e) {
      onEvent(e.target.value);
    });

    $('#evName2').addEventListener('input', function(e) {
      onEvent(e.target.value);
    });

    $('#kCat').addEventListener('input', function(e) {
      state.kumite.category = e.target.value;
      commit();
    });

    $('#kMod').addEventListener('change', function(e) {
      snap();
      state.kumite.modality = e.target.value;
      evalAuto();
      commit();
    });

    $('#kDur').addEventListener('change', function(e) {
      var ms = parseDur(e.target.value), k = state.kumite;

      if (ms && ms > 0) {
        k.duration = ms;

        if (!k.timer.running) {
          k.timer.remaining = ms;
          k.warned = false;
          k.tie = false;
        }
      }

      e.target.value = fmt(k.duration);
      commit();
    });

    $('#tStart').addEventListener('click', toggleTimer);

    $('#tMinus').addEventListener('click', function() {
      adjTime(-1000);
    });

    $('#tPlus').addEventListener('click', function() {
      adjTime(1000);
    });

    $('#tReset').addEventListener('click', resetTime);

    $('#kSides').addEventListener('click', function(e) {
      var b = e.target.closest('button[data-act]');

      if (!b) {
        return;
      }

      var side = b.closest('[data-side]').dataset.side, a = b.dataset.act, k = state.kumite;

      if (a === 'pt') {
        addPoints(side, +b.dataset.v);
      } else if (a === 'senshu') {
        toggleSenshu(side);
      } else if (a === 'pen') {
        setPenalty(side, +b.dataset.c, +b.dataset.l);
      } else if (a === 'win') {
        snap();

        if (k.winner && k.winner.side === side) {
          k.winner = null;
        } else {
          setWin(side, 'manual', 'Decisão dos juízes');
          k.tie = false;
        }

        commit();
      }
    });

    $('#kSides').addEventListener('input', function(e) {
      var i = e.target.closest('input[data-f="name"]');

      if (!i) {
        return;
      }

      state.kumite[i.closest('[data-side]').dataset.side].name = i.value;
      commit();
    });

    $('#kSwapSides').addEventListener('click', function() {
      swapColors('kumite');
    });

    $('#tSwapSides').addEventListener('click', function() {
      swapColors('kata');
    });

    $('#kHiki').addEventListener('click', function() {
      snap();
      stopClock();
      state.kumite.winner = { side: null, type: 'hikiwake', text: 'Empate (Hikiwake)' };
      state.kumite.tie = false;
      commit();
    });

    $('#kClear').addEventListener('click', function() {
      snap();
      state.kumite.winner = null;
      state.kumite.tie = false;
      commit();
    });

    $('#kNew').addEventListener('click', function() {
      snap();
      state.kumite = newKumite(state.kumite);
      commit();

      var n = $('#kName-aka');

      if (n) {
        n.focus();
      }
    });

    $('#tCat').addEventListener('input', function(e) {
      state.kata.category = e.target.value;
      commit();
    });

    $('#tMethod').addEventListener('change', function(e) {
      state.kata.method = e.target.value;
      commit();
    });

    $('#tFormat').addEventListener('change', function(e) {
      state.kata.format = e.target.value;

      if (e.target.value !== 'individual') {
        state.kata.current = null;
      }

      commit();
    });

    $('#tSides').addEventListener('input', function(e) {
      var box = e.target.closest('[data-side]');

      if (!box) {
        return;
      }

      var s = box.dataset.side, a = state.kata[s], f = e.target.dataset.f;

      if (f === 'katasel') {
        return;
      }

      if (f) {
        a[f] = e.target.value;
      }

      commit();
    });

    $('#tSides').addEventListener('change', function(e) {
      if (e.target.dataset.f !== 'katasel') {
        return;
      }

      var s = e.target.closest('[data-side]').dataset.side, a = state.kata[s], v = e.target.value;

      if (v === '__outro') {
        kataCustom[s] = true;

        if (KATA_ALL.indexOf(a.kata) > -1) {
          a.kata = '';
        }

        commit();

        var ki = $('#tKata-' + s);

        if (ki) {
          ki.focus();
        }

        return;
      }

      kataCustom[s] = false;
      a.kata = v;
      commit();
    });

    $('#tSides').addEventListener('click', function(e) {
      var tb = e.target.closest('button[data-turn]');

      if (tb) {
        var ts = tb.dataset.turn;

        state.kata.winner = null;
        state.kata.current = state.kata.current === ts ? null : ts;
        commit();
        return;
      }

      var b = e.target.closest('button[data-win]');

      if (!b) {
        return;
      }

      var s = b.dataset.win;

      snap();
      state.kata.winner = state.kata.winner === s ? null : s;
      commit();
    });

    $('#tClear').addEventListener('click', function() {
      snap();
      state.kata.winner = null;
      commit();
    });

    $('#tNew').addEventListener('click', function() {
      snap();
      state.kata = newKata(state.kata);
      kataCustom = { aka: false, ao: false };
      commit();
    });

    $('#pMode').addEventListener('change', function(e) {
      var p = state.pause;

      p.mode = e.target.value;
      commit();
    });

    $('#pDur').addEventListener('change', function(e) {
      var ms = parseDur(e.target.value);

      if (ms && ms > 0) {
        state.pause.duration = ms;
      }

      e.target.value = fmt(state.pause.duration);
      commit();
    });

    $('#pStart').addEventListener('click', function() {
      var p = state.pause;

      unlockAudio();

      if (!p.active) {
        p.active = true;
        p.base = 0;
        p.running = true;
        p.startedAt = Date.now();
        stopClock();
      } else if (p.running) {
        p.base = pElapsed(p);
        p.running = false;
      } else {
        if (p.mode === 'down' && pShown(p) <= 0) {
          p.base = 0;
        }

        p.running = true;
        p.startedAt = Date.now();
      }

      commit();
    });

    $('#pReset').addEventListener('click', function() {
      var p = state.pause;

      p.base = 0;
      p.startedAt = Date.now();
      commit();
    });

    $('#pEnd').addEventListener('click', function() {
      var p = state.pause;

      p.active = false;
      p.running = false;
      p.base = 0;
      commit();
    });

    $('#sPen').addEventListener('change', function(e) {
      var list = e.target.value.split(',').map(function(x) {
        return x.trim();
      }).filter(Boolean);

      if (list.length) {
        snap();
        state.settings.penalties = list;

        var P = list.length;

        SIDES.forEach(function(s) {
          state.kumite[s].pen = state.kumite[s].pen.map(function(v) {
            return Math.min(v, P);
          });
        });

        evalAuto();
      }

      commit();
    });

    $('#sCat1').addEventListener('input', function(e) {
      state.settings.cats[0] = e.target.value;
      commit();
    });

    $('#sCat2').addEventListener('input', function(e) {
      state.settings.cats[1] = e.target.value;
      commit();
    });

    $('#sCat3').addEventListener('input', function(e) {
      state.settings.cats[2] = e.target.value;
      commit();
    });

    $('#sWarn').addEventListener('change', function(e) {
      var v = parseInt(e.target.value, 10);

      state.settings.warnSec = isNaN(v) ? 15 : Math.max(0, Math.min(120, v));
      commit();
    });

    $('#sSenshu').addEventListener('change', function(e) {
      state.settings.autoSenshu = e.target.checked;
      commit();
    });

    $('#sSound').addEventListener('change', function(e) {
      state.settings.sound = e.target.checked;
      commit();
    });

    $('#sSwap').addEventListener('change', function(e) {
      state.settings.swap = e.target.checked;
      commit();
    });

    document.addEventListener('keydown', function(e) {
      if (isDisplay && e.key === 'Escape' && APP) {
        APP.exitFullscreen();
      }
    });

    $('#display').addEventListener('dblclick', fullscreen);

    var awakeT = null;

    document.addEventListener('mousemove', function() {
      if (!isDisplay) {
        return;
      }

      var d = $('#display');

      d.classList.add('awake');
      clearTimeout(awakeT);

      awakeT = setTimeout(function() {
        d.classList.remove('awake');
      }, 2500);
    });

    setInterval(function() {
      if (isDisplay) {
        return;
      }

      var k = state.kumite, t = k.timer, p = state.pause;

      tickControl();
      tickPause();

      if (p.active && p.running && p.mode === 'down' && pShown(p) <= 0) {
        p.base = p.duration;
        p.running = false;
        sound('end');
        commit();
      }

      if (!t.running) {
        return;
      }

      var r = rem(t);

      if (r <= 0) {
        timeUp();
        sound('end');
        commit();
        return;
      }

      if (!k.warned && r <= state.settings.warnSec * 1000) {
        k.warned = true;
        sound('warn');
        commit();
      }
    }, 100);
  }

  window.Placar = {
    estado: function() {
      return state;
    },
    alterar: function(fn) {
      snap();
      fn(state, { newKumite: newKumite, newKata: newKata });
      kataCustom = { aka: false, ao: false };
      commit();
    },
    ouvir: function(cb) {
      ouvintes.push(cb);
    },
    exibindo: function() {
      return isDisplay;
    },
    restante: function() {
      return rem(state.kumite.timer);
    }
  };

  bind();
  setView();
  requestAnimationFrame(loop);
})();
