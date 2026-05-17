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

// =======================
// Главная
// =======================

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
// Создание оплаты
// =======================

app.get("/pay", async (req, res) => {
  try {
    console.log("Создаём платёж...");

    const payment = await yooKassa.createPayment(
      {
        amount: {
          value: req.query.amount || "10.00",
          currency: "RUB",
        },

        capture: true,

        confirmation: {
          type: "redirect",

          return_url: "https://telegram-it-bot-zwtt.onrender.com/success",
        },

        description: "Оплата заказа",
      },

      uuidv4(),
    );

    console.log("Платёж создан");

    console.log(payment);

    return res.redirect(payment.confirmation.confirmation_url);
  } catch (e) {
    console.log("====== ОШИБКА YOOKASSA ======");

    console.log("MESSAGE:", e.message);

    console.log("FULL ERROR:", e);

    console.log("DATA:", e.response?.data);

    return res.status(500).send(`
      <h1>Ошибка оплаты</h1>

      <pre>
MESSAGE:
${e.message}

DATA:
${JSON.stringify(e.response?.data, null, 2)}
      </pre>
    `);
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
  res.send("Webhook работает ✅");
});

// =======================
// YooKassa webhook
// =======================

app.post("/webhook", async (req, res) => {
  try {
    console.log("====== WEBHOOK ПРИШЁЛ ======");

    console.log(req.body);

    const event = req.body.event;

    const payment = req.body.object;

    console.log("EVENT:", event);

    if (event === "payment.succeeded") {
      console.log("🔥 PAYMENT CONFIRMED:", {
        id: payment.id,
        amount: payment.amount.value,
        time: new Date().toISOString(),
      });
      console.log("ОПЛАТА УСПЕШНА ✅");

      console.log("ID:", payment.id);

      console.log("Сумма:", payment.amount.value);

      // Отправка сообщения в Telegram

      await bot.sendMessage(
        process.env.TELEGRAM_CHAT_ID,
        `💰 Новая оплата: ${payment.amount.value} RUB`,
      );
    }

    res.sendStatus(200);
  } catch (e) {
    console.log("ОШИБКА WEBHOOK:");

    console.log(e);

    res.sendStatus(500);
  }
});

// =======================
// Start server
// =======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});

console.log("⏳ Бот готов!");
