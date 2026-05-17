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

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

bot.setWebHook(`${BOT_URL}/bot${TELEGRAM_BOT_TOKEN}`);

function initTelegramBot() {

  // =======================
  // Команды бота
  // =======================

  bot.setMyCommands([
    { command: "start", description: "Приветственное сообщение" },
    { command: "suggestresource", description: "Предложить новый ресурс" },
    {
      command: "viewsuggestions",
      description: "доступна только администратору",
    },
    { command: "stats", description: "доступна только администратору" },
  ]);

  // =======================
  // Callback кнопки
  // =======================

  bot.on("callback_query", async (query) => {

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
  });

  // =======================
  // suggestresource
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

Чтобы предложить ресурс, напиши команду так:

/suggestresource URL_ресурса и чем полезен

После этого я сохраню твоё предложение для рассмотрения.`,
    );
  });

  // =======================
  // Админка
  // =======================

  bot.onText(/\/viewsuggestions/, (msg) => {

    if (msg.from.id !== ADMIN_ID) {

      return bot.sendMessage(
        msg.chat.id,
        "У тебя нет доступа к этой команде ❌",
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
        "Пока предложений нет."
      );
    }
  });

  // =======================
  // Статистика
  // =======================

  bot.onText(/\/stats/, (msg) => {

    if (msg.from.id !== ADMIN_ID) {

      return bot.sendMessage(
        msg.chat.id,
        "У тебя нет доступа к этой команде ❌",
      );
    }

    const stats = getGiftStats();

    bot.sendMessage(
      msg.chat.id,
      `📊 Статистика подарков:

👍 Полезно: ${stats.likes}
🔥 Сохранили: ${stats.saved}`,
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
<a href="https://t.me/bro_Devel">t.me/bro_Devel</a>

Нажми кнопку ниже 👇
`.trim();

    await bot.sendPhoto(chatId, photoUrl, {
      caption: welcomeMessage,
      parse_mode: "HTML",
    });

    await bot.sendMessage(chatId, "Выбери действие:", {
      reply_markup: {
        keyboard: [
          ["🎁 Сегодняшний подарок"],
          ["💳 Оплатить подписку"],
        ],
        resize_keyboard: true,
      },
    });
  });

  // =======================
  // Подарок дня
  // =======================

  bot.onText(/🎁 Сегодняшний подарок/, (msg) => {

    const chatId = msg.chat.id;

    const todayGift = getTodayGift();

    if (!todayGift) {

      return bot.sendMessage(
        chatId,
        "Сегодня подарок ещё не был опубликован ⏳",
      );
    }

    const message = `
🎁 <b>Сегодняшний подарок</b>

📌 <b>${todayGift.title}</b>

${todayGift.description}

🔗 ${todayGift.url}
`.trim();

    bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
    });
  });

  // =======================
  // Оплата
  // =======================

  bot.onText(/💳 Оплатить подписку/, async (msg) => {

    const chatId = msg.chat.id;

    await bot.sendMessage(
      chatId,
      "Для оплаты нажми кнопку ниже 👇",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "💰 Перейти к оплате",
                url: "https://telegram-it-bot-zwtt.onrender.com/pay?amount=199",
              },
            ],
          ],
        },
      },
    );
  });

  // =======================
  // Ошибки polling
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