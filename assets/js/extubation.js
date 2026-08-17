/* =============================================================================
   Prédiction du succès d'extubation
   Modèle de régression logistique (travail de Mme Murgue) :
       logit(p) = 71,58 − 0,748 × ÂG(SA) − 7,29 × pH
       p        = 1 / (1 + e^−logit)          → p = probabilité d'ÉCHEC
   Tout le calcul est local : rien n'est transmis ni enregistré.
   ========================================================================== */
(function () {
  'use strict';

  var COEF = { intercept: 71.58, ga: -0.748, ph: -7.29 };

  function logit(gaWeeks, ph) {
    return COEF.intercept + COEF.ga * gaWeeks + COEF.ph * ph;
  }

  function failureProbability(gaWeeks, ph) {
    return 1 / (1 + Math.exp(-logit(gaWeeks, ph)));
  }

  /* --- Formatage français ------------------------------------------------ */

  function num(value, decimals) {
    return value.toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function pct(p, decimals) {
    return num(p * 100, decimals === undefined ? 1 : decimals) + ' %';
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* --- Niveaux de risque (repères de lecture, pas des seuils décisionnels) - */

  var LEVELS = [
    { max: 0.20, key: 'good', label: "Risque d'échec faible",
      icon: '<path d="M20 6L9 17l-5-5"/>' },
    { max: 0.50, key: 'warn', label: "Risque d'échec intermédiaire",
      icon: '<path d="M12 3l9.5 16.5h-19L12 3z"/><path d="M12 10v4M12 17h.01"/>' },
    { max: Infinity, key: 'crit', label: "Risque d'échec élevé",
      icon: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>' }
  ];

  function levelFor(p) {
    for (var i = 0; i < LEVELS.length; i++) if (p < LEVELS[i].max) return LEVELS[i];
    return LEVELS[LEVELS.length - 1];
  }

  /* =========================================================================
     Graphique : une série, ligne 2 px + lavis à 10 %, grille en filet,
     survol avec réticule et infobulle.
     ====================================================================== */

  var VB_W = 460, VB_H = 250;
  var M = { top: 14, right: 16, bottom: 44, left: 40 };
  var PLOT_W = VB_W - M.left - M.right;
  var PLOT_H = VB_H - M.top - M.bottom;

  function makeChart(svg, tip) {
    var cfg = null;
    var gradId = 'area-' + svg.id;

    function sx(x) { return M.left + (x - cfg.xMin) / (cfg.xMax - cfg.xMin) * PLOT_W; }
    function sy(p) { return M.top + (1 - p) * PLOT_H; }

    function ticksFrom(min, max, step) {
      var out = [], t = Math.ceil((min - 1e-9) / step) * step;
      for (; t <= max + 1e-9; t += step) out.push(Math.round(t / step) * step);
      return out;
    }

    function render(next) {
      cfg = next;

      var i, parts = [];
      var samples = 160;
      var line = [], area = [];

      for (i = 0; i <= samples; i++) {
        var x = cfg.xMin + (cfg.xMax - cfg.xMin) * (i / samples);
        var px = sx(x).toFixed(2), py = sy(cfg.valueAt(x)).toFixed(2);
        line.push((i === 0 ? 'M' : 'L') + px + ' ' + py);
      }
      area = line.slice();
      area.push('L' + sx(cfg.xMax).toFixed(2) + ' ' + sy(0).toFixed(2));
      area.push('L' + sx(cfg.xMin).toFixed(2) + ' ' + sy(0).toFixed(2) + 'Z');

      /* Grille horizontale + graduations de l'axe des ordonnées */
      [0, 0.25, 0.5, 0.75, 1].forEach(function (p) {
        var y = sy(p).toFixed(2);
        parts.push('<line class="grid" x1="' + M.left + '" y1="' + y +
                   '" x2="' + (M.left + PLOT_W) + '" y2="' + y + '"/>');
        parts.push('<text x="' + (M.left - 8) + '" y="' + y +
                   '" text-anchor="end" dominant-baseline="middle">' + (p * 100) + '</text>');
      });

      parts.push('<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
                 '<stop class="stop-top" offset="0"/><stop class="stop-bot" offset="1"/>' +
                 '</linearGradient></defs>');
      parts.push('<path class="area" fill="url(#' + gradId + ')" d="' + area.join(' ') + '"/>');
      parts.push('<path class="line" d="' + line.join(' ') + '"/>');

      /* Axe des abscisses */
      parts.push('<line class="axis" x1="' + M.left + '" y1="' + sy(0).toFixed(2) +
                 '" x2="' + (M.left + PLOT_W) + '" y2="' + sy(0).toFixed(2) + '"/>');
      ticksFrom(cfg.xMin, cfg.xMax, cfg.xStep).forEach(function (t) {
        parts.push('<text x="' + sx(t).toFixed(2) + '" y="' + (M.top + PLOT_H + 18) +
                   '" text-anchor="middle">' + cfg.fmtX(t) + '</text>');
      });

      /* Point courant : repère vertical + marqueur cerclé de la surface */
      var cy = sy(cfg.valueAt(cfg.current));
      parts.push('<line class="marker" x1="' + sx(cfg.current).toFixed(2) + '" y1="' + M.top +
                 '" x2="' + sx(cfg.current).toFixed(2) + '" y2="' + sy(0).toFixed(2) + '"/>');
      parts.push('<circle class="dot" cx="' + sx(cfg.current).toFixed(2) + '" cy="' + cy.toFixed(2) + '" r="5"/>');

      /* Étiquette directe de la valeur courante */
      var labelX = clamp(sx(cfg.current), M.left + 24, M.left + PLOT_W - 24);
      var above = cy > M.top + 26;
      parts.push('<text class="value-label" x="' + labelX.toFixed(2) + '" y="' +
                 (above ? cy - 13 : cy + 21).toFixed(2) + '" text-anchor="middle">' +
                 pct(cfg.valueAt(cfg.current), 1).replace(' %', ' %') + '</text>');

      /* Couche de survol */
      parts.push('<line class="crosshair" x1="0" y1="' + M.top + '" x2="0" y2="' + sy(0).toFixed(2) + '"/>');
      parts.push('<circle class="hover-dot" cx="0" cy="0" r="4.5"/>');
      parts.push('<rect class="hit" x="' + M.left + '" y="' + M.top +
                 '" width="' + PLOT_W + '" height="' + PLOT_H + '"/>');

      /* Titres d'axes */
      parts.push('<text x="' + M.left + '" y="' + (M.top - 4) + '" text-anchor="start">échec (%)</text>');
      parts.push('<text x="' + (M.left + PLOT_W / 2) + '" y="' + (M.top + PLOT_H + 36) +
                 '" text-anchor="middle">' + cfg.xTitle + '</text>');

      svg.innerHTML = parts.join('');
    }

    function move(evt) {
      if (!cfg) return;
      var rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      var vbX = (evt.clientX - rect.left) / rect.width * VB_W;
      var x = clamp(cfg.xMin + (vbX - M.left) / PLOT_W * (cfg.xMax - cfg.xMin), cfg.xMin, cfg.xMax);
      var p = cfg.valueAt(x);
      var px = sx(x), py = sy(p);

      var cross = svg.querySelector('.crosshair');
      var hdot = svg.querySelector('.hover-dot');
      if (!cross || !hdot) return;
      cross.setAttribute('x1', px.toFixed(2));
      cross.setAttribute('x2', px.toFixed(2));
      cross.classList.add('is-visible');
      hdot.setAttribute('cx', px.toFixed(2));
      hdot.setAttribute('cy', py.toFixed(2));
      hdot.classList.add('is-visible');

      tip.innerHTML = cfg.tipLabel(x) + ' · <strong>' + pct(p, 1) + '</strong>';
      tip.style.left = clamp(px / VB_W * rect.width, 52, rect.width - 52) + 'px';
      tip.style.top = (py / VB_H * rect.height - 8) + 'px';
      tip.classList.add('is-visible');
    }

    function leave() {
      tip.classList.remove('is-visible');
      var cross = svg.querySelector('.crosshair');
      var hdot = svg.querySelector('.hover-dot');
      if (cross) cross.classList.remove('is-visible');
      if (hdot) hdot.classList.remove('is-visible');
    }

    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerleave', leave);
    svg.addEventListener('pointercancel', leave);

    return { render: render };
  }

  /* =========================================================================
     Application
     ====================================================================== */

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    gaWeeks: $('ga-weeks'), gaDays: $('ga-days'), gaRange: $('ga-range'), gaWarn: $('ga-warn'),
    ph: $('ph'), phRange: $('ph-range'), phWarn: $('ph-warn'),
    card: $('result-card'),
    prob: $('out-prob'), success: $('out-success'), meter: $('out-meter'),
    badge: $('out-badge'), badgeIcon: $('badge-icon'), badgeText: $('badge-text'),
    steps: $('steps'), tablePh: $('table-ph'),
    chartPhSub: $('chart-ph-sub'), chartGaSub: $('chart-ga-sub'),
    copy: $('btn-copy'), copyLabel: $('btn-copy-label'), reset: $('btn-reset')
  };

  var state = { gaDays: 196, ph: 7.30 };   // 28 SA + 0 j ; pH 7,30

  var chartPh = makeChart($('chart-ph'), $('tip-ph'));
  var chartGa = makeChart($('chart-ga'), $('tip-ga'));

  function gaWeeksDecimal() { return state.gaDays / 7; }

  function gaText() {
    return Math.floor(state.gaDays / 7) + '+' + (state.gaDays % 7) + ' SA';
  }

  /* --- Rendu ------------------------------------------------------------- */

  function render() {
    var ga = gaWeeksDecimal();
    var ph = state.ph;
    var l = logit(ga, ph);
    var p = failureProbability(ga, ph);
    var lvl = levelFor(p);

    els.prob.textContent = num(p * 100, 1);
    els.success.textContent = pct(1 - p, 1);

    els.meter.style.width = (p * 100).toFixed(2) + '%';
    els.meter.setAttribute('data-level', lvl.key);
    els.card.setAttribute('data-level', lvl.key);
    els.badge.setAttribute('data-level', lvl.key);
    els.badgeIcon.innerHTML = lvl.icon;
    els.badgeText.textContent = lvl.label;

    /* Détail du calcul */
    els.steps.innerHTML = [
      row('Constante', num(COEF.intercept, 2)),
      row('− 0,748 × ' + num(ga, 2) + ' SA', num(COEF.ga * ga, 3)),
      row('− 7,29 × ' + num(ph, 2), num(COEF.ph * ph, 3)),
      row('logit(p)', num(l, 3)),
      row('p = 1 / (1 + e<sup>−logit</sup>)', pct(p, 1))
    ].join('');

    /* Graphiques : domaines élargis si besoin pour contenir le point courant */
    var phMin = Math.min(7.00, Math.floor(ph * 10) / 10);
    var phMax = Math.max(7.50, Math.ceil(ph * 10) / 10);
    els.chartPhSub.textContent = 'à ' + gaText();
    chartPh.render({
      xMin: phMin, xMax: phMax, xStep: 0.1, current: ph, xTitle: 'pH',
      valueAt: function (x) { return failureProbability(ga, x); },
      fmtX: function (t) { return num(t, 1); },
      tipLabel: function (x) { return 'pH ' + num(x, 2); }
    });

    var gaMin = Math.min(24, Math.floor(ga));
    var gaMax = Math.max(36, Math.ceil(ga));
    els.chartGaSub.textContent = 'à pH ' + num(ph, 2);
    chartGa.render({
      xMin: gaMin, xMax: gaMax, xStep: 2, current: ga, xTitle: 'terme de naissance (SA)',
      valueAt: function (x) { return failureProbability(x, ph); },
      fmtX: function (t) { return num(t, 0); },
      tipLabel: function (x) { return num(x, 1) + ' SA'; }
    });

    /* Tableau (relais accessible des courbes) */
    var rows = [];
    for (var t = 7.00; t <= 7.501; t += 0.05) {
      var v = Math.round(t * 100) / 100;
      var pv = failureProbability(ga, v);
      var current = Math.abs(v - ph) < 0.025 ? ' class="is-current"' : '';
      rows.push('<tr' + current + '><td>' + num(v, 2) + '</td><td>' +
                pct(pv, 1) + '</td><td>' + pct(1 - pv, 1) + '</td></tr>');
    }
    els.tablePh.innerHTML = rows.join('');

    checkWarnings();
    syncUrl();
  }

  /* L'URL reflète l'état : un réglage se partage ou se met en favori.
     Différé : un déplacement de curseur déclenche des dizaines de rendus et
     les navigateurs limitent la fréquence de replaceState. */
  var urlTimer;
  function syncUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(writeUrl, 250);
  }

  function writeUrl() {
    try {
      var q = '?sa=' + (state.gaDays / 7).toFixed(2) + '&ph=' + state.ph.toFixed(2);
      history.replaceState(null, '', location.pathname + q);
    } catch (e) { /* file:// ou navigateur restrictif : sans effet */ }
  }

  function readUrl() {
    try {
      var q = new URLSearchParams(location.search);
      var sa = parseFloat(q.get('sa'));
      var ph = parseFloat(q.get('ph'));
      if (isFinite(sa) && sa >= 20 && sa <= 45) state.gaDays = Math.round(sa * 7);
      if (isFinite(ph) && ph >= 6.5 && ph <= 7.8) state.ph = Math.round(ph * 100) / 100;
    } catch (e) { /* paramètres absents ou invalides : valeurs par défaut */ }
  }

  function row(label, value) {
    return '<li><span>' + label + '</span><b>' + value + '</b></li>';
  }

  function checkWarnings() {
    var ga = gaWeeksDecimal();
    warn(els.gaWarn, (ga < 23 || ga > 42)
      ? 'Terme de naissance inhabituel — vérifiez la saisie.' : '');
    warn(els.phWarn, (state.ph < 6.90 || state.ph > 7.60)
      ? 'pH hors des valeurs habituelles — vérifiez la saisie.' : '');
  }

  function warn(el, message) {
    el.textContent = message;
    el.classList.toggle('is-visible', !!message);
  }

  /* --- Synchronisation des champs ---------------------------------------- */

  function syncGaFields() {
    els.gaWeeks.value = Math.floor(state.gaDays / 7);
    els.gaDays.value = state.gaDays % 7;
    els.gaRange.value = clamp(state.gaDays, 154, 315);
  }

  function syncPhFields() {
    els.ph.value = state.ph.toFixed(2);
    els.phRange.value = clamp(Math.round(state.ph * 100), 690, 760);
  }

  function setGaDays(days, syncAll) {
    state.gaDays = clamp(Math.round(days), 140, 315);
    if (syncAll) syncGaFields(); else els.gaRange.value = clamp(state.gaDays, 154, 315);
    render();
  }

  function setPh(value, syncAll) {
    state.ph = clamp(Math.round(value * 100) / 100, 6.5, 7.8);
    if (syncAll) syncPhFields(); else els.phRange.value = clamp(Math.round(state.ph * 100), 690, 760);
    render();
  }

  els.gaWeeks.addEventListener('input', function () {
    var w = parseInt(els.gaWeeks.value, 10);
    var d = parseInt(els.gaDays.value, 10) || 0;
    if (isFinite(w) && w >= 20 && w <= 45) setGaDays(w * 7 + d, false);
  });

  els.gaDays.addEventListener('input', function () {
    var w = parseInt(els.gaWeeks.value, 10);
    var d = parseInt(els.gaDays.value, 10);
    if (isFinite(w) && isFinite(d) && d >= 0 && d <= 6) setGaDays(w * 7 + d, false);
  });

  els.gaDays.addEventListener('change', function () {
    setGaDays(state.gaDays, true);
  });

  els.gaWeeks.addEventListener('change', function () {
    setGaDays(state.gaDays, true);
  });

  els.gaRange.addEventListener('input', function () {
    setGaDays(parseInt(els.gaRange.value, 10), true);
  });

  els.ph.addEventListener('input', function () {
    var v = parseFloat(String(els.ph.value).replace(',', '.'));
    if (isFinite(v) && v >= 6.5 && v <= 7.8) setPh(v, false);
  });

  els.ph.addEventListener('change', function () { setPh(state.ph, true); });

  els.phRange.addEventListener('input', function () {
    setPh(parseInt(els.phRange.value, 10) / 100, true);
  });

  els.reset.addEventListener('click', function () {
    setTimeout(function () {
      state.gaDays = 196;
      state.ph = 7.30;
      syncGaFields();
      syncPhFields();
      render();
    }, 0);
  });

  /* --- Copie du résultat -------------------------------------------------- */

  els.copy.addEventListener('click', function () {
    var ga = gaWeeksDecimal();
    var p = failureProbability(ga, state.ph);
    var text =
      "Prédiction d'échec d'extubation — terme de naissance " + gaText() +
      " (" + num(ga, 2) + " SA), pH pré-extubation " + num(state.ph, 2) +
      " : probabilité d'échec " + pct(p, 1) +
      " (succès " + pct(1 - p, 1) + ").\n" +
      "Modèle : logit(p) = 71,58 − 0,748 × ÂG(SA) − 7,29 × pH (travail de Mme Murgue). " +
      "Aide à la décision, ne remplace pas le jugement clinique.";

    function done(ok) {
      els.copyLabel.textContent = ok ? 'Copié' : 'Copie impossible';
      setTimeout(function () { els.copyLabel.textContent = 'Copier le résultat'; }, 1800);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  });

  /* Le thème change les couleurs lues par le SVG : on redessine. */
  document.addEventListener('rnn:themechange', render);

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 120);
  });

  readUrl();
  syncGaFields();
  syncPhFields();
  render();
})();
