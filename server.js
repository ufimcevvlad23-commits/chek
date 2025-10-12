// server.js
const express = require("express");
const path = require("path");
const fetch = (...a) => import("node-fetch").then(({default:f})=>f(...a));

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS (не мешает iFrame)
app.use((req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// ===== API: прочитать поле сделки =====
app.get("/api/deal-field", async (req, res) => {
  try {
    const base = process.env.BITRIX_WEBHOOK_URL; // https://<portal>/rest/<user>/<token>/
    const { deal, field } = req.query;
    if (!base) return res.status(500).json({ error: "BITRIX_WEBHOOK_URL not set" });
    if (!deal || !field) return res.status(400).json({ error: "deal and field are required" });

    const url = new URL(base.replace(/\/$/,"/") + "crm.deal.get.json");
    url.searchParams.set("id", String(deal));

    const r = await fetch(url.toString(), { method: "GET", signal: AbortSignal.timeout(5000) });
    const data = await r.json();
    const value = data?.result?.[field] ?? null;

    return res.json({ ok: true, deal: Number(deal), field, value });
  } catch (e) {
    console.error("[deal-field:get]", e);
    return res.status(200).json({ ok: false, error: "read_failed" });
  }
});

// ===== API: записать поле сделки =====
app.post("/api/deal-field", async (req, res) => {
  try {
    const base = process.env.BITRIX_WEBHOOK_URL;
    const { deal, field, value } = req.body || {};
    if (!base) r
