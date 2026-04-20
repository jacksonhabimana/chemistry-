/* ===========================================================================
   shuffle-answers.js  (v3)
   Universal MCQ option shuffler for Jackson's chemistry portal
   (jacksonhabimana.github.io/chemistry-)

   On every page load, this script randomly re-orders the four options of
   every multiple-choice question so the correct answer is NOT always in
   the same letter (A/B/C/D). Scoring still works correctly — the script
   preserves the link between each option's text and however the scoring
   logic identifies the correct answer.

   v3 covers (NEW: Pattern D for data-driven quizzes like exams.html):
     • Unit pages — Section Quick Quiz        (Pattern A: window._EMQA)
     • Unit pages — "Mini-Quiz"               (Pattern B: submitMQ onclick)
     • Unit pages — 25-question unit quiz     (Pattern C: radio label swap)
     • Student hub Take Quiz                  (Pattern C or D)
     • Tests page    (tests.html)             (Pattern D: shuffle data)
     • Exams page    (exams.html)             (Pattern D: shuffle data) ★
     • Any other data-driven MCQ              (Pattern D)

   Install:
     Put this file in the same folder as fix-answers.js, and add ONE line
     to every page that has MCQs — just before the closing </body> tag:

       <script src="shuffle-answers.js"></script>

   Verify:
     Open the browser console (F12) and refresh. You should see:
       [shuffle-answers] Shuffled: A=X, B=Y, C=Z, D=W
     Reload the page — the correct answer should land on different letters
     across reloads.
=========================================================================== */

