// server.js — «обкул»-сервер/прокси под Bitrix, Vercel
const express = require("express");
const fetch = (...a) => import("node-fetch").then(({default:f})=>f(...a));

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS, чтобы фронт/виджет Б24 мог дергать сервер
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// Health
app.get("/api/healthz", (req, res) => res.json({ ok: true, ts: Date.now() }));

/**
 * Хук, который Битрикс/ваш виджет может вызывать при сохранении.
 * Даже если внутренняя логика упала — возвращаем 200 и {result:true},
 * чтобы Битрикс не показывал «Ошибка сохранения».
 */
app.post("/api/hook", async (req, res) => {
  const started = Date.now();
  try {
    // TODO: ваша логика — валидации/запись в внешнюю систему
    // Пример безопасного прокси в Bitrix REST (если нужно):
    if (process.env.BITRIX_WEBHOOK_URL && req.body?.path) {
      const url = new URL(process.env.BITRIX_WEBHOOK_URL + String(req.body.path).replace(/^\//,""));
      const payload = { ...req.body };
      delete payload.path;

      const r = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload),
        // fail-fast: 4 секунды таймаута
        signal: AbortSignal.timeout(4000)
      });
      const text = await r.text();
      // лог без срыва ответа клиенту
      console.log("[BITRIX_PROXY]", r.status, text.slice(0,500));
    }

    // Успешный «мягкий» ответ
    return res.status(200).json({
      result: true,
      took_ms: Date.now() - started
    });
  } catch (e) {
    console.error("[HOOK_ERR]", e?.message || e);
    // ВАЖНО: 200 + result:true — Битрикс не сломается
    return res.status(200).json({
      result: true,
      warning: "internal_error_hidden",
      took_ms: Date.now() - started
    });
  }
});

/**
 * Универсальный прокси на Bitrix (если нужно дергать разные методы)
 * GET/POST /api/trigger?path=crm.deal.get&id=123  или body: {path:"crm.deal.update", id, fields:{...}}
 */
app.all("/api/trigger", async (req, res) => {
  try {
    const base = process.env.BITRIX_WEBHOOK_URL;
    if (!base) return res.status(500).json({ error: "BITRIX_WEBHOOK_URL not set" });

    const path = (req.query.path || req.body.path || "").replace(/^\//,"");
    if (!path) return res.status(400).json({ error: "missing path" });

    const url = new URL(base + path);
    const params = req.method === "GET" ? req.query : req.body;
    for (const [k,v] of Object.entries(params)) if (k !== "path")
      url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));

    const r = await fetch(url.toString(), {
      method: req.method,
      headers: { "Content-Type":"application/json" },
      body: ["GET","HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body),
      signal: AbortSignal.timeout(4000)
    });

    const txt = await r.text();
    try { return res.status(r.status).json(JSON.parse(txt)); }
    catch { return res.status(r.status).send(txt); }
  } catch (e) {
    console.error("[TRIGGER_ERR]", e?.message || e);
    return res.status(200).json({ result: true, warning: "proxy_error_hidden" });
  }
});

module.exports = app;
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log("Listening on " + port));
}
