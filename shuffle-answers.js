/* ===========================================================================
   shuffle-answers.js  (v2)
   Universal MCQ option shuffler for Jackson's chemistry portal
   (jacksonhabimana.github.io/chemistry-)

   On every page load, this script randomly re-orders the four options of
   every multiple-choice question so the correct answer is not always in
   the same letter (A/B/C/D). Scoring still works — the script uses
   strategies that preserve the link between each option's text and
   however your scoring logic identifies the correct answer.

   Covers:
     • Unit pages — Section Quick Quiz   (window._EMQA data)
     • Unit pages — "Mini-Quiz"          (inline submitMQ(...,{...}) onclick)
     • Unit pages — 25-question quiz     (generic DOM shuffle)
     • Student Hub Take Quiz             (generic DOM shuffle)
     • Tests page                        (generic DOM shuffle)
     • Exams page                        (generic DOM shuffle)
     • Any other page with 4-option MCQs (generic DOM shuffle)

   Install:
     Put this file next to fix-answers.js in the repo, and add to any page
     that has MCQs — just before the closing </body> tag:

       <script src="shuffle-answers.js"></script>

   Verify:
     Open the browser console (F12). You should see:
       [shuffle-answers] Shuffled: A=X, B=Y, C=Z
     Reload the page a few times — the correct answer should land on
     different letters across reloads.
=========================================================================== */

