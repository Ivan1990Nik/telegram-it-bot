require("dotenv").config();

const express = require("express");
const YooKassa = require("yookassa");
const { v4: uuidv4 } = require("uuid");

const { initTelegramBot, bot } = require("./services/telegramBotService");
const { startCronTasks } = require("./services/newsCronService");
const { TELEGRAM_BOT_TOKEN } = require("./config/config");

// =======================
// Telegram bot
// =======================

initTelegramBot();
startCronTasks();

// =======================
// YooKassa
// =======================

const yooKassa = new YooKassa({
  shopId: process.env.SHOP_ID,
  secretKey: process.env.SECRET_KEY,
});

// =======================
// Express
// =======================

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Your service is live 🎉");
});

app.get("/health", (req, res) => {
  res.send("OK");
});

// =======================
// Telegram webhook
// =======================

app.post(`/bot${TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// =======================
// YooKassa payment
// =======================

app.get("/pay", async (req, res) => {
  try {
    const payment = await yooKassa.createPayment(
      {
        amount: {
          value: req.query.amount || "10.00",
          currency: "RUB",
        },

        capture: true,

        confirmation: {
          type: "redirect",

          return_url:
            "https://telegram-it-bot-zwtt.onrender.com/success",
        },

        description: "Оплата заказа",
      },

      uuidv4()
    );

    res.redirect(payment.confirmation.confirmation_url);

  } catch (e) {

    console.log(e.response?.data || e);

    res.send("Ошибка оплаты");
  }
});

// =======================
// Success page
// =======================

app.get("/success", (req, res) => {
  res.send("Оплата успешна ✅");
});

// =======================
// Проверка webhook
// =======================

app.get("/webhook", (req, res) => {
  res.send("Webhook работает");
});

// =======================
// YooKassa webhook
// =======================

app.post("/webhook", async (req, res) => {

  console.log("WEBHOOK ПРИШЁЛ");

  console.log(req.body);

  const event = req.body.event;

  const payment = req.body.object;

  console.log("EVENT:", event);

  if (event === "payment.succeeded") {

    console.log("ОПЛАТА УСПЕШНА ✅");

    console.log("ID:", payment.id);

    console.log("Сумма:", payment.amount.value);

    // Отправка в Telegram

    await bot.sendMessage(
     process.env.TELEGRAM_CHAT_ID,
      `💰 Новая оплата: ${payment.amount.value} RUB`
    );
  }

  res.sendStatus(200);
});

// =======================
// Start server
// =======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

console.log("⏳ Бот готов!");