/* Site-wide: theme toggle + consent. Both are deliberately tiny and
   dependency-free; nothing here should ever block a game from starting. */

(function () {
  'use strict';

  // ---- theme -------------------------------------------------------------
  var root = document.documentElement;
  var toggle = document.getElementById('theme-toggle');

  function currentTheme() {
    if (root.dataset.theme) return root.dataset.theme;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function paintToggle() {
    if (toggle) toggle.textContent = currentTheme() === 'dark' ? '☀' : '☾';
  }
  paintToggle();

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
      paintToggle();
    });
  }

  // ---- consent -----------------------------------------------------------
  // Google's certified CMP (Funding Choices) owns the consent dialog and the
  // Consent Mode updates. We only set the denied-by-default signals in <head>
  // before it loads. Do NOT add a second banner or write our own consent
  // value -- that would grant consent the CMP never actually collected.
  //
  // The footer link re-opens Google's dialog, and stays hidden unless the CMP
  // actually loaded (it only serves EEA/UK/CH, and ad blockers eat it).
  var reopen = document.getElementById('cmp-reopen');
  if (reopen) {
    reopen.addEventListener('click', function () {
      if (window.googlefc && typeof googlefc.showRevocationMessage === 'function') {
        googlefc.showRevocationMessage();
      }
    });
    var tries = 0;
    var poll = setInterval(function () {
      if (window.googlefc && typeof googlefc.showRevocationMessage === 'function') {
        reopen.hidden = false;
        clearInterval(poll);
      } else if (++tries > 20) {
        clearInterval(poll);
      }
    }, 250);
  }
})();