(function () {
  'use strict';

  if (window.__SHUFFLE_ANSWERS_APPLIED__) return;
  window.__SHUFFLE_ANSWERS_APPLIED__ = true;

  var LETTERS = ['A', 'B', 'C', 'D'];

  // Labels we've already shuffled — prevents double-shuffle when later
  // passes (or the MutationObserver) revisit the same group.
  var handledLabels = new WeakSet();

  function shuffleInPlace(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function inputsByName(name, root) {
    root = root || document;
    try {
      return Array.prototype.slice.call(
        root.querySelectorAll('input[type="radio"][name="' + CSS.escape(name) + '"]')
      );
    } catch (e) {
      return Array.prototype.slice.call(
        root.querySelectorAll('input[type="radio"]')
      ).filter(function (n) { return n.name === name; });
    }
  }

  // Extract a label's content (excluding its radio <input>) as HTML.
  function extractLabelContent(label) {
    var clone = label.cloneNode(true);
    var ins = clone.querySelectorAll('input');
    for (var i = 0; i < ins.length; i++) ins[i].parentNode.removeChild(ins[i]);
    return clone.innerHTML;
  }

  // Replace everything after a label's <input> with the given HTML.
  function writeLabelContent(label, html) {
    var input = label.querySelector('input');
    if (!input) return false;
    var kids = Array.prototype.slice.call(label.childNodes);
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] !== input) label.removeChild(kids[i]);
    }
    label.appendChild(document.createTextNode(' '));
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    while (tpl.content && tpl.content.firstChild) {
      label.appendChild(tpl.content.firstChild);
    }
    return true;
  }

  // Shuffle 4 labels by swapping the TEXT among them (inputs stay put).
  // Returns map: origIndex -> newIndex, or null if it can't shuffle cleanly.
  function textSwap(labels) {
    if (!labels || labels.length !== 4) return null;
    for (var k = 0; k < 4; k++) {
      if (!labels[k] || !labels[k].querySelector('input')) return null;
    }
    var texts = labels.map(extractLabelContent);
    var perm = shuffleInPlace([0, 1, 2, 3]);
    for (var i = 0; i < 4; i++) {
      if (!writeLabelContent(labels[i], texts[perm[i]])) return null;
      var inp = labels[i].querySelector('input');
      if (inp) inp.checked = false;
      if (labels[i].classList) labels[i].classList.remove('correct', 'wrong');
    }
    var map = {};
    for (var j = 0; j < 4; j++) map[perm[j]] = j;
    return map;
  }

  /* --- PATTERN A: window._EMQA section quizzes ---------------------- */
  function shufflePatternA() {
    if (!window._EMQA || typeof window._EMQA !== 'object') return 0;
    var count = 0;
    for (var section in window._EMQA) {
      if (!Object.prototype.hasOwnProperty.call(window._EMQA, section)) continue;
      var answers = window._EMQA[section];
      if (!answers || typeof answers !== 'object') continue;
      for (var qnum in answers) {
        if (!Object.prototype.hasOwnProperty.call(answers, qnum)) continue;
        var origIdx = parseInt(answers[qnum], 10);
        if (isNaN(origIdx) || origIdx < 0 || origIdx > 3) continue;
        var inputs = inputsByName('mq' + section + '_' + qnum);
        if (inputs.length !== 4) continue;
        var labels = inputs.map(function (i) { return i.closest('label'); });
        if (labels.indexOf(null) !== -1) continue;
        var map = textSwap(labels);
        if (!map) continue;
        answers[qnum] = map[origIdx];
        labels.forEach(function (l) { handledLabels.add(l); });
        count++;
      }
    }
    return count;
  }

  /* --- PATTERN B: mini-quiz with inline submitMQ(...,{...}) onclick -- */
  function shufflePatternB() {
    var count = 0;
    var buttons = document.querySelectorAll('button[onclick]');
    for (var b = 0; b < buttons.length; b++) {
      var btn = buttons[b];
      var onclick = btn.getAttribute('onclick') || '';
      var m = onclick.match(/submitMQ\s*\(\s*(['"])([^'"]+)\1\s*,\s*(\{[\s\S]+?\})\s*\)/);
      if (!m) continue;
      var prefix = m[2];
      var ansObj;
      try { ansObj = JSON.parse(m[3]); } catch (e) { continue; }
      if (!ansObj || typeof ansObj !== 'object') continue;

      var newAns = {};
      for (var qname in ansObj) {
        if (!Object.prototype.hasOwnProperty.call(ansObj, qname)) continue;
        var correctLetter = String(ansObj[qname] || '').toUpperCase();
        var correctIdx = LETTERS.indexOf(correctLetter);
        var inputs = inputsByName(qname);
        if (inputs.length !== 4 || correctIdx < 0) {
          newAns[qname] = ansObj[qname];
          continue;
        }
        var origDomIdx = -1;
        for (var i = 0; i < 4; i++) {
          if ((inputs[i].value || '').toUpperCase() === correctLetter) { origDomIdx = i; break; }
        }
        if (origDomIdx < 0) origDomIdx = correctIdx;
        var labels = inputs.map(function (ii) { return ii.closest('label'); });
        if (labels.indexOf(null) !== -1) { newAns[qname] = ansObj[qname]; continue; }
        var map = textSwap(labels);
        if (!map) { newAns[qname] = ansObj[qname]; continue; }
        var newDomIdx = map[origDomIdx];
        var newLetter = (inputs[newDomIdx] && inputs[newDomIdx].value)
          ? inputs[newDomIdx].value.toUpperCase() : LETTERS[newDomIdx];
        newAns[qname] = newLetter;
        labels.forEach(function (l) { handledLabels.add(l); });
        count++;
      }

      var replacement =
        'submitMQ(' + JSON.stringify(prefix) + ',' + JSON.stringify(newAns) + ')';
      var newOnclick = onclick.replace(
        /submitMQ\s*\(\s*['"][^'"]+['"]\s*,\s*\{[\s\S]+?\}\s*\)/,
        replacement
      );
      btn.setAttribute('onclick', newOnclick);
    }
    return count;
  }

  /* --- PATTERN C: generic 4-option MCQ — DOM-reorder whole labels ----
     For any group of 4 radio inputs sharing a `name`, move the entire
     <label> elements around (including their inputs). This preserves the
     link between each input's value (A/B/C/D), its text, and whatever
     the scoring engine uses to decide "correct". Works for any scoring
     that identifies the correct answer by the input's value or id.

     Skips groups already handled by Pattern A or Pattern B. ------------- */
  function shufflePatternC(root) {
    root = root || document;
    var inputs;
    try {
      inputs = root.querySelectorAll
        ? root.querySelectorAll('input[type="radio"]')
        : [];
    } catch (e) { return 0; }

    var groups = {};
    Array.prototype.forEach.call(inputs, function (inp) {
      var n = inp.name; if (!n) return;
      (groups[n] = groups[n] || []).push(inp);
    });

    var count = 0;
    for (var name in groups) {
      var g = groups[name];
      if (g.length !== 4) continue;

      var labels = g.map(function (inp) { return inp.closest('label'); });
      if (labels.indexOf(null) !== -1) continue;
      if (labels.some(function (l) { return handledLabels.has(l); })) continue;

      // All 4 labels must share one parent so we can reorder in place.
      var parent = labels[0].parentNode;
      if (!parent) continue;
      var sameParent = true;
      for (var pi = 1; pi < labels.length; pi++) {
        if (labels[pi].parentNode !== parent) { sameParent = false; break; }
      }
      if (!sameParent) continue;

      // Sort labels by current DOM order.
      var ordered = labels.slice().sort(function (a, b) {
        var pos = a.compareDocumentPosition(b);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

      // Marker lets us put them back at the same place after shuffling.
      var marker = document.createComment('shuffle-anchor');
      parent.insertBefore(marker, ordered[0]);
      for (var r = 0; r < ordered.length; r++) {
        if (ordered[r].parentNode) ordered[r].parentNode.removeChild(ordered[r]);
      }
      shuffleInPlace(ordered);
      for (var s = 0; s < ordered.length; s++) {
        parent.insertBefore(ordered[s], marker);
      }
      if (marker.parentNode) marker.parentNode.removeChild(marker);

      labels.forEach(function (l) { handledLabels.add(l); });
      count++;
    }
    return count;
  }

  /* --- Orchestration ------------------------------------------------- */
  function runStatic() {
    var a = 0, b = 0, c = 0;
    try { a = shufflePatternA(); } catch (e) { if (window.console) console.error('[shuffle-answers] A failed:', e); }
    try { b = shufflePatternB(); } catch (e) { if (window.console) console.error('[shuffle-answers] B failed:', e); }
    try { c = shufflePatternC(document); } catch (e) { if (window.console) console.error('[shuffle-answers] C failed:', e); }
    if (window.console) {
      console.log('[shuffle-answers] Shuffled: A=' + a + ', B=' + b + ', C=' + c);
    }
  }

  function watchForDynamic() {
    if (!window.MutationObserver || !document.body) return;
    var pending = false;
    function flush() {
      pending = false;
      try {
        var c = shufflePatternC(document);
        if (c > 0 && window.console) {
          console.log('[shuffle-answers] Dynamic shuffle: C=' + c);
        }
      } catch (e) {
        if (window.console) console.error('[shuffle-answers] Dynamic failed:', e);
      }
    }
    var observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var added = mutations[m].addedNodes;
        for (var n = 0; n < added.length; n++) {
          var node = added[n];
          if (node.nodeType !== 1) continue;
          if (node.tagName === 'INPUT' ||
              (node.querySelector && node.querySelector('input[type="radio"]'))) {
            if (!pending) {
              pending = true;
              setTimeout(flush, 30); // debounce so we catch a full group of 4
            }
            return;
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    runStatic();
    watchForDynamic();
    // Late passes in case scripts render questions after load.
    setTimeout(function () {
      try {
        var c = shufflePatternC(document);
        if (c > 0 && window.console) console.log('[shuffle-answers] Late pass: C=' + c);
      } catch (e) {}
    }, 500);
    setTimeout(function () {
      try {
        var c = shufflePatternC(document);
        if (c > 0 && window.console) console.log('[shuffle-answers] Late pass 2: C=' + c);
      } catch (e) {}
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
