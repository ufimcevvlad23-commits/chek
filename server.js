const express = require("express");
const path = require("path");

const app = express();

// Отдаём index.html и статические файлы
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// На любые другие запросы – тоже index.html
app.all("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Экспорт для Vercel
module.exports = app;
