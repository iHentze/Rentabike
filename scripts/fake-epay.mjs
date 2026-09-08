/**
 * A stand-in for payments.epay.eu for local end-to-end runs. Speaks the
 * same shapes the app relies on (see app/lib/payments/epay.ts), serves a
 * fake hosted-fields script, and posts the notification to the app.
 *
 *   node scripts/fake-epay.mjs            # listens on 8790
 *   EPAY_BASE_URL=http://localhost:8790   # in .dev.vars, with any EPAY_API_KEY / EPAY_POS_ID
 */
import http from "node:http";

const PORT = Number(process.env.PORT ?? 8790);
const sessions = new Map();
const calls = [];
let n = 0;

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" });
  res.end(JSON.stringify(body));
};
const read = (req) => new Promise((resolve) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => resolve(b ? JSON.parse(b) : {}));
});

const EPAY_JS = `
const cb = {}; let sid = null;
window.epay = {
  setSessionId(id) { sid = id; return this; },
  setSessionKey() { return this; },
  setCallbacks(c) { Object.assign(cb, c); return this; },
  init() { setTimeout(() => cb.clientReady && cb.clientReady(), 50); },
  mountFields(id) {
    const el = document.getElementById(id);
    el.innerHTML = '<div data-fake-epay style="display:grid;gap:10px"><label>Card number<br><input id="fake-pan" placeholder="4111 1111 1111 1111" style="width:100%;padding:10px;border-radius:10px"></label><label>Expiry<br><input id="fake-exp" placeholder="12/28" style="padding:10px;border-radius:10px"></label></div>';
  },
  clearFields(id) { document.querySelectorAll('#' + id + ' input').forEach((i) => (i.value = '')); },
  async createCardTransaction() {
    const pan = (document.getElementById('fake-pan') || {}).value || '';
    const r = await fetch('http://localhost:${PORT}/fake/complete/' + sid, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pan }) });
    const d = await r.json();
    if (d.declined) cb.transactionDeclined && cb.transactionDeclined({ message: 'Declined by the fake bank' });
    else cb.transactionAccepted && cb.transactionAccepted();
  },
};
`;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;
    if (req.method === "OPTIONS") return json(res, 204, {});
    calls.push(`${req.method} ${path}`);
    if (req.method === "GET" && path === "/epay.js") {
      res.writeHead(200, { "Content-Type": "text/javascript", "Access-Control-Allow-Origin": "*" });
      return res.end(EPAY_JS);
    }
    if (req.method === "GET" && path === "/fake/calls") return json(res, 200, calls);
    if (req.method === "POST" && path === "/cit") {
      const body = await read(req);
      const id = `fake-${++n}-${Date.now().toString(36)}`;
      sessions.set(id, { state: "CREATED", amount: body.amount, reference: body.reference, notificationUrl: body.notificationUrl, instantCapture: body.instantCapture });
      return json(res, 200, { session: { id }, key: `key-${id}`, javascript: `http://localhost:${PORT}/epay.js`, paymentWindowUrl: `http://localhost:${PORT}/window/${id}` });
    }
    let m;
    if ((m = /^\/sessions\/([^/]+)$/.exec(path)) && req.method === "GET") {
      const s = sessions.get(m[1]);
      if (!s) return json(res, 404, { error: "no such session" });
      return json(res, 200, { session: { id: m[1], state: s.state, reference: s.reference }, transaction: s.state === "COMPLETED" ? { id: `tx-${m[1]}`, amount: s.amount } : undefined });
    }
    if ((m = /^\/fake\/complete\/([^/]+)$/.exec(path)) && req.method === "POST") {
      const s = sessions.get(m[1]);
      if (!s) return json(res, 404, { error: "no such session" });
      const { pan } = await read(req);
      if (String(pan).replace(/\s/g, "").endsWith("0002")) return json(res, 200, { declined: true });
      s.state = "COMPLETED";
      // the notification, like the real one: fire and forget, the app re-reads the session
      fetch(s.notificationUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session: { id: m[1], state: "COMPLETED" }, transaction: { id: `tx-${m[1]}` } }) }).catch((e) => console.error("notify failed", e.message));
      return json(res, 200, { ok: true });
    }
    if ((m = /^\/fake\/expire\/([^/]+)$/.exec(path)) && req.method === "POST") {
      const s = sessions.get(m[1]);
      if (s) s.state = "EXPIRED";
      return json(res, 200, { ok: true });
    }
    if ((m = /^\/transactions\/([^/]+)\/(capture|refund|void)$/.exec(path)) && req.method === "POST") {
      const body = await read(req);
      return json(res, 200, { ok: true, transaction: m[1], op: m[2], amount: body.amount ?? null });
    }
    if ((m = /^\/window\/([^/]+)$/.exec(path))) {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`<h1>Fake ePay window</h1><form method="post" action="/fake/complete/${m[1]}"><button>Pay</button></form>`);
    }
    json(res, 404, { error: `no route ${req.method} ${path}` });
  })
  .listen(PORT, () => console.log(`fake ePay on http://localhost:${PORT}`));
