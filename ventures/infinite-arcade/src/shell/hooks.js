/* Daycade site hooks. No third-party code is loaded in v1.
 * - Share buttons (Web Share API, clipboard) and fullscreen
 * - "New today" rotation + countdown on the home page
 * - Listens to events games post from their iframe (gameplayStart/Stop, score, happytime)
 *   and forwards them to window.DaycadeHooks, where analytics or an ad provider can attach later.
 */
(function () {
  'use strict';
  var H = window.DaycadeHooks = window.DaycadeHooks || { onGameEvent: [], ads: null };
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || d.source !== 'daycade') return;
    try { var p = JSON.parse(localStorage.getItem('daycade.played') || '{}'); if (d.type === 'gameplayStart') { p[d.game] = Date.now(); localStorage.setItem('daycade.played', JSON.stringify(p)); } } catch (_) { }
    (H.onGameEvent || []).forEach(function (f) { try { f(d); } catch (_) { } });
  });
  document.querySelectorAll('.js-share').forEach(function (b) {
    if (!navigator.share) { b.style.display = 'none'; return; }
    b.addEventListener('click', function () { navigator.share({ title: b.dataset.title, text: b.dataset.text, url: b.dataset.url }).catch(function () { }); });
  });
  document.querySelectorAll('.js-copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var done = function () { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy link'; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.url).then(done, function () { prompt('Copy this link:', b.dataset.url); });
      else prompt('Copy this link:', b.dataset.url);
    });
  });
  document.querySelectorAll('.js-fs').forEach(function (b) {
    var st = document.getElementById('stage');
    if (!st || !(st.requestFullscreen || st.webkitRequestFullscreen)) { b.style.display = 'none'; return; }
    b.addEventListener('click', function () { (st.requestFullscreen || st.webkitRequestFullscreen).call(st); var f = st.querySelector('iframe'); if (f) f.focus(); });
  });
  var fr = document.querySelector('#stage iframe'); if (fr) fr.addEventListener('load', function () { try { fr.focus(); } catch (_) { } });
  var cd = document.getElementById('cd');
  if (cd) {
    var tick = function () { var n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0); var s = Math.floor((m - n) / 1000); cd.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(function (x) { return String(x).padStart(2, '0'); }).join(':'); };
    tick(); setInterval(tick, 1000);
  }
  // Mark games played on this device
  try { var played = JSON.parse(localStorage.getItem('daycade.played') || '{}'); document.querySelectorAll('.card[data-slug]').forEach(function (c) { if (played[c.dataset.slug]) { var ch = c.querySelector('.chip'); if (ch && !ch.classList.contains('new')) ch.textContent = '✓ Played'; } }); } catch (_) { }
})();
