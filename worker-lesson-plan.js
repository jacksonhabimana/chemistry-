// ============================================================
// ADD THIS CODE TO YOUR EXISTING CLOUDFLARE WORKER
// (chem-payment.hajackson2020.workers.dev)
// ============================================================
// SETUP STEPS:
// 1. Go to dash.cloudflare.com → Workers & Pages → your worker
// 2. Click "Settings" → "Variables and Secrets"
// 3. Add a NEW secret:  Name: GEMINI_KEY   Value: (your new Gemini key)
// 4. Click "Encrypt" then "Save"
// 5. Paste the route handler below into your existing worker code
// ============================================================

// In your existing worker's fetch handler, ADD this block:
// (inside the existing  if / else if  chain)

// ----- PASTE FROM HERE -----

if (url.pathname === '/lesson-plan' && request.method === 'POST') {

  // Allow requests only from your portal
  const origin = request.headers.get('Origin') || '';
  const allowed = ['https://jacksonhabimana.github.io', 'http://localhost'];
  const isAllowed = allowed.some(o => origin.startsWith(o));
  if (!isAllowed) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const prompt = body.prompt;
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'No prompt provided' }), {
        status: 400, headers: corsHeaders
      });
    }

    // Try Gemini models in order
    const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
    let result = null;
    let lastErr = '';

    for (const model of MODELS) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 3000 }
          })
        }
      );
      if (r.ok) {
        result = await r.json();
        break;
      }
      const errData = await r.json().catch(() => ({}));
      lastErr = errData.error?.message || `HTTP ${r.status}`;
      // Only retry on quota errors
      if (!lastErr.toLowerCase().includes('quota') && r.status !== 429) break;
    }

    if (!result) {
      return new Response(JSON.stringify({ error: 'quota', message: lastErr }), {
        status: 429, headers: corsHeaders
      });
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return new Response(JSON.stringify({ text }), { status: 200, headers: corsHeaders });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: corsHeaders
    });
  }
}

// ----- PASTE TO HERE -----
