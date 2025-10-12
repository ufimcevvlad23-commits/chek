const express = require("express");
const path = require("path");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// ---- fetch-полифилл (устойчиво на любых Node) ----
const fetchPoly = global.fetch
  ? global.fetch.bind(global)
  : (...args) => import("node-fetch").then(({ default: f }) => f(...args));

async function fetchWithTimeout(url, opts = {}, ms = 7000) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  let timer = null;
  try {
    if (controller) {
      timer = setTimeout(() => controller.abort(), ms);
      return await fetchPoly(url, { ...opts, signal: controller.signal });
    } else {
      // Без AbortController — просто без таймаута
      return await fetchPoly(url, opts);
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---- DIAG ----
app.get("/api/diag", (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasFetch: !!global.fetch,
    hasAbortController: typeof AbortController !== "undefined",
    hasEnv: !!process.env.BITRIX_WEBHOOK_URL,
  });
});

// --- API: прочитать значение поля сделки ---
app.get("/api/deal-field", async (req, res) => {
  try {
    const base = (process.env.BITRIX_WEBHOOK_URL || "").trim();
    const { deal, field } = req.query || {};
    if (!deal || !field) return res.status(400).json({ ok: false, error: "deal and field are required" });
    if (!base) return res.status(200).json({ ok: false, error: "BITRIX_WEBHOOK_URL not set" });

    const url = new URL(base.replace(/\/$/, "/") + "crm.deal.get.json");
    url.searchParams.set("id", String(deal));

    const r = await fetchWithTimeout(url.toString(), { method: "GET" });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = {}; }

    const value = data?.result?.[field] ?? null;
    return res.json({ ok: true, deal: Number(deal), field, value });
  } catch (e) {
    console.error("[GET /api/deal-field]", e?.message || e);
    return res.status(200).json({ ok: false, error: "read_failed" });
  }
});

// --- API: записать значение поля сделки (JSON-строка) ---
app.post("/api/deal-field", async (req, res) => {
  try {
    const base = (process.env.BITRIX_WEBHOOK_URL || "").trim();
    const { deal, field, value } = req.body || {};
    if (!deal || !field) return res.status(400).json({ ok: false, error: "deal and field are required" });
    if (!base) return res.status(200).json({ ok: false, error: "BITRIX_WEBHOOK_URL not set" });

    const url = base.replace(/\/$/, "/") + "crm.deal.update.json";

    // ВАЖНО: вложенные ключи для urlencoded
    const form = new URLSearchParams();
    form.set("id", String(deal));
    form.set(`fields[${field}]`, String(value));
    // form.set("params[REGISTER_SONET_EVENT]", "N"); // опционально

    const r = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });

    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch { data = null; }

    if (data?.result === true) return res.json({ ok: true });

    const reason = data?.error_description || data?.error || `HTTP ${r.status}`;
    console.error("[Bitrix update error]", reason, raw.slice(0, 500));
    return res.status(200).json({ ok: false, error: reason });
  } catch (e) {
    console.error("[POST /api/deal-field]", e?.message || e);
    return res.status(200).json({ ok: false, error: "write_failed" });
  }
});

// ---- статика + index.html на ЛЮБОЙ метод ----
app.use(express.static(path.join(__dirname), {
  extensions: ["html"],
  setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
}));
const indexPath = path.join(__dirname, "index.html");
app.all("/", (_req, res) => res.sendFile(indexPath));
app.all(/^\/(?!api\/).*/, (_req, res) => res.sendFile(indexPath));

module.exports = app;
