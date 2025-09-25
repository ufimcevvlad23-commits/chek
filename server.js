const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Отдаём статические файлы (например index.html)
app.use(express.static(path.join(__dirname)));

// Обрабатываем и GET, и POST → всегда отдаём index.html
app.all("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});
