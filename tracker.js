// ═══════════════════════════════════════════════════════════════════
//  Jackson Habimana Chemistry Portal — Universal Student Tracker v4
//  Tracks: Quizzes + Tests + Exams + Paper Exams
//  Add inside <head>: <script src="tracker.js"></script>
// ═══════════════════════════════════════════════════════════════════

(function(){

// ── State ────────────────────────────────────────────────────────
let studentName = '';
let studentId   = '';
let cheatCount  = 0;
let cheatLog    = [];
let startTime   = null;
let submitted   = false;
const unitName  = (document.title||'Unknown Unit')
                    .replace('| Jackson Habimana Chemistry Portal','')
                    .replace('|','').trim();

// ── JSONBin credentials (set by teacher-admin) ───────────────────
function getCreds(){
  return {
    key:        localStorage.getItem('jsonbin_key')      || '',
    resultsBin: localStorage.getItem('results_bin_id')   || '',
    activityBin:localStorage.getItem('activity_bin_id')  || ''
  };
}

// ════════════════════════════════════════════════════════════════
//  NAME GATE
// ════════════════════════════════════════════════════════════════
function buildGate(){
  const st = document.createElement('style');
  st.textContent = `
    #_trk_gate{position:fixed;inset:0;background:rgba(13,17,23,.97);z-index:999999;
      display:flex;align-items:center;justify-content:center;padding:24px;
      font-family:'JetBrains Mono',monospace;}
    #_trk_gate .box{background:#161b22;border:2px solid rgba(192,132,252,.55);
      border-radius:16px;padding:44px 36px;max-width:440px;width:100%;text-align:center;}
    #_trk_gate h2{font-family:'Playfair Display',serif;font-size:1.75rem;
      color:#e6edf3;margin:0 0 8px;}
    #_trk_gate p{color:#8b949e;font-size:.88rem;margin:0 0 8px;line-height:1.6;}
    #_trk_gate input{width:100%;background:#1c2333;border:2px solid #30363d;
      border-radius:8px;color:#e6edf3;padding:12px 14px;font-size:.92rem;
      box-sizing:border-box;margin-bottom:6px;outline:none;transition:border .2s;}
    #_trk_gate input:focus{border-color:rgba(192,132,252,.8);}
    #_trk_gate .err{color:#f87171;font-size:.8rem;min-height:16px;margin-bottom:8px;}
    #_trk_gate button{width:100%;background:#c084fc;color:#000;border:none;
      padding:13px;border-radius:8px;font-size:.92rem;font-weight:700;
      cursor:pointer;transition:background .2s;}
    #_trk_gate button:hover{background:#a855f7;}
    #_trk_banner{display:none;position:fixed;top:0;left:0;right:0;z-index:99997;
      background:#7f1d1d;color:#fca5a5;font-size:.8rem;padding:7px 16px;
      text-align:center;font-family:'JetBrains Mono',monospace;}
  `;
  document.head.appendChild(st);

  const gate = document.createElement('div');
  gate.id = '_trk_gate';
  gate.innerHTML = `
    <div class="box">
      <div style="font-size:2.8rem;margin-bottom:12px;">🧪</div>
      <h2>Jackson Chemistry Portal</h2>
      <p>Enter your details to begin.<br>Your results are sent to your teacher.</p>
      <input id="_trk_name" type="text" placeholder="Full Name (e.g. Uwimana Marie)" maxlength="60"
             onkeydown="if(event.key==='Enter')document.getElementById('_trk_id').focus()"/>
      <input id="_trk_id" type="text" placeholder="Class / ID (e.g. S4A, S4MCB)" maxlength="30"
             onkeydown="if(event.key==='Enter')window._trkStart()"/>
      <div class="err" id="_trk_err"></div>
      <button onclick="window._trkStart()">&#9654; Start Assessment</button>
    </div>`;
  document.body.appendChild(gate);

  const banner = document.createElement('div');
  banner.id = '_trk_banner';
  document.body.appendChild(banner);
}

window._trkStart = function(){
  const n  = (document.getElementById('_trk_name').value||'').trim();
  const id = (document.getElementById('_trk_id').value||'').trim();
  if(n.length < 3){
    document.getElementById('_trk_err').textContent = 'Please enter your full name (at least 3 characters).';
    return;
  }
  studentName = n;
  studentId   = id;
  document.getElementById('_trk_gate').style.display   = 'none';
  document.getElementById('_trk_banner').style.display = 'block';
  startTime = Date.now();
  initCheatDetection();
};

// ════════════════════════════════════════════════════════════════
//  CHEAT DETECTION
// ════════════════════════════════════════════════════════════════
function initCheatDetection(){
  document.addEventListener('visibilitychange', function(){
    if(document.hidden && !submitted)
      flag('Tab Switch','Student switched to another tab or minimised window.');
  });
  window.addEventListener('blur', function(){
    if(!submitted) flag('Window Blur','Student clicked outside the browser window.');
  });
  document.addEventListener('contextmenu', function(e){
    if(!submitted){ e.preventDefault(); flag('Right Click','Right-click during assessment.'); }
  });
  document.addEventListener('copy', function(){
    if(!submitted) flag('Copy','Student used copy during assessment.');
  });
  document.addEventListener('keydown', function(e){
    if(!submitted && (e.ctrlKey||e.metaKey) &&
       ['c','v','u','s','p','a'].includes(e.key.toLowerCase()))
      flag('Shortcut','Ctrl+'+e.key.toUpperCase()+' pressed during assessment.');
  });
}

function flag(event, detail){
  cheatCount++;
  cheatLog.push({event, detail, time: new Date().toISOString()});
  const b = document.getElementById('_trk_banner');
  if(b) b.innerHTML = '&#9888; WARNING #'+cheatCount+': '+event+' &mdash; reported to your teacher!';
  pushCloud({
    student:studentName, studentId, unit:unitName,
    type:'cheat_flag', event, detail,
    cheatCount, date:new Date().toISOString()
  }, 'activity');
}

// ════════════════════════════════════════════════════════════════
//  PUSH TO JSONBIN
// ════════════════════════════════════════════════════════════════
async function pushCloud(obj, bin){
  const {key, resultsBin, activityBin} = getCreds();
  if(!key) return;
  const binId = bin==='activity' ? activityBin : resultsBin;
  if(!binId) return;
  try{
    const g = await fetch('https://api.jsonbin.io/v3/b/'+binId+'/latest',
      {headers:{'X-Master-Key':key}});
    const gd = await g.json();
    let arr = Array.isArray(gd.record) ? gd.record
            : (gd.record && gd.record.results ? gd.record.results : []);
    arr.push(obj);
    const body = bin==='activity'
      ? JSON.stringify({results:arr, updated:new Date().toISOString()})
      : JSON.stringify(arr);
    await fetch('https://api.jsonbin.io/v3/b/'+binId,{
      method:'PUT',
      headers:{'Content-Type':'application/json','X-Master-Key':key},
      body
    });
  }catch(e){ console.warn('[tracker] push failed:',e); }
}

// ════════════════════════════════════════════════════════════════
//  BUILD RESULT OBJECT
// ════════════════════════════════════════════════════════════════
function buildResult(assessType, score, total, answers){
  const pct   = total>0 ? Math.round(score/total*100) : 0;
  const grade = pct>=80?'A':pct>=70?'B':pct>=60?'C':pct>=50?'D':'F';
  const now   = new Date().toISOString();
  const time  = startTime ? Math.round((Date.now()-startTime)/60000) : 0;
  return {
    studentName, studentId,
    examId:      unitName+'_'+assessType+'_'+Date.now(),
    examTitle:   unitName+' — '+assessType,
    examSubject: (unitName.split(' ')[0]||'S')+' Chemistry',
    score, totalMarks:total, percent:pct, grade,
    passed:pct>=50, timeTaken:time,
    cheatCount, cheatLog, answers,
    submittedAt:now,
    type:assessType.toLowerCase(),
    // activity format
    student:studentName, unit:unitName,
    subunit:assessType, total, date:now
  };
}

function sendResult(assessType, score, total, answers){
  if(submitted) return;
  submitted = true;
  const r = buildResult(assessType, score, total, answers||{});
  pushCloud(r, 'results');
  pushCloud(r, 'activity');
}

// ════════════════════════════════════════════════════════════════
//  HOOK ALL SUBMIT FUNCTIONS
//  Covers: submitQuiz, submitTest, submitExam, submitPaper,
//          finishExam, finishQuiz, finishTest, completeExam,
//          gradeExam — and any submit button click
// ════════════════════════════════════════════════════════════════

// ── QUIZ (uses _CA answer key) ───────────────────────────────────
function hookQuiz(){
  if(typeof _CA === 'undefined') return;
  window.submitQuiz = function(){
    let score=0, total=Object.keys(_CA).length, answers={};
    Object.entries(_CA).forEach(function([q,correct]){
      const sel=document.querySelector('input[name="'+q+'"]:checked');
      answers[q]=sel?sel.value:'—';
      document.querySelectorAll('input[name="'+q+'"]').forEach(function(o){
        o.disabled=true;
        if(o.value===correct) o.closest('label').classList.add('correct');
      });
      if(sel){ if(sel.value===correct) score++; else sel.closest('label').classList.add('wrong'); }
      const exp=document.getElementById('e'+q.slice(1));
      if(exp) exp.style.display='block';
    });
    // Score UI
    const pct=Math.round(score/total*100);
    const col=pct>=80?'var(--green)':pct>=60?'#fbbf24':'var(--red)';
    const bg=pct>=80?'rgba(52,211,153,.1)':pct>=60?'rgba(251,191,36,.08)':'rgba(248,113,113,.1)';
    const msg=pct>=80?'&#127942; Excellent!':pct>=60?'&#9989; Good &mdash; review wrong answers.':'&#128218; Review and try again.';
    const r=document.getElementById('qR');
    if(r){
      r.style.cssText='display:block;margin-top:20px;border-radius:10px;padding:18px 22px;'
        +'font-family:JetBrains Mono,monospace;text-align:center;background:'+bg
        +';border:2px solid '+col+';color:'+col+';';
      r.innerHTML='<div style="font-size:1.6rem;font-weight:700;margin-bottom:6px;">'
        +score+' / '+total+' ('+pct+'%)</div>'
        +'<div style="font-size:.9rem;margin-bottom:4px;">'+msg+'</div>'
        +'<div style="font-size:.78rem;opacity:.75;">Correct: '+score
        +' | Wrong: '+(total-score)+' | Cheat flags: '+cheatCount+'</div>'
        +'<div style="font-size:.75rem;margin-top:6px;opacity:.6;">&#10003; Results sent to teacher</div>';
    }
    const sb=document.querySelector('.qs');
    if(sb){sb.disabled=true;sb.style.opacity='.4';sb.textContent='&#10003; Submitted';}
    sendResult('Quiz', score, total, answers);
  };
}

// ── TEST (tq divs with reveal buttons) ──────────────────────────
function hookTest(){
  const tqs = document.querySelectorAll('.tq');
  if(!tqs.length) return;
  // Wrap every existing reveal-btn to track when model answers viewed
  // Also hook any submitTest / finishTest function
  const names = ['submitTest','finishTest','completeTest','gradeTest'];
  names.forEach(function(fn){
    if(typeof window[fn]==='function'){
      const orig = window[fn];
      window[fn] = function(){
        orig.apply(this,arguments);
        const answers={};
        tqs.forEach(function(tq,i){
          answers['Q'+(i+1)]=tq.querySelector('.answer.open')?'Viewed':'Not viewed';
        });
        sendResult('Test', document.querySelectorAll('.answer.open').length, tqs.length, answers);
      };
    }
  });
}

// ── EXAM (student-exam / exams.html style) ───────────────────────
function hookExam(){
  const names = ['submitExam','finishExam','completeExam','gradeExam',
                 'submitPaper','finishPaper','submitAnswers','submitResponse'];
  names.forEach(function(fn){
    if(typeof window[fn]==='function'){
      const orig = window[fn];
      window[fn] = function(){
        orig.apply(this,arguments);
        collectExamResult();
      };
    }
  });
}

function collectExamResult(){
  // Try to find score from result display
  let score=0, total=0, answers={}, atype='Exam';
  // MCQ style
  if(typeof _CA!=='undefined'){
    total=Object.keys(_CA).length;
    Object.entries(_CA).forEach(function([q,c]){
      const sel=document.querySelector('input[name="'+q+'"]:checked');
      answers[q]=sel?sel.value:'—';
      if(sel&&sel.value===c) score++;
    });
    atype='Exam Quiz';
  }
  // Structured exam style — count answered textareas/inputs
  if(total===0){
    const inputs=document.querySelectorAll('textarea,input[type="text"]');
    inputs.forEach(function(inp,i){
      if(inp.value&&inp.value.trim().length>2){
        score++; answers['Q'+(i+1)]=inp.value.trim().slice(0,80);
      } else { answers['Q'+(i+1)]='—'; }
      total++;
    });
  }
  sendResult(atype, score, total, answers);
}

// ── SUBMIT BUTTON WATCHER ────────────────────────────────────────
// Catches any submit button not covered by named functions above
function watchSubmitButtons(){
  document.addEventListener('click', function(e){
    const btn = e.target.closest('button,input[type="submit"]');
    if(!btn) return;
    const txt = (btn.textContent||btn.value||'').toLowerCase();
    const isSubmit = ['submit','finish','complete','send result','end exam',
                      'submit exam','submit test','submit quiz'].some(w=>txt.includes(w));
    if(!isSubmit || submitted) return;
    // Give the page's own handler 500ms to run first, then collect
    setTimeout(function(){
      if(submitted) return; // already sent by hooked function
      // Detect what type based on page elements
      let atype='Assessment';
      if(document.getElementById('quiz')||document.querySelector('.quiz-wrap')) atype='Quiz';
      else if(document.getElementById('test')||document.querySelector('.test-section')) atype='Test';
      else if(document.querySelector('.exam-container,.exam-wrap')) atype='Exam';
      collectExamResult();
    }, 500);
  });
}

// ════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════
function init(){
  buildGate();
  hookQuiz();
  hookTest();
  hookExam();
  watchSubmitButtons();
  // Retry all hooks after page scripts fully load
  setTimeout(function(){
    hookQuiz(); hookTest(); hookExam();
  }, 2000);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', init);
} else { init(); }

})();
