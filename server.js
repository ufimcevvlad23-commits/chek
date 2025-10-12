app.post("/api/deal-field", async (req, res) => {
  try {
    const base = process.env.BITRIX_WEBHOOK_URL;
    const { deal, field, value } = req.body || {};
    if (!deal || !field) return res.status(400).json({ ok: false, error: "deal and field are required" });
    if (!base) return res.status(200).json({ ok: false, error: "BITRIX_WEBHOOK_URL not set" });

    const url = base.replace(/\/$/, "/") + "crm.deal.update.json";

    // ✅ ВАЖНО: urlencoded с ВЛОЖЕННЫМИ ключами, а не одной строкой "fields"
    const form = new URLSearchParams();
    form.set("id", String(deal));
    form.set(`fields[${field}]`, String(value)); // value — JSON-строка массива, например ["Копия паспорта","Копия СНИЛС"]

    // можно добавить опционально: form.set("params[REGISTER_SONET_EVENT]", "N");

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });

    const text = await r.text();                // на всякий логируем сырой ответ
    let data;
    try { data = JSON.parse(text); } catch { data = null; }

    if (data?.result === true) return res.json({ ok: true });
    // пробрасываем причину наверх в UI
    const reason = data?.error_description || data?.error || `HTTP ${r.status}`;
    console.error("[Bitrix update error]", reason, text.slice(0,500));
    return res.status(200).json({ ok: false, error: reason });

  } catch (e) {
    console.error("[POST /api/deal-field]", e?.message || e);
    return res.status(200).json({ ok: false, error: "write_failed" });
  }
});
