import fetch from "node-fetch";

// Переменные окружения
const BITRIX_WEBHOOK = process.env.BITRIX_WEBHOOK || "https://nta-company.bitrix24.ru/rest/56435/j7rzo0xhs0ityawj/";
const CATEGORY_ID = process.env.BITRIX_CATEGORY_ID || 44;
const STAGE_ID = process.env.BITRIX_STAGE_ID || "C44:NEW";
const HH_ACCESS_TOKEN = process.env.HH_ACCESS_TOKEN || "USERH6FI4QDCTBSH4Q35V15LBQ50JGO2HUTHI4SPALKNCJID7DQ87BU8IDJCLUMT";

// Получение откликов с HH.ru
async function getResponses() {
  const res = await fetch("https://api.hh.ru/negotiations", {
    headers: { Authorization: `Bearer ${HH_ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error("Ошибка при запросе к HH.ru");
  const data = await res.json();
  return data.items || [];
}

// Скачивание резюме в PDF
async function getResumePDF(resumeId) {
  const pdfUrl = `https://api.hh.ru/resumes/${resumeId}/download`;
  const pdfRes = await fetch(pdfUrl, { headers: { Authorization: `Bearer ${HH_ACCESS_TOKEN}` } });
  if (!pdfRes.ok) return null;
  const buffer = await pdfRes.arrayBuffer();
  return Buffer.from(buffer);
}

// Создание сделки в Bitrix24
async function createDealInBitrix(name) {
  const url = `${BITRIX_WEBHOOK}crm.deal.add.json`;
  const dealData = {
    fields: {
      TITLE: `Кандидат HH.ru: ${name}`,
      CATEGORY_ID: CATEGORY_ID,
      STAGE_ID: STAGE_ID,
      COMMENTS: `Создано автоматически ${new Date().toLocaleString("ru-RU")}`,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dealData),
  });
  const data = await res.json();
  return data.result;
}

// Прикрепление PDF-файла к сделке
async function attachPDFToDeal(dealId, pdfBuffer, resumeId) {
  const url = `${BITRIX_WEBHOOK}crm.deal.file.add.json?id=${dealId}`;
  const formData = new FormData();
  formData.append("file", new Blob([pdfBuffer]), `${resumeId}.pdf`);
  await fetch(url, { method: "POST", body: formData });
}

// Основная функция (обработчик Vercel)
export default async function handler(req, res) {
  try {
    const responses = await getResponses();
    const created = [];

    for (const r of responses) {
      const resume = r.resume || {};
      const name = resume.fio || "Без имени";
      const resumeId = resume.id;

      const dealId = await createDealInBitrix(name);

      if (dealId && resumeId) {
        const pdfBuffer = await getResumePDF(resumeId);
        if (pdfBuffer) await attachPDFToDeal(dealId, pdfBuffer, resumeId);
      }

      created.push({ dealId, name });
    }

    res.status(200).json({ status: "ok", created });
  } catch (err) {
    console.error("Ошибка:", err);
    res.status(500).json({ error: err.message });
  }
}
