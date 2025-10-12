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

// helper: fetch с таймаутом
async function fetchWithTimeout(url, opts = {}, ms = 7000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// --- API: прочитать значение поля сделки ---
app.get("/api/deal-field", async (req, res) => {
  try {
    const base = process.env.BITRIX_WEBHOOK_URL; // https://<portal>/rest/<user>/<token>/
    const { deal, field } = req.query || {};
    if (!deal || !field) return res.status(400).json({ ok: false, error: "deal and field are required" });
    if (!base) return res.status(200).json({ ok: false, error: "BITRIX_WEBHOOK_URL not set" });

    const url = new URL(base.replace(/\/$/, "/") + "crm.deal.get.json");
    url.searchParams.set("id", String(deal));

    const r = await fetchWithTimeout(url.toString(), { method: "GET" });
    const data = await r.json().catch(() => ({}));
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
    const base = process.env.BITRIX_WEBHOOK_URL;
    const { deal, field, value } = req.body || {};
    if (!deal || !field) return res.status(400).json({ ok: false, error: "deal and field are required" });
    if (!base) return res.status(200).json({ ok: false, error: "BITRIX_WEBHOOK_URL not set" });

    const url = base.replace(/\/$/, "/") + "crm.deal.update.json";

    const fields = {};               // пишем как строку JSON
    fields[field] = value;           // пример: '["Копия паспорта","Копия СНИЛС"]'

    // Bitrix любит x-www-form-urlencoded в ТЕЛЕ
    const form = new URLSearchParams();
    form.set("id", String(deal));
    form.set("fields", JSON.stringify(fields));

    const r = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });
    const data = await r.json().catch(() => ({}));

    if (data?.result === true) return res.json({ ok: true });
    return res.status(200).json({ ok: false, error: data?.error_description || "update_failed" });
  } catch (e) {
    console.error("[POST /api/deal-field]", e?.message || e);
    return res.status(200).json({ ok: false, error: "write_failed" });
  }
});

// --- статика + index.html на ЛЮБОЙ метод (Bitrix часто шлёт POST) ---
app.use(express.static(path.join(__dirname), {
  extensions: ["html"],
  setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
}));
const indexPath = path.join(__dirname, "index.html");
app.all("/", (_req, res) => res.sendFile(indexPath));
app.all(/^\/(?!api\/).*/, (_req, res) => res.sendFile(indexPath));

module.exports = app;
