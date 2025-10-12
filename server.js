const express = require("express");
const path = require("path");

// --- настройки ---
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS на всякий (не мешает iFrame)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// Раздаём статику из корня репозитория (index.html, css, js, картинки)
app.use(express.static(path.join(__dirname), {
  extensions: ["html"],
  setHeaders: (res, filePath) => {
    // без жёсткого кэша, чтобы Bitrix не показывал "resource was not cached"
    res.setHeader("Cache-Control", "no-store");
  }
}));

// --- API (необязательно, но пусть будет) ---
app.get("/api/healthz", (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// здесь могут быть другие /api/* маршруты
// app.post("/api/hook", ...)

// --- ВАЖНО ---
// Всё прочее — на index.html (чтобы виджет всегда показывался)
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Экспорт для Vercel
module.exports = app;
