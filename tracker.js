// ═══════════════════════════════════════════════════════════════════
//  Jackson Habimana Chemistry Portal — Universal Student Tracker
//  v2.0 — Works on ALL pages (quizzes, tests, exams, exercises)
//
//  HOW TO USE: Add ONE line inside <head> on every page:
//  <script src="tracker.js"></script>
//
//  Then set your Web App URL below after deploying Google Apps Script.
// ═══════════════════════════════════════════════════════════════════

(function(){

// ── ① CONFIG — paste your Google Apps Script Web App URL here ──────
const APPS_SCRIPT_URL = 'PASTE_YOUR_WEB_APP_URL_HERE';
// ───────────────────────────────────────────────────────────────────

/* ── State ── */
let studentName  = '';
let cheatCount   = 0;
let cheatLog     = [];
let startTime    = null;
let submitted    = false;
let assessType   = 'Assessment';
const unitName   = (document.title || 'Unknown Unit')
                     .replace('| Jackson Habimana Chemistry Portal','')
                     .replace('|','').trim();

/* ══════════════════════════════════════════════════════════════════
   ② NAME GATE — shown on every page before student can interact
══════════════════════════════════════════════════════════════════ */
function buildGate(){
  const style = document.createElement('style');
  style.textContent = `
    #_trk_gate{position:fixed;inset:0;background:rgba(13,17,23,.97);z-index:999999;
      display:flex;align-items:center;justify-content:center;padding:24px;font-family:'JetBrains Mono',monospace;}
    #_trk_gate .box{background:#161b22;border:2px solid rgba(192,132,252,.55);border-radius:16px;
      padding:44px 36px;max-width:440px;width:100%;text-align:center;}
    #_trk_gate h2{font-family:'Playfair Display',serif;font-size:1.75rem;color:#e6edf3;margin:0 0 8px;}
    #_trk_gate p{color:#8b949e;font-size:.88rem;margin:0 0 22px;line-height:1.6;}
    #_trk_gate input{width:100%;background:#1c2333;border:2px solid #30363d;border-radius:8px;
      color:#e6edf3;padding:13px 16px;font-size:.95rem;box-sizing:border-box;margin-bottom:6px;
      outline:none;transition:border .2s;}
    #_trk_gate input:focus{border-color:rgba(192,132,252,.8);}
    #_trk_gate .err{color:#f87171;font-size:.8rem;min-height:18px;margin-bottom:10px;}
    #_trk_gate button{width:100%;background:#c084fc;color:#000;border:none;padding:13px;
      border-radius:8px;font-size:.92rem;font-weight:700;cursor:pointer;transition:background .2s;}
    #_trk_gate button:hover{background:#a855f7;}
    #_trk_banner{display:none;position:fixed;top:0;left:0;right:0;z-index:99997;
      background:#7f1d1d;color:#fca5a5;font-size:.8rem;padding:7px 16px;text-align:center;
      font-family:'JetBrains Mono',monospace;}
  `;
  document.head.appendChild(style);

  const gate = document.createElement('div');
  gate.id = '_trk_gate';
  gate.innerHTML = `
    <div class="box">
      <div style="font-size:3rem;margin-bottom:12px;">🧪</div>
      <h2>Jackson Chemistry Portal</h2>
      <p>Enter your full name to begin.<br>Your results will be sent to your teacher.</p>
      <input id="_trk_name" type="text" placeholder="e.g. Uwimana Marie Claire" maxlength="60"
             onkeydown="if(event.key==='Enter')window._trkStart()"/>
      <div class="err" id="_trk_err"></div>
      <button onclick="window._trkStart()">▶ Start</button>
    </div>`;
  document.body.appendChild(gate);

  const banner = document.createElement('div');
  banner.id = '_trk_banner';
  document.body.appendChild(banner);
}

window._trkStart = function(){
  const v = (document.getElementById('_trk_name').value || '').trim();
  if(v.length < 3){
    document.getElementById('_trk_err').textContent = 'Please enter your full name (at least 3 characters).';
    return;
  }
  studentName = v;
  document.getElementById('_trk_gate').style.display = 'none';
  document.getElementById('_trk_banner').style.display = 'block';
  startTime = Date.now();
  initCheatDetection();
};

/* ══════════════════════════════════════════════════════════════════
   ③ CHEAT DETECTION
══════════════════════════════════════════════════════════════════ */
function initCheatDetection(){
  document.addEventListener('visibilitychange', function(){
    if(document.hidden && !submitted)
      flagCheat('Tab Switch','Student switched tab or minimised window.');
  });
  window.addEventListener('blur', function(){
    if(!submitted) flagCheat('Window Blur','Student clicked outside the browser window.');
  });
  document.addEventListener('contextmenu', function(e){
    if(!submitted){ e.preventDefault(); flagCheat('Right Click','Student right-clicked (possible copy attempt).'); }
  });
  document.addEventListener('copy', function(){
    if(!submitted) flagCheat('Copy Detected','Student used copy (Ctrl+C or selection copy).');
  });
  document.addEventListener('keydown', function(e){
    if(!submitted && (e.ctrlKey||e.metaKey) && ['c','v','u','s','p','a'].includes(e.key.toLowerCase()))
      flagCheat('Keyboard Shortcut','Used Ctrl+'+e.key.toUpperCase()+' during assessment.');
  });
}

function flagCheat(event, details){
  cheatCount++;
  cheatLog.push({event, details, time: new Date().toISOString()});
  const b = document.getElementById('_trk_banner');
  if(b) b.innerHTML = '⚠️ WARNING #'+cheatCount+': '+event+' — this is reported to your teacher!';
  sendData({type:'cheat', studentName, unit:unitName,
    assessmentType:detectAssessType(), event, details,
    totalFlags:cheatCount});
}

function detectAssessType(){
  if(document.getElementById('quiz'))     return 'Quiz';
  if(document.getElementById('test'))     return 'Test';
  if(document.getElementById('exam'))     return 'Exam';
  if(document.getElementById('exercises'))return 'Exercise';
  return 'Assessment';
}

/* ══════════════════════════════════════════════════════════════════
   ④ HOOK INTO ALL SUBMIT FUNCTIONS
   Wraps submitQuiz / submitTest / submitExam automatically
══════════════════════════════════════════════════════════════════ */
function hookSubmits(){
  // Wait for page scripts to load, then wrap
  ['submitQuiz','submitTest','submitExam'].forEach(function(fnName){
    const original = window[fnName];
    if(typeof original === 'function'){
      window[fnName] = function(){
        original.apply(this, arguments);          // run original first
        collectAndSend(fnName.replace('submit',''));
      };
    }
  });

  // Also watch for reveal-btn clicks on test/exam (model answers)
  document.addEventListener('click', function(e){
    if(e.target && e.target.classList.contains('reveal-btn')){
      // Not a submit — just track that student viewed a model answer
      // (no data sent for this, just local interaction)
    }
  });
}

/* ══════════════════════════════════════════════════════════════════
   ⑤ COLLECT RESULTS & SEND
══════════════════════════════════════════════════════════════════ */
function collectAndSend(type){
  submitted = true;
  const timeTaken = startTime ? Math.round((Date.now()-startTime)/60000) : 0;
  assessType = type || detectAssessType();

  // Quiz: use _CA answer key if available
  let score = 0, total = 0, answers = {};
  if(typeof _CA !== 'undefined'){
    total = Object.keys(_CA).length;
    Object.entries(_CA).forEach(function([q,correct]){
      const sel = document.querySelector('input[name="'+q+'"]:checked');
      answers[q] = sel ? sel.value : '—';
      if(sel && sel.value === correct) score++;
    });
  }

  // Test/Exam: count questions answered (reveal-btn clicked = viewed)
  if(total === 0){
    const tqs = document.querySelectorAll('.tq');
    total = tqs.length;
    score = document.querySelectorAll('.answer.open').length; // answered/revealed
    tqs.forEach(function(tq, i){
      answers['Q'+(i+1)] = tq.querySelector('.answer.open') ? 'Viewed' : 'Not viewed';
    });
    assessType = type === 'Quiz' ? 'Quiz' : 'Test/Exam';
  }

  const pct = total > 0 ? Math.round(score/total*100) : 0;

  sendData({
    type:         'result',
    studentName:  studentName,
    unit:         unitName,
    assessmentType: assessType,
    score:        score,
    total:        total,
    pct:          pct,
    timeTaken:    timeTaken,
    cheatCount:   cheatCount,
    cheatLog:     cheatLog,
    answers:      answers
  });
}

/* ══════════════════════════════════════════════════════════════════
   ⑥ SEND TO GOOGLE APPS SCRIPT
══════════════════════════════════════════════════════════════════ */
function sendData(payload){
  if(!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'PASTE_YOUR_WEB_APP_URL_HERE') return;
  try{
    fetch(APPS_SCRIPT_URL, {
      method: 'POST', mode: 'no-cors',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
  }catch(e){}
}

/* ══════════════════════════════════════════════════════════════════
   ⑦ INIT — run after DOM ready
══════════════════════════════════════════════════════════════════ */
function init(){
  buildGate();
  // Hook submit functions (some may not exist yet — retry after 2s for lazy scripts)
  hookSubmits();
  setTimeout(hookSubmits, 2000);
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
