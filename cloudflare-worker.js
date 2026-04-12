// ═══════════════════════════════════════════════════════════
// JACKSON HABIMANA CHEMISTRY PORTAL — PawaPay Proxy Worker
// Deploy this on Cloudflare Workers (free plan)
// ═══════════════════════════════════════════════════════════

// PUT YOUR PAWAPAY API TOKEN HERE:
const PAWAPAY_TOKEN = 'YOUR_PAWAPAY_API_TOKEN_HERE';
const PAWAPAY_BASE  = 'https://api.pawapay.io';

// Only allow requests from your GitHub Pages site
const ALLOWED_ORIGINS = [
  'https://jacksonhabimana.github.io',
  'https://jacksonhabimana.github.io/chemistry',
  'http://localhost',        // for local testing
];

export default {
  async fetch(request, env) {

    const origin = request.headers.get('Origin') || '';

    // ── CORS preflight ──
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, origin);
    }

    // ── Only allow POST and GET ──
    if (!['POST','GET'].includes(request.method)) {
      return corsResponse(JSON.stringify({error:'Method not allowed'}), 405, origin);
    }

    const url = new URL(request.url);
    const path = url.pathname; // e.g. /deposit  or  /status/dep_123

    // ── Route: POST /deposit — initiate payment ──
    if (request.method === 'POST' && path === '/deposit') {
      try {
        const body = await request.json();

        // Validate required fields
        if (!body.phone || !body.amount || !body.currency || !body.correspondent) {
          return corsResponse(JSON.stringify({error:'Missing required fields'}), 400, origin);
        }

        const depositId = 'dep_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);

        const ppResp = await fetch(PAWAPAY_BASE + '/deposits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + PAWAPAY_TOKEN,
          },
          body: JSON.stringify({
            depositId,
            amount:   String(body.amount),
            currency: body.currency,
            correspondent: body.correspondent,
            payer: {
              type: 'MSISDN',
              address: { value: body.phone }
            },
            statementDescription: 'ChemNotes ' + (body.item || '').substring(0, 20),
          }),
        });

        const data = await ppResp.json();
        return corsResponse(JSON.stringify({ ...data, depositId }), ppResp.status, origin);

      } catch(e) {
        return corsResponse(JSON.stringify({error: e.message}), 500, origin);
      }
    }

    // ── Route: GET /status/:depositId — check payment status ──
    if (request.method === 'GET' && path.startsWith('/status/')) {
      const depositId = path.replace('/status/', '');
      if (!depositId) {
        return corsResponse(JSON.stringify({error:'No deposit ID'}), 400, origin);
      }

      try {
        const ppResp = await fetch(PAWAPAY_BASE + '/deposits/' + depositId, {
          headers: { 'Authorization': 'Bearer ' + PAWAPAY_TOKEN },
        });
        const data = await ppResp.json();
        return corsResponse(JSON.stringify(data), ppResp.status, origin);

      } catch(e) {
        return corsResponse(JSON.stringify({error: e.message}), 500, origin);
      }
    }

    // ── 404 for anything else ──
    return corsResponse(JSON.stringify({error:'Not found'}), 404, origin);
  }
};

// ── Helper: add CORS headers to every response ──
function corsResponse(body, status, origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  return new Response(body, { status, headers });
}
