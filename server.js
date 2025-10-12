// server.js
const express = require("express");
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Простой healthcheck
app.get("/api/healthz", (req, res) => res.json({ ok: true, ts: Date.now() }));

/**
 * /api/trigger
 * Проксирует GET/POST на ваш вебхук Bitrix или любой другой URL.
 * Укажи BITRIX_WEBHOOK_URL в переменных окружения Vercel.
 *
 * Примеры:
 *  GET  /api/trigger?path=task.get&ID=123
 *  POST /api/trigger (body: { path:"task.add", fields:{...} })
 */
app.all("/api/trigger", async (req, res) => {
  try {
    const base = process.env.BITRIX_WEBHOOK_URL; // например: https://your.bitrix24.ru/rest/XX/XXXXXXXX/
    if (!base) return res.status(500).json({ error: "BITRIX_WEBHOOK_URL is not set" });

    // path можно передать через query (?path=crm.lead.list) или body
    const path = (req.query.path || req.body.path || "").replace(/^\//, "");
    if (!path) return res.status(400).json({ error: "Missing `path`" });

    // Собираем URL с query-параметрами
    const url = new URL(base + path);
    // Все query, кроме path, прокидываем дальше
    for (const [k, v] of Object.entries(req.method === "GET" ? req.query : req.body)) {
      if (k === "path") continue;
      // Превращаем объекты в JSON
      url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }

    // GET/POST/… ровно как пришло
    const opts = {
      method: req.method,
      headers: { "Content-Type": "application/json" }
    };
    // Для методов с телом — пробрасываем тело как есть
    if (!["GET", "HEAD"].includes(req.method)) {
      opts.body = JSON.stringify(req.body);
    }

    const r = await fetch(url.toString(), opts);
    const txt = await r.text();

    // Пытаемся отдать JSON если он есть
    try {
      return res.status(r.status).json(JSON.parse(txt));
    } catch {
      return res.status(r.status).send(txt);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Proxy error", details: String(e.message || e) });
  }
});

// Экспорт для Vercel
module.exports = app;
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log("Server listening on " + port));
}
