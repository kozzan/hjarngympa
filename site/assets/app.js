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
  // No ad or analytics script loads before a choice is made (Consent Mode v2).
  // Ad slot heights are reserved in CSS regardless, so CLS stays at 0 whether
  // the visitor accepts, rejects, or never answers.
  var KEY = 'consent';
  var cmp = document.getElementById('cmp');

  function readConsent() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function decide(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
    if (cmp) cmp.hidden = true;
    grantConsent(value === 'all');
  }
  function grantConsent(granted) {
    // The AdSense tag is already on the page but held by the Consent Mode
    // defaults set in <head>. This releases it (or keeps it held).
    var v = granted ? 'granted' : 'denied';
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        ad_storage: v,
        ad_user_data: v,
        ad_personalization: v,
        analytics_storage: v
      });
    }
    document.documentElement.dataset.ads = granted ? 'consented' : 'denied';
  }

  if (cmp) {
    var choice = readConsent();
    if (!choice) cmp.hidden = false;
    else grantConsent(choice === 'all');

    var accept = document.getElementById('cmp-accept');
    var reject = document.getElementById('cmp-reject');
    if (accept) accept.addEventListener('click', function () { decide('all'); });
    if (reject) reject.addEventListener('click', function () { decide('none'); });
  }

  var reopen = document.getElementById('cmp-reopen');
  if (reopen && cmp) {
    reopen.addEventListener('click', function () { cmp.hidden = false; });
  }
})();
