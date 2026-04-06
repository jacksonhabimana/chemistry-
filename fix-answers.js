// fix-answers.js — Universal Show Answer button fix for all S4 unit pages
// Works on any button that shows/hides an answer, regardless of how it was originally coded

document.addEventListener('DOMContentLoaded', function () {

  // Fix all buttons that have inline onclick with toggle logic
  // Also fix any button with class: show-ans, sa, btn-ans, show-answer, showAnswer
  var selectors = [
    '.show-ans',
    '.sa',
    '.btn-ans',
    '.show-answer',
    '[class*="show-ans"]',
    '[class*="showAns"]',
    '[class*="show_ans"]'
  ];

  // Collect all matching buttons
  var buttons = document.querySelectorAll(selectors.join(','));

  buttons.forEach(function (btn) {
    // Remove broken onclick
    btn.removeAttribute('onclick');

    btn.addEventListener('click', function () {
      // Look for the answer element — try next sibling, then parent's next sibling
      var ans = findAnswer(this);
      if (ans) {
        ans.style.display = 'block';
        this.style.display = 'none';
      }
    });
  });

  // Also fix any button whose text is "Show Answer", "Show", "Reveal", "See Answer"
  var allButtons = document.querySelectorAll('button');
  allButtons.forEach(function (btn) {
    var txt = btn.textContent.trim().toLowerCase();
    if (txt === 'show answer' || txt === 'show' || txt === 'reveal answer' || txt === 'see answer' || txt === 'show mark scheme') {
      btn.removeAttribute('onclick');
      btn.addEventListener('click', function () {
        var ans = findAnswer(this);
        if (ans) {
          ans.style.display = 'block';
          this.style.display = 'none';
        }
      });
    }
  });

  function findAnswer(btn) {
    // Strategy 1: next element sibling
    var next = btn.nextElementSibling;
    if (next) return next;

    // Strategy 2: parent's next sibling
    var parentNext = btn.parentElement && btn.parentElement.nextElementSibling;
    if (parentNext) return parentNext;

    // Strategy 3: look for .answer, .ans, .answer-text inside parent
    var parent = btn.parentElement;
    if (parent) {
      var ansEl = parent.querySelector('.answer, .ans, .answer-text, .mark-scheme, [class*="answer"], [class*="Answer"]');
      if (ansEl) return ansEl;
    }

    return null;
  }

  // Also fix quiz SUBMIT buttons if they are broken
  var submitBtns = document.querySelectorAll('[id*="submit"], [class*="submit"], button[onclick*="submit"], button[onclick*="Submit"]');
  submitBtns.forEach(function(btn) {
    var originalOnclick = btn.getAttribute('onclick');
    if (originalOnclick && originalOnclick.includes('submitQuiz')) {
      btn.removeAttribute('onclick');
      btn.addEventListener('click', function() {
        try {
          // Try to evaluate the original function name
          var fnMatch = originalOnclick.match(/(\w+)\(/);
          if (fnMatch && window[fnMatch[1]]) {
            window[fnMatch[1]]();
          }
        } catch(e) {
          // If quiz function doesn't exist, show a simple score
          showSimpleScore();
        }
      });
    }
  });

  function showSimpleScore() {
    var answered = document.querySelectorAll('.ans[style*="block"], .answer[style*="block"]').length;
    var total = document.querySelectorAll('.show-ans, .sa').length + answered;
    alert('Quiz complete! You revealed ' + answered + ' of ' + total + ' answers.');
  }

});