(function () {
  'use strict';

  if (window.__SHUFFLE_ANSWERS_APPLIED__) return;
  window.__SHUFFLE_ANSWERS_APPLIED__ = true;

  var LETTERS = ['A', 'B', 'C', 'D'];

  // Track labels already shuffled so later passes don't re-shuffle them.
  var handledLabels = new WeakSet();
  // Same for data-level questions.
  var SHUFFLED_MARK = '__shuffle_answers_done__';

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

  function extractLabelContent(label) {
    var clone = label.cloneNode(true);
    var ins = clone.querySelectorAll('input');
    for (var i = 0; i < ins.length; i++) ins[i].parentNode.removeChild(ins[i]);
    return clone.innerHTML;
  }

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

  /* --- PATTERN C: generic 4-option MCQ — DOM-reorder whole labels ---- */
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

      var parent = labels[0].parentNode;
      if (!parent) continue;
      var sameParent = true;
      for (var pi = 1; pi < labels.length; pi++) {
        if (labels[pi].parentNode !== parent) { sameParent = false; break; }
      }
      if (!sameParent) continue;

      var ordered = labels.slice().sort(function (a, b) {
        var pos = a.compareDocumentPosition(b);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });

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

  /* --- PATTERN D: data-driven quizzes (exams.html, tests.html, etc.) --
     Looks for globals holding quiz data shaped like:
       { s4:[...], s5:[...], s6:[...], full:[...] }   or plain array
     Each question object is expected to have:
       opts: [4 strings]      (or options/answers)
       a:    number 0..3      (or correct/correctIndex/ans, or letter 'A'..'D')
     Shuffles each question's options in place and updates the correct-
     answer index to match, so the render/check functions keep working. -- */

  var D_CANDIDATE_NAMES = [
    'E', 'T', 'Q',
    'QUIZ', 'QUIZ_DATA', 'QUIZDATA', 'quizData',
    'EXAM', 'EXAMS', 'EXAM_DATA', 'examData',
    'TEST', 'TESTS', 'TEST_DATA', 'testData',
    'QUESTIONS', 'questions',
    'DATA', 'data'
  ];

  var D_OPT_KEYS = ['opts', 'options', 'choices', 'answers'];
  // Correct-answer keys whose value is a 0..3 index.
  var D_IDX_KEYS = ['a', 'ans', 'answer', 'correct', 'correctIndex', 'correctIdx'];
  // Correct-answer keys whose value is a letter 'A'..'D'.
  var D_LETTER_KEYS = ['letter', 'correctLetter', 'ansLetter'];

  function readGlobalByName(name) {
    // Try window[name] first (works for `var` globals).
    try {
      if (name in window) return window[name];
    } catch (e) {}
    // Try lexical lookup via Function constructor (works for `const`/`let` globals).
    try {
      var getter = new Function(
        'try{ return (typeof ' + name + '!=="undefined") ? ' + name + ' : undefined; }' +
        'catch(e){ return undefined; }'
      );
      return getter();
    } catch (e) {
      return undefined;
    }
  }

  function findOptsKey(q) {
    for (var i = 0; i < D_OPT_KEYS.length; i++) {
      var k = D_OPT_KEYS[i];
      if (Array.isArray(q[k]) && q[k].length === 4) return k;
    }
    return null;
  }

  function findIdxKey(q) {
    for (var i = 0; i < D_IDX_KEYS.length; i++) {
      var k = D_IDX_KEYS[i];
      if (typeof q[k] === 'number' && q[k] >= 0 && q[k] <= 3) return k;
    }
    return null;
  }

  function findLetterKey(q) {
    for (var i = 0; i < D_LETTER_KEYS.length; i++) {
      var k = D_LETTER_KEYS[i];
      if (typeof q[k] === 'string' && LETTERS.indexOf(q[k].toUpperCase()) !== -1) return k;
    }
    // Also handle the case where an idx-named key contains a letter.
    for (var j = 0; j < D_IDX_KEYS.length; j++) {
      var kk = D_IDX_KEYS[j];
      if (typeof q[kk] === 'string' && LETTERS.indexOf(q[kk].toUpperCase()) !== -1) return kk;
    }
    return null;
  }

  function shuffleQuestion(q) {
    if (!q || typeof q !== 'object' || q[SHUFFLED_MARK]) return false;
    var optsKey = findOptsKey(q);
    if (!optsKey) return false;

    var idxKey = findIdxKey(q);
    var letterKey = idxKey ? null : findLetterKey(q);

    var correctIdx;
    if (idxKey) {
      correctIdx = q[idxKey];
    } else if (letterKey) {
      correctIdx = LETTERS.indexOf(String(q[letterKey]).toUpperCase());
      if (correctIdx < 0) return false;
    } else {
      return false;
    }

    var opts = q[optsKey];
    var correctText = opts[correctIdx];

    // Shuffle copy of the options.
    var shuffled = opts.slice();
    shuffleInPlace(shuffled);
    q[optsKey] = shuffled;

    // Update the correct-answer key accordingly.
    var newIdx = shuffled.indexOf(correctText);
    if (newIdx < 0) {
      // Fallback: restore original ordering.
      q[optsKey] = opts;
      return false;
    }
    if (idxKey) {
      q[idxKey] = newIdx;
    } else {
      q[letterKey] = LETTERS[newIdx];
    }

    // Hidden, non-enumerable would be ideal but assignment works fine.
    try {
      Object.defineProperty(q, SHUFFLED_MARK, {
        value: true, enumerable: false, configurable: true, writable: true
      });
    } catch (e) { q[SHUFFLED_MARK] = true; }
    return true;
  }

  function walkAndShuffle(obj, depth) {
    depth = depth || 0;
    if (depth > 6 || obj == null) return 0;
    var count = 0;
    if (Array.isArray(obj)) {
      // If this array looks like a list of question objects, shuffle each.
      for (var i = 0; i < obj.length; i++) {
        var it = obj[i];
        if (it && typeof it === 'object' && !Array.isArray(it) && findOptsKey(it)) {
          if (shuffleQuestion(it)) count++;
        } else if (it && typeof it === 'object') {
          count += walkAndShuffle(it, depth + 1);
        }
      }
      return count;
    }
    if (typeof obj !== 'object') return 0;
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      try {
        count += walkAndShuffle(obj[k], depth + 1);
      } catch (e) { /* skip */ }
    }
    return count;
  }

  function shufflePatternD() {
    var count = 0;
    for (var i = 0; i < D_CANDIDATE_NAMES.length; i++) {
      var name = D_CANDIDATE_NAMES[i];
      var val = readGlobalByName(name);
      if (val && typeof val === 'object') {
        try { count += walkAndShuffle(val, 0); } catch (e) {}
      }
    }
    return count;
  }

  /* --- Orchestration ------------------------------------------------- */
  function runStatic() {
    var a = 0, b = 0, c = 0, d = 0;
    try { a = shufflePatternA(); } catch (e) { if (window.console) console.error('[shuffle-answers] A failed:', e); }
    try { b = shufflePatternB(); } catch (e) { if (window.console) console.error('[shuffle-answers] B failed:', e); }
    try { c = shufflePatternC(document); } catch (e) { if (window.console) console.error('[shuffle-answers] C failed:', e); }
    try { d = shufflePatternD(); } catch (e) { if (window.console) console.error('[shuffle-answers] D failed:', e); }
    if (window.console) {
      console.log('[shuffle-answers] Shuffled: A=' + a + ', B=' + b + ', C=' + c + ', D=' + d);
    }
  }

  function watchForDynamic() {
    if (!window.MutationObserver || !document.body) return;
    var pending = false;
    function flush() {
      pending = false;
      try {
        var c = shufflePatternC(document);
        var d = shufflePatternD();
        if ((c > 0 || d > 0) && window.console) {
          console.log('[shuffle-answers] Dynamic shuffle: C=' + c + ', D=' + d);
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
            if (!pending) { pending = true; setTimeout(flush, 30); }
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
    setTimeout(function () {
      try {
        var c = shufflePatternC(document);
        var d = shufflePatternD();
        if ((c > 0 || d > 0) && window.console) {
          console.log('[shuffle-answers] Late pass: C=' + c + ', D=' + d);
        }
      } catch (e) {}
    }, 500);
    setTimeout(function () {
      try {
        var c = shufflePatternC(document);
        var d = shufflePatternD();
        if ((c > 0 || d > 0) && window.console) {
          console.log('[shuffle-answers] Late pass 2: C=' + c + ', D=' + d);
        }
      } catch (e) {}
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
