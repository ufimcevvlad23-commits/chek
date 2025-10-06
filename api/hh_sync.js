import fetch from "node-fetch";

const BITRIX_WEBHOOK = "https://nta-company.bitrix24.ru/rest/56435/4z7sfmwa5fi3k9rz/";
const HH_ACCESS_TOKEN = "USERH6FI4QDCTBSH4Q35V15LBQ50JGO2HUTHI4SPALKNCJID7DQ87BU8IDJCLUMT"; // токен hh.ru

// ID воронки и стадии (твоё)
const FUNNEL_ID = 44; // Найм персонала
const STAGE_ID = "C44:NEW"; // Договориться о собеседовании

export default async function handler(req, res) {
  try {
    console.log("🔄 Запуск синхронизации Bitrix24 ↔ hh.ru...");

    // 1️⃣ Получаем отклики с hh.ru
    const hhResponse = await fetch("https://api.hh.ru/employers/me/vacancies", {
      headers: { Authorization: `Bearer ${HH_ACCESS_TOKEN}` },
    });

    if (!hhResponse.ok) {
      const errorText = await hhResponse.text();
      console.error("Ошибка HH.ru:", errorText);
      return res.status(500).json({ error: "Ошибка при получении данных с hh.ru" });
    }

    const hhData = await hhResponse.json();
    console.log(`✅ Найдено ${hhData.items.length} вакансий`);

    // 2️⃣ Для примера создадим сделку в Bitrix24
    for (const vacancy of hhData.items) {
      const dealTitle = `Новый отклик: ${vacancy.name}`;

      const dealData = {
        fields: {
          TITLE: dealTitle,
          CATEGORY_ID: FUNNEL_ID,
          STAGE_ID: STAGE_ID,
          SOURCE_ID: "HH",
          COMMENTS: `Вакансия: ${vacancy.name}, опубликована ${vacancy.published_at}`,
        },
      };

      const bitrixResponse = await fetch(`${BITRIX_WEBHOOK}crm.deal.add.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dealData),
      });

      const bitrixResult = await bitrixResponse.json();
      console.log("Создана сделка:", bitrixResult);
    }

    return res.status(200).json({ message: "Синхронизация завершена успешно ✅" });
  } catch (error) {
    console.error("Ошибка синхронизации:", error);
    return res.status(500).json({ error: error.message });
  }
}
