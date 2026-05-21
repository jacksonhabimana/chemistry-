// ═══════════════════════════════════════════════════════════════════
//  Jackson Habimana Chemistry Portal — Universal Student Tracker v3
//  Pushes results directly into your existing JSONBin results bin
//  so they appear in teacher-admin → Refresh from Cloud.
//
//  ADD ONE LINE inside <head> on every unit page:
//  <script src="tracker.js"></script>
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

// ── Get JSONBin credentials ───────────────────────────────────────
// Teacher-admin stores these in localStorage after setup
function getCreds(){
  return {
    apiKey:     localStorage.getItem('jsonbin_key')     || '',
    resultsBin: localStorage.getItem('results_bin_id')  || '',
    activityBin:localStorage.getItem('activity_bin_id') || ''
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
      <button onclick="window._trkStart()">▶ Start Assessment</button>
    </div>`;
  document.body.appendChild(gate);

  const banner = document.createElement('div');
  banner.id = '_trk_banner';
  document.body.appendChild(banner);
}

window._trkStart = function(){
  const n = (document.getElementById('_trk_name').value||'').trim();
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
    if(!submitted) flag('Copy','Student used copy (Ctrl+C or selection).');
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
  if(b) b.innerHTML = '⚠️ WARNING #'+cheatCount+': '+event+' — reported to your teacher!';
  // Push cheat ping to activity bin immediately
  pushToCloud({
    student:    studentName,
    studentId:  studentId,
    unit:       unitName,
    type:       'cheat_flag',
    event:      event,
    detail:     detail,
    cheatCount: cheatCount,
    date:       new Date().toISOString()
  }, 'activity');
}

// ════════════════════════════════════════════════════════════════
//  PUSH TO JSONBIN
//  Appends result to the same bins teacher-admin reads from
// ════════════════════════════════════════════════════════════════
async function pushToCloud(resultObj, binType){
  const creds = getCreds();
  const key = creds.apiKey;
  if(!key) return; // API key not configured yet — teacher must set up first

  const binId = binType === 'activity' ? creds.activityBin : creds.resultsBin;
  if(!binId) return;

  try{
    // 1. Fetch current bin contents
    const getResp = await fetch('https://api.jsonbin.io/v3/b/'+binId+'/latest',{
      headers:{'X-Master-Key': key}
    });
    const getData = await getResp.json();
    let arr = getData.record;
    if(!Array.isArray(arr)){
      // activity bin stores {results:[...]}
      arr = arr && arr.results ? arr.results : [];
    }

    // 2. Append new result
    arr.push(resultObj);

    // 3. PUT updated array back
    const putBody = binType === 'activity'
      ? JSON.stringify({results: arr, updated: new Date().toISOString()})
      : JSON.stringify(arr);

    await fetch('https://api.jsonbin.io/v3/b/'+binId,{
      method: 'PUT',
      headers:{'Content-Type':'application/json','X-Master-Key': key},
      body: putBody
    });
  }catch(e){ console.warn('[tracker] cloud push failed:',e); }
}

// ════════════════════════════════════════════════════════════════
//  COLLECT & SEND RESULT
//  Called after quiz/test/exam submit
// ════════════════════════════════════════════════════════════════
function collectAndSend(assessType){
  submitted = true;
  const timeTaken = startTime ? Math.round((Date.now()-startTime)/60000) : 0;

  let score=0, total=0, answers={};
  const pct_calc = ()=> total>0 ? Math.round(score/total*100) : 0;

  // Quiz: use _CA answer key
  if(typeof _CA !== 'undefined'){
    total = Object.keys(_CA).length;
    Object.entries(_CA).forEach(function([q,correct]){
      const sel = document.querySelector('input[name="'+q+'"]:checked');
      answers[q] = sel ? sel.value : '—';
      if(sel && sel.value===correct) score++;
    });
  }

  // Test/Exam: count tq divs
  if(total === 0){
    const tqs = document.querySelectorAll('.tq');
    total = tqs.length || 0;
    tqs.forEach(function(tq,i){
      const viewed = !!tq.querySelector('.answer.open');
      answers['Q'+(i+1)] = viewed ? 'Viewed' : 'Not viewed';
      if(viewed) score++;
    });
  }

  const pct   = pct_calc();
  const grade = pct>=80?'A':pct>=70?'B':pct>=60?'C':pct>=50?'D':'F';
  const now   = new Date().toISOString();

  // ── Format matching what renderResults() in teacher-admin expects ──
  const resultObj = {
    // student_results format
    studentName:  studentName,
    studentId:    studentId,
    examId:       unitName + '_' + assessType + '_' + Date.now(),
    examTitle:    unitName + (assessType ? ' — ' + assessType : ''),
    examSubject:  (unitName.split(' ')[0]||'S') + ' Chemistry',
    score:        score,
    totalMarks:   total,
    percent:      pct,
    grade:        grade,
    passed:       pct >= 50,
    timeTaken:    timeTaken,
    cheatCount:   cheatCount,
    cheatLog:     cheatLog,
    answers:      answers,
    submittedAt:  now,
    type:         assessType || 'quiz',
    // activity format (also stored so activity tab shows it)
    student:      studentName,
    unit:         unitName,
    subunit:      assessType || 'Quiz',
    total:        total,
    date:         now
  };

  // Push to BOTH bins so it shows in all teacher-admin views
  pushToCloud(resultObj, 'results');
  pushToCloud(resultObj, 'activity');
}

// ════════════════════════════════════════════════════════════════
//  HOOK submitQuiz — replace it entirely so it also sends results
// ════════════════════════════════════════════════════════════════
function hookSubmitQuiz(){
  window.submitQuiz = function(){
    // Run scoring + UI
    let score=0, total=Object.keys(_CA).length;
    Object.entries(_CA).forEach(function([q,correct]){
      const sel=document.querySelector('input[name="'+q+'"]:checked');
      document.querySelectorAll('input[name="'+q+'"]').forEach(function(o){
        o.disabled=true;
        if(o.value===correct) o.closest('label').classList.add('correct');
      });
      if(sel){ if(sel.value===correct) score++; else sel.closest('label').classList.add('wrong'); }
      const exp=document.getElementById('e'+q.slice(1));
      if(exp) exp.style.display='block';
    });
    const pct=Math.round(score/total*100);
    const col=pct>=80?'var(--green)':pct>=60?'#fbbf24':'var(--red)';
    const bg=pct>=80?'rgba(52,211,153,.1)':pct>=60?'rgba(251,191,36,.08)':'rgba(248,113,113,.1)';
    const msg=pct>=80?'🏆 Excellent!':pct>=60?'✅ Good — review wrong answers.':'📚 Review and try again.';
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
        +'<div style="font-size:.75rem;margin-top:6px;opacity:.6;">✓ Results sent to teacher</div>';
    }
    const sb=document.querySelector('.qs');
    if(sb){sb.disabled=true;sb.style.opacity='.4';sb.textContent='✓ Submitted';}
    // Send to cloud
    collectAndSend('Quiz');
  };
}

// ════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════
function init(){
  buildGate();
  hookSubmitQuiz();
  // Retry hook after 2s in case _CA loads late
  setTimeout(hookSubmitQuiz, 2000);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', init);
} else { init(); }

})();
