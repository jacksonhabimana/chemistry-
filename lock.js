/**
 * Jackson Habimana Chemistry Portal — Universal Lock System
 * Fetches lock settings from JSONBin cloud and applies to this page.
 * Include this script in any page to protect it.
 *
 * Pages declare their scope BEFORE including this file:
 *   <script>window.LOCK_SCOPE='s4';</script>
 *   <script src="lock.js"></script>
 *
 * Scopes: 'all' | 's4' | 's5' | 's6' | 's4quiz' | 's5quiz' | 's6quiz' | 'assessment'
 */

(function(){
  // ─── CONFIG ───────────────────────────────────────────────────────────────
  // The teacher sets LOCK_BIN_ID once in teacher-admin → it gets saved to this file via GitHub.
  // Default: empty (no lock). Set this to your JSONBin lock settings bin ID.
  var LOCK_BIN_ID = (window.LOCK_BIN_ID_OVERRIDE || '');
  var SCOPE       = (window.LOCK_SCOPE || 'all');
  var CACHE_KEY   = 'lock_cache';
  var CACHE_TIME  = 30; // seconds to cache lock settings in sessionStorage

  // ─── LOCK OVERLAY HTML ────────────────────────────────────────────────────
  function buildOverlay(msg) {
    var d = document.createElement('div');
    d.id  = 'uni-lock-gate';
    d.style.cssText = [
      'position:fixed;inset:0;background:#0d1117;z-index:99999',
      'display:flex;align-items:center;justify-content:center;padding:24px'
    ].join(';');
    d.innerHTML = [
      '<div style="background:#161b22;border:2px solid rgba(245,158,11,.5);border-radius:16px;',
        'padding:48px 40px;max-width:480px;width:100%;text-align:center;">',
        '<div style="font-size:4rem;margin-bottom:16px;">🔒</div>',
        '<h2 style="font-family:\'Playfair Display\',serif;font-size:2rem;color:#fff;margin-bottom:10px;">',
          'Access Restricted</h2>',
        '<p style="color:#8b949e;font-size:.95rem;margin-bottom:28px;line-height:1.7;">',
          (msg || 'This page is locked by your teacher.<br>Enter the access code to continue.'),
        '</p>',
        '<input id="ulg-inp" type="text" placeholder="Enter Access Code" maxlength="20"',
          ' autocomplete="off" autocorrect="off" spellcheck="false"',
          ' style="width:100%;background:#1c2333;border:2px solid #30363d;border-radius:8px;',
          'color:#e6edf3;padding:14px 18px;font-family:\'JetBrains Mono\',monospace;',
          'font-size:1.5rem;text-align:center;letter-spacing:.25em;text-transform:uppercase;',
          'margin-bottom:12px;box-sizing:border-box;outline:none;"',
          ' onkeydown="if(event.key===\'Enter\')window._unlockPage()"/>',
        '<div id="ulg-err" style="font-family:\'JetBrains Mono\',monospace;font-size:.82rem;',
          'color:#f87171;min-height:22px;margin-bottom:12px;"></div>',
        '<button onclick="window._unlockPage()"',
          ' style="width:100%;background:linear-gradient(135deg,#f59e0b,#d97706);',
          'color:#000;border:none;padding:14px;border-radius:8px;',
          'font-family:\'JetBrains Mono\',monospace;font-size:.95rem;font-weight:700;cursor:pointer;">',
          '🔓 Unlock</button>',
      '</div>'
    ].join('');
    return d;
  }

  function showLock(code, msg) {
    document.documentElement.style.overflow = 'hidden';
    var gate = buildOverlay(msg);
    document.body ? document.body.appendChild(gate) : document.addEventListener('DOMContentLoaded', function(){ document.body.appendChild(gate); });

    window._unlockPage = function(){
      var val = (document.getElementById('ulg-inp') || {}).value;
      if(!val) return;
      val = val.trim().toUpperCase();
      if(val === code){
        sessionStorage.setItem('lock_ok_' + SCOPE, '1');
        var el = document.getElementById('uni-lock-gate');
        if(el) el.remove();
        document.documentElement.style.overflow = '';
      } else {
        var err = document.getElementById('ulg-err');
        if(err) err.textContent = '❌ Wrong code — try again.';
        var inp = document.getElementById('ulg-inp');
        if(inp){ inp.value = ''; inp.focus(); }
      }
    };
  }

  // ─── CHECK IF ALREADY UNLOCKED ───────────────────────────────────────────
  function isGranted() {
    // Check scope-specific + 'all' scope
    return sessionStorage.getItem('lock_ok_' + SCOPE) ||
           sessionStorage.getItem('lock_ok_all');
  }

  // ─── APPLY LOCK SETTINGS ─────────────────────────────────────────────────
  function applySettings(settings) {
    if(!settings || !settings.enabled) return; // no lock active

    var code = settings.code;
    if(!code) return;

    // Determine if THIS page's scope is locked
    var locks = settings.locks || {};
    var locked = false;

    // 'all' locks everything
    if(locks.all) locked = true;

    // specific scope locks
    var scopeMap = {
      's4': locks.s4,
      's5': locks.s5,
      's6': locks.s6,
      's4quiz': locks.s4quiz || locks.s4,
      's5quiz': locks.s5quiz || locks.s5,
      's6quiz': locks.s6quiz || locks.s6,
      'assessment': locks.assessment,
      'all': locks.all
    };
    if(scopeMap[SCOPE]) locked = true;

    if(!locked) return;
    if(isGranted()) return;

    showLock(code, settings.message || null);
  }

  // ─── FETCH SETTINGS FROM JSONBIN ─────────────────────────────────────────
  function fetchSettings(binId) {
    // Check cache first
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if(cached && cached.ts && (Date.now() - cached.ts) < CACHE_TIME * 1000){
        applySettings(cached.data);
        return;
      }
    } catch(e){}

    fetch('https://api.jsonbin.io/v3/b/' + binId + '/latest', {
      headers:{ 'X-Bin-Meta': 'false' }
    })
    .then(function(r){ return r.json(); })
    .then(function(j){
      var data = j.record || j;
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
      applySettings(data);
    })
    .catch(function(){ /* fail silently — don't block page if JSONBin unreachable */ });
  }

  // ─── ENTRY POINT ─────────────────────────────────────────────────────────
  function init() {
    // Already unlocked for this session?
    if(isGranted()) return;

    // Get bin ID: from override variable, or from meta tag, or from localStorage (same device)
    var binId = LOCK_BIN_ID ||
                (document.querySelector('meta[name="lock-bin"]') || {}).content ||
                localStorage.getItem('lock_bin_id') || '';

    if(binId) {
      // Fetch from cloud (cross-device)
      fetchSettings(binId);
    } else {
      // Fallback: same-device mode (teacher set code on same browser)
      var localCode = localStorage.getItem('quiz_access_code');
      if(!localCode) return;
      // Check if this scope is locally locked
      var localLocks = JSON.parse(localStorage.getItem('local_locks') || '{}');
      var locked = localLocks.all || localLocks[SCOPE];
      if(locked) showLock(localCode);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for pages that need it
  window._lockSystem = { init: init, scope: SCOPE };
})();
