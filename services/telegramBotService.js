const fs = require("fs");
const TelegramBot = require("node-telegram-bot-api");

const {
  TELEGRAM_BOT_TOKEN,
  BOT_URL,
  ADMIN_ID,
  TELEGRAM_CHAT_ID,
} = require("../config/config");

const {
  sendGiftOfTheDay,
  handleGiftReaction,
  getTodayGift,
  getGiftStats,
} = require("./giftService");

// =======================
// BOT
// =======================

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

bot.setWebHook(`${BOT_URL}/bot${TELEGRAM_BOT_TOKEN}`);

// =======================
// CUSTOM AMOUNT STATE
// =======================

const waitingForAmount = {};

// =======================
// INIT
// =======================

function initTelegramBot() {

  bot.setMyCommands([
    { command: "start", description: "Приветственное сообщение" },
    { command: "suggestresource", description: "Предложить новый ресурс" },
    {
      command: "viewsuggestions",
      description: "Только для администратора",
    },
    { command: "stats", description: "Статистика" },
  ]);

  // =======================
  // CALLBACKS
  // =======================

  bot.on("callback_query", async (query) => {

    const chatId = query.message.chat.id;

    // ===== Gift reactions =====

    if (query.data === "gift_like") {

      handleGiftReaction("gift_like");

      await bot.answerCallbackQuery(query.id, {
        text: "Рад что полезно 🙌",
      });
    }

    if (query.data === "gift_saved") {

      handleGiftReaction("gift_saved");

      await bot.answerCallbackQuery(query.id, {
        text: "Отличный выбор 🔥",
      });
    }

    // ===== Custom payment =====

    if (query.data === "custom_amount") {

      waitingForAmount[chatId] = true;

      await bot.sendMessage(
        chatId,
        "💰 Введите сумму в RUB:"
      );

      await bot.answerCallbackQuery(query.id);
    }
  });

  // =======================
  // MESSAGE HANDLER
  // =======================

  bot.on("message", async (msg) => {

    const chatId = msg.chat.id;

    // ===== Waiting custom amount =====

    if (waitingForAmount[chatId]) {

      const amount = Number(msg.text);

      if (isNaN(amount) || amount <= 0) {

        return bot.sendMessage(
          chatId,
          "❌ Введите корректную сумму"
        );
      }

      waitingForAmount[chatId] = false;

      return bot.sendMessage(
        chatId,
        `💳 Оплатить ${amount} RUB`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "💰 Перейти к оплате",
                  url: `https://telegram-it-bot-zwtt.onrender.com/pay?amount=${amount}`,
                },
              ],
            ],
          },
        }
      );
    }
  });

  // =======================
  // /suggestresource
  // =======================

  bot.onText(/\/suggestresource (.+)/, (msg, match) => {

    const suggestion = `
От: ${msg.from.username || msg.from.first_name}
Текст: ${match[1]}
Дата: ${new Date().toISOString()}
---`;

    fs.appendFileSync("suggestions.txt", suggestion);

    bot.sendMessage(
      msg.chat.id,
      "Спасибо! Мы рассмотрим твой ресурс 🙌"
    );
  });

  bot.onText(/\/suggestresource$/, (msg) => {

    bot.sendMessage(
      msg.chat.id,
      `Привет! 👋

Чтобы предложить ресурс, напиши:

/suggestresource URL_ресурса и чем полезен

После этого я сохраню предложение 🙌`
    );
  });

  // =======================
  // ADMIN
  // =======================

  bot.onText(/\/viewsuggestions/, (msg) => {

    if (msg.from.id !== ADMIN_ID) {

      return bot.sendMessage(
        msg.chat.id,
        "❌ У тебя нет доступа"
      );
    }

    try {

      const data = fs.readFileSync("suggestions.txt", "utf8");

      bot.sendMessage(
        msg.chat.id,
        `📂 Предложения:\n\n${data.slice(-3000)}`
      );

    } catch {

      bot.sendMessage(
        msg.chat.id,
        "Пока предложений нет"
      );
    }
  });

  bot.onText(/\/stats/, (msg) => {

    if (msg.from.id !== ADMIN_ID) {

      return bot.sendMessage(
        msg.chat.id,
        "❌ У тебя нет доступа"
      );
    }

    const stats = getGiftStats();

    bot.sendMessage(
      msg.chat.id,
      `📊 Статистика:

👍 Полезно: ${stats.likes}
🔥 Сохранили: ${stats.saved}`
    );
  });

  // =======================
  // START
  // =======================

  bot.onText(/\/start/, async (msg) => {

    const chatId = msg.chat.id;

    const photoUrl =
      "https://ivan1990nik.github.io/portfolio/assets/logo-D9_LB6JM.PNG";

    const welcomeMessage = `
Привет, ${msg.from.first_name || "друг"}! 👋

Мой канал:
https://t.me/bro_Devel

Нажми кнопку ниже 👇
`;

    await bot.sendPhoto(chatId, photoUrl, {
      caption: welcomeMessage,
    });

    await bot.sendMessage(
      chatId,
      "Выбери действие:",
      {
        reply_markup: {
          keyboard: [
            ["🎁 Сегодняшний подарок"],
            ["💳 Оплатить подписку"],
          ],
          resize_keyboard: true,
        },
      }
    );
  });

  // =======================
  // GIFT
  // =======================

  bot.onText(/🎁 Сегодняшний подарок/, (msg) => {

    const chatId = msg.chat.id;

    const todayGift = getTodayGift();

    if (!todayGift) {

      return bot.sendMessage(
        chatId,
        "Сегодня подарок ещё не опубликован ⏳"
      );
    }

    const message = `
🎁 <b>Сегодняшний подарок</b>

📌 <b>${todayGift.title}</b>

${todayGift.description}

🔗 ${todayGift.url}
`;

    bot.sendMessage(
      chatId,
      message,
      {
        parse_mode: "HTML",
      }
    );
  });

  // =======================
  // PAYMENT
  // =======================

  bot.onText(/💳 Оплатить подписку/, async (msg) => {

    const chatId = msg.chat.id;

    await bot.sendMessage(
      chatId,
      "💰 Выбери сумму оплаты:",
      {
        reply_markup: {
          inline_keyboard: [

            [
              {
                text: "50 RUB",
                url: "https://telegram-it-bot-zwtt.onrender.com/pay?amount=50",
              },
            ],

            [
              {
                text: "100 RUB",
                url: "https://telegram-it-bot-zwtt.onrender.com/pay?amount=100",
              },
            ],

            [
              {
                text: "199 RUB",
                url: "https://telegram-it-bot-zwtt.onrender.com/pay?amount=199",
              },
            ],

            [
              {
                text: "✍️ Ввести свою сумму",
                callback_data: "custom_amount",
              },
            ],
          ],
        },
      }
    );
  });

  // =======================
  // ERRORS
  // =======================

  bot.on("polling_error", (error) => {

    console.log("Polling error:", error.message);
  });
}

module.exports = {
  bot,
  initTelegramBot,
  TELEGRAM_CHAT_ID,
};