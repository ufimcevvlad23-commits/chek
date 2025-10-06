import fetch from "node-fetch";
import FormData from "form-data";

export default async function handler(req, res) {
  const BITRIX_WEBHOOK = "https://nta-company.bitrix24.ru/rest/56435/j7rzo0xhs0ityawj/";
  const CATEGORY_ID = 44;
  const STAGE_ID = "C44:NEW";
  const HH_ACCESS_TOKEN = "USERH6FI4QDCTBSH4Q35V15LBQ50JGO2HUTHI4SPALKNCJID7DQ87BU8IDJCLUMT";

  try {
    const hhResponse = await fetch("https://api.hh.ru/negotiations", {
      headers: { Authorization: `Bearer ${HH_ACCESS_TOKEN}` },
    });

    const data = await hhResponse.json();
    const created = [];

    for (const r of data.items || []) {
      const resume = r.resume || {};
      const name = resume.fio || "Без имени";
      const dealData = {
        fields: {
          TITLE: `Кандидат HH.ru: ${name}`,
          CATEGORY_ID: CATEGORY_ID,
          STAGE_ID: STAGE_ID,
        },
      };

      const bitrixRes = await fetch(`${BITRIX_WEBHOOK}crm.deal.add.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dealData),
      });

      const bitrixData = await bitrixRes.json();
      created.push({ dealId: bitrixData.result, name });
    }

    res.status(200).json({ status: "ok", created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
