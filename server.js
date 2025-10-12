const express = require("express");
const path = require("path");

const app = express();
app.disable("x-powered-by");

// парсеры — не мешают статике
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS на всякий случай
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// статика (работает только на GET/HEAD)
app.use(express.static(path.join(__dirname), {
  extensions: ["html"],
  setHeaders: (res) => res.setHeader("Cache-Control", "no-store")
}));

// ————— API (если нужно) —————
app.get("/api/healthz", (req, res) => res.json({ ok: true, ts: Date.now() }));
// другие /api/* можно добавить выше

// ————— ВАЖНО —————
// Отдаём index.html на ЛЮБОЙ метод и путь, кроме /api/*
const indexPath = path.join(__dirname, "index.html");
app.all("/", (_req, res) => res.sendFile(indexPath));
app.all(/^\/(?!api\/).*/, (_req, res) => res.sendFile(indexPath));

// экспорт для Vercel
module.exports = app;
