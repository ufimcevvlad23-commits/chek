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

// ---------- ВСПОМОГАТЕЛЬНОЕ: fetch с таймаутом ----------
async function fetchWithTimeout(url, opts = {}, ms = 5000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    return r;
  } finally {
    clearTimeout(t);
  }
}

// ---------- API: чтение поля сделки ----------
app.get("/api/deal-field", async (req, res) => {
  try {
    const base = process.env.BITRIX_WEBHOOK_URL;
    const { deal, field } = req.query || {};
    if (!deal || !field) return res.status(400).json({ ok: false, error: "deal and field are required" });
    if (!base) return res.status(200).json({ ok: false, error: "BITRIX_WEBHOOK_URL not set" });

    const url = new URL(base.replace(/\/$/, "/") + "crm.deal.get.json");
    url.searchParams.set("id", String(deal));

    const r = await fetchWithTimeout(url.toString(), { method: "GET" }, 7000);
    const data = await r.json().catch(() => ({}));
    const value = data?.result?.[field] ?? null;

    return res.json({ ok: true, deal: Number(deal), field, value });
  } catch (e) {
    console.error("[GET /api/deal-field]", e?.message || e);
    return res.status(200).json({ ok: false, error: "read_failed" });
  }
});

// ---------- API: запись поля сделки ----------
app.post("/api/deal-field", async (req, res) => {
  try {
    const base = process.env.BITRIX_WEBHOOK_URL;
    const { deal, field, value } = req.body || {};
    if (!deal || !field) return res.status(400).json({ ok: false, error: "deal and field are required" });
    if (!base) return res.status(200).json({ ok: false, error: "BITRIX_WEBHOOK_URL not set" });

    const url = new URL(base.replace(/\/$/, "/") + "crm.deal.update.json");
    const fields = {}; fields[field] = value; // пишем строку JSON/CSV — как приходит из фронта
    url.searchParams.set("id", String(deal));
    url.searchParams.set("fields", JSON.stringify(fields));

    const r = await fetchWithTimeout(url.toString(), { method: "POST" }, 7000);
    const data = await r.json().catch(() => ({}));

    if (data?.result === true) return res.json({ ok: true });
    return res.status(200).json({ ok: false, error: data?.error_description || "update_failed" });
  } catch (e) {
    console.error("[POST /api/deal-field]", e?.message || e);
    return res.status(200).json({ ok: false, error: "write_failed" });
  }
});

// ---------- Статика + index.html на ЛЮБОЙ метод (важно для Bitrix POST) ----------
app.use(express.static(path.join(__dirname), {
  extensions: ["html"],
  setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
}));

const indexPath = path.join(__dirname, "index.html");
app.all("/", (_req, res) => res.sendFile(indexPath));
app.all(/^\/(?!api\/).*/, (_req, res) => res.sendFile(indexPath));

module.exports = app;
