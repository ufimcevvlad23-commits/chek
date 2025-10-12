// server.js — только API (страницу отдаёт Vercel Static)
const express = require("express");
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ——— диагностика
app.get("/api/diag", (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    hasEnv: !!process.env.BITRIX_WEBHOOK_URL,
  });
});

// ——— чтение поля сделки
app.get("/api/deal-field", async (req, res) => {
  try {
    const base = (process.env.BITRIX_WEBHOOK_URL || "").trim();
    const { deal, field } = req.query || {};
    if (!deal || !field) return res.status(400).json({ ok: false, error: "deal and field are required" });
    if (!base) return res.status(200).json({ ok: false, error: "BITRIX_WEBHOOK_URL not set" });

    const url = new URL(base.replace(/\/$/, "/") + "crm.deal.get.json");
    url.searchParams.set("id", String(deal));

    const r = await fetch(url.toString(), { method: "GET" });
    const text = await r.text();
    let data; try { data = JSON.parse(text); } catch { data = {}; }

    const value = data?.result?.[field] ?? null;
    return res.json({ ok: true, deal: Number(deal), field, value });
  } catch (e) {
    console.error("[GET /api/deal-field]", e?.message || e);
    return res.status(200).json({ ok: false, error: "read_failed" });
  }
});

// ——— запись поля сделки (пишем JSON-строку массива)
app.post("/api/deal-field", async (req, res) => {
  try {
    const base = (process.env.BITRIX_WEBHOOK_URL || "").trim();
    const { deal, field, value } = req.body || {};
    if (!deal || !field) return res.status(400).json({ ok: false, error: "deal and field are required" });
    if (!base) return res.status(200).json({ ok: false, error: "BITRIX_WEBHOOK_URL not set" });

    const url = base.replace(/\/$/, "/") + "crm.deal.update.json";

    // Попытка 1: urlencoded с вложенными ключами
    const form1 = new URLSearchParams();
    form1.set("id", String(deal));
    form1.set(`fields[${field}]`, String(value));

    let r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: form1.toString()
    });

    let raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch { data = null; }
    if (data?.result === true) return res.json({ ok: true });

    // Попытка 2: fields как JSON
    const form2 = new URLSearchParams();
    const fieldsObj = {}; fieldsObj[field] = String(value);
    form2.set("id", String(deal));
    form2.set("fields", JSON.stringify(fieldsObj));

    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: form2.toString()
    });

    raw = await r.text();
    try { data = JSON.parse(raw); } catch { data = null; }

    if (data?.result === true) return res.json({ ok: true });

    const reason = data?.error_description || data?.error || `HTTP ${r.status}`;
    console.error("[Bitrix update error]", reason, raw.slice(0, 600));
    return res.status(200).json({ ok: false, error: reason });
  } catch (e) {
    console.error("[POST /api/deal-field]", e?.message || e);
    return res.status(200).json({ ok: false, error: "write_failed" });
  }
});

module.exports = app;
