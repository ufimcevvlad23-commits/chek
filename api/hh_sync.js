export default async function handler(req, res) {
  try {
    // Настройки Bitrix24 и HH.ru
    const BITRIX_WEBHOOK = "https://nta-company.bitrix24.ru/rest/56435/j7rzo0xhs0ityawj/";
    const FUNNEL_ID = "44"; // Воронка "Найм персонала"
    const STAGE_ID = "C44:NEW"; // Стадия "Договориться о собеседовании"

    // Можно добавить реальный код синхронизации HH ↔ Bitrix
    // Пока возвращаем тестовый JSON
    res.status(200).json({
      success: true,
      message: "Интеграция HH.ru → Bitrix24 работает ✅",
      funnel: FUNNEL_ID,
      stage: STAGE_ID,
      webhook: BITRIX_WEBHOOK
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
