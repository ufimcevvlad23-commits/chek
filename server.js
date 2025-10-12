app.post("/api/deal-field", async (req, res) => {
  try {
    const base = (process.env.BITRIX_WEBHOOK_URL || "").trim();
    const { deal, field, value } = req.body || {};
    if (!deal || !field) return res.status(400).json({ ok: false, error: "deal and field are required" });
    if (!base) return res.status(200).json({ ok: false, error: "BITRIX_WEBHOOK_URL not set" });

    const url = base.replace(/\/$/, "/") + "crm.deal.update.json";

    // ---- Попытка 1: urlencoded с вложенными ключами (рекомендуемый формат)
    const form1 = new URLSearchParams();
    form1.set("id", String(deal));
    form1.set(`fields[${field}]`, String(value)); // value — JSON-строка: ["Копия паспорта","Копия СНИЛС"]

    let r = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: form1.toString()
    });
    let raw = await r.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = null; }

    // Если успешно — выходим
    if (data?.result === true) return res.json({ ok: true });

    // Если Битрикс не принял формат — пробуем альтернативный способ
    const form2 = new URLSearchParams();
    const fieldsObj = {}; fieldsObj[field] = String(value);
    form2.set("id", String(deal));
    form2.set("fields", JSON.stringify(fieldsObj));

    r = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: form2.toString()
    });
    raw = await r.text();
    try { data = JSON.parse(raw); } catch { data = null; }

    if (data?.result === true) return res.json({ ok: true });

    // Пробрасываем понятную причину в UI
    const reason = data?.error_description || data?.error || `HTTP ${r.status}`;
    console.error("[Bitrix update error]", reason, raw.slice(0, 600));
    return res.status(200).json({ ok: false, error: reason });

  } catch (e) {
    console.error("[POST /api/deal-field]", e?.message || e);
    return res.status(200).json({ ok: false, error: "write_failed" });
  }
});
