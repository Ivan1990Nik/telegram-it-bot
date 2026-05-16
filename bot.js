require("dotenv").config();
const express = require("express");

const { initTelegramBot, bot } = require("./services/telegramBotService");
const { startCronTasks } = require("./services/newsCronService");
const { TELEGRAM_BOT_TOKEN } = require("./config/config");

// Инициализация Telegram-бота
initTelegramBot();

// Запуск всех cron-задач
startCronTasks();

// ====== Express для webhook ======
const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("Your service is live 🎉"));
app.get("/health", (req, res) => res.send("OK"));

// Этот endpoint обрабатывает входящие webhook от Telegram
app.post(`/bot${TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});
app.post(`/webhook${TELEGRAM_BOT_TOKEN}`, async (req, res) => {
  const event = req.body.event;
  const payment = req.body.object;

  console.log('WEBHOOK:', event);

  if (event === 'payment.succeeded') {

    console.log('Оплата прошла');

    console.log('ID:', payment.id);

    console.log('Сумма:', payment.amount.value);

    await bot.sendMessage(
      YOUR_CHAT_ID,
      `💰 Новая оплата: ${payment.amount.value} RUB`
    );
  }

  res.sendStatus(200);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
console.log("⏳ Бот готов к публикации IT-новостей через webhook!");
