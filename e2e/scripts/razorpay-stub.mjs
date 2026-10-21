// A stand-in for Razorpay's API, used only by the browser tests: it hands out order ids, accepts refunds and remembers every call so a test can check the amounts.
import { createServer } from "node:http";

const calls = [];
let n = 0;

createServer((req, res) => {
  const json = (status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.method === "GET" && req.url === "/health") return json(200, { ok: true });
  if (req.method === "GET" && req.url === "/calls") return json(200, calls);
  if (req.method === "DELETE" && req.url === "/calls") { calls.length = 0; return json(200, { ok: true }); }

  let raw = "";
  req.on("data", (c) => { raw += c; });
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    const url = req.url ?? "";
    calls.push({ method: req.method, path: url, body });
    n += 1;
    if (url === "/orders") return json(200, { id: `order_stub_${n}`, amount: body.amount, currency: body.currency, status: "created" });
    if (/^\/payments\/[^/]+\/refund$/.test(url)) return json(200, { id: `rfnd_stub_${n}`, amount: body.amount, status: "processed" });
    json(404, { error: { description: "not part of the stand-in" } });
  });
}).listen(4198, "127.0.0.1");
