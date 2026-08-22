/* Mahjong tile faces, generated rather than sourced.

   Why not a downloaded set:
   - Wikimedia's tiles are mostly CC BY-SA 4.0. Usable, but share-alike is a
     permanent obligation on a site meant to run unattended.
   - The Unicode mahjong block (U+1F000..) draws the WHOLE tile including its
     frame, so it would render a tile inside our tile and break the
     border-weight cue that distinguishes free from blocked.
   - A Noto Sans Symbols 2 subset covering the 34 glyphs is 44 KB and has the
     same frame problem.

   Dots and bamboo are pure geometry, so they are drawn here: exact at any
   size, they inherit currentColor for dark mode, cost no extra request, and
   carry no licence. Characters, winds and dragons stay as CJK text -- those
   are core ideographs present in every platform's fallback chain, unlike the
   rare pictographic tile glyphs the handoff rightly warned about. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MahjongFaces = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 28, H = 36;
  // Pip arrangements, chosen so every count stays countable at ~44px.
  var ROWS = {
    1: [1], 2: [1, 1], 3: [1, 1, 1], 4: [2, 2], 5: [2, 1, 2],
    6: [3, 3], 7: [4, 3], 8: [4, 4], 9: [3, 3, 3]
  };

  function positions(n) {
    var rows = ROWS[n], out = [];
    var rh = H / rows.length;
    for (var r = 0; r < rows.length; r++) {
      var cols = rows[r], cw = W / cols;
      for (var c = 0; c < cols; c++) {
        out.push({ x: cw * (c + 0.5), y: rh * (r + 0.5), rows: rows.length, cols: cols });
      }
    }
    return out;
  }

  function svg(inner) {
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="100%" ' +
      'aria-hidden="true" focusable="false" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      inner + '</svg>';
  }

  function dots(n) {
    var pts = positions(n), maxCols = Math.max.apply(null, ROWS[n]);
    var r = Math.min(W / maxCols, H / ROWS[n].length) * 0.32;
    var s = '';
    for (var i = 0; i < pts.length; i++) {
      s += '<circle cx="' + pts[i].x.toFixed(1) + '" cy="' + pts[i].y.toFixed(1) +
           '" r="' + r.toFixed(1) + '" fill="currentColor" stroke="none"/>';
    }
    return svg(s);
  }

  function bamboo(n) {
    var pts = positions(n), maxCols = Math.max.apply(null, ROWS[n]);
    var h = (H / ROWS[n].length) * 0.62;
    var sw = Math.max(1.6, Math.min(3, W / maxCols * 0.3));
    var s = '';
    for (var i = 0; i < pts.length; i++) {
      var x = pts[i].x.toFixed(1);
      s += '<line x1="' + x + '" y1="' + (pts[i].y - h / 2).toFixed(1) +
           '" x2="' + x + '" y2="' + (pts[i].y + h / 2).toFixed(1) +
           '" stroke-width="' + sw.toFixed(1) + '"/>';
    }
    return svg(s);
  }

  /* group + face -> inner HTML for a tile */
  function render(group, face) {
    if (group === 'cirklar') return dots(parseInt(face.slice(1), 10));
    if (group === 'bambu') return bamboo(parseInt(face.slice(1), 10));
    return '<span class="cjk">' + face + '</span>';
  }

  return { render: render, dots: dots, bamboo: bamboo, ROWS: ROWS };
});
