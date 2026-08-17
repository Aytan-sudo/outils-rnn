/* Bascule de thème clair / sombre.
   Sans choix explicite, la page suit le réglage du système (aucun attribut
   n'est posé) ; un clic pose data-theme sur <html> et le mémorise. */
(function () {
  var KEY = 'rnn-theme';
  var root = document.documentElement;

  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  } catch (e) { /* stockage indisponible : on reste sur le réglage système */ }

  function currentIsDark() {
    var attr = root.getAttribute('data-theme');
    if (attr) return attr === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = currentIsDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* ignoré */ }
      document.dispatchEvent(new CustomEvent('rnn:themechange'));
    });
  });
})();
