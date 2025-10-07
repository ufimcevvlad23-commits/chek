export default async function handler(req, res) {
  try {
    // Разрешаем все методы для Bitrix (включая OPTIONS и POST)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Обработка preflight-запроса
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    // Пример: если кто-то открыл /api/hh_sync в браузере
    if (req.method === "GET") {
      return res.status(200).send("HH sync API работает ✅");
    }

    // Основная логика (интеграция HH)
    if (req.method === "POST") {
      // Здесь будет код интеграции HH -> Bitrix
      // например:
      // const data = req.body;
      // await syncToBitrix(data);

      return res.status(200).json({ success: true, message: "Данные приняты" });
    }

    // Если метод не поддерживается
    res.status(405).json({ error: "Метод не поддерживается" });

  } catch (err) {
    console.error("Ошибка API:", err);
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  }
}
