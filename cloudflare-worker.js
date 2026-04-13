// ═══════════════════════════════════════════════
// Jackson Habimana Chemistry Portal
// PawaPay Proxy Worker — Cloudflare Worker
// ═══════════════════════════════════════════════
// SETUP: Add your PawaPay token as environment
// variable named: PAWAPAY_TOKEN
// ═══════════════════════════════════════════════

export default {
  async fetch(request, env) {
    const ALLOWED_ORIGIN = 'https://jacksonhabimana.github.io';
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };
    // Use sandbox if SANDBOX variable is set to 'true', otherwise live
    const BASE = (env.SANDBOX === 'true')
      ? 'https://api.sandbox.pawapay.io'
      : 'https://api.pawapay.io';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // POST /deposit — create payment
    if (request.method === 'POST' && path === '/deposit') {
      try {
        const body = await request.json();
        const response = await fetch(BASE + '/deposits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + env.PAWAPAY_TOKEN,
          },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers: cors });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
      }
    }

    // GET /deposit?id=xxx — check status
    if (request.method === 'GET' && path === '/deposit') {
      const depositId = url.searchParams.get('id');
      if (!depositId) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: cors });
      try {
        const response = await fetch(BASE + '/deposits/' + depositId, {
          headers: { 'Authorization': 'Bearer ' + env.PAWAPAY_TOKEN },
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), { status: response.status, headers: cors });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: cors });
  }
};
