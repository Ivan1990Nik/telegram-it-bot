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
  bot.setMyCommands([
    { command: "start", description: "Приветственное сообщение" },
    { command: "suggestresource", description: "Предложить новый ресурс" },
    {
      command: "viewsuggestions",
      description: "доступна только администратору",
    },
    { command: "stats", description: "доступна только администратору" },
  ]);

  bot.on("callback_query", async (query) => {
    if (query.data === "gift_like") {
      handleGiftReaction("gift_like");
      await bot.answerCallbackQuery(query.id, { text: "Рад что полезно 🙌" });
    }
    if (query.data === "gift_saved") {
      handleGiftReaction("gift_saved");
      await bot.answerCallbackQuery(query.id, { text: "Отличный выбор 🔥" });
    }
  });

  bot.onText(/\/suggestresource (.+)/, (msg, match) => {
    const suggestion = `
От: ${msg.from.username || msg.from.first_name}
Текст: ${match[1]}
Дата: ${new Date().toISOString()}
---
`;
    fs.appendFileSync("suggestions.txt", suggestion);
    bot.sendMessage(msg.chat.id, "Спасибо! Мы рассмотрим твой ресурс 🙌");
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

  bot.onText(/\/viewsuggestions/, (msg) => {
    if (msg.from.id !== ADMIN_ID)
      return bot.sendMessage(
        msg.chat.id,
        "У тебя нет доступа к этой команде ❌",
      );
    try {
      const data = fs.readFileSync("suggestions.txt", "utf8");
      bot.sendMessage(msg.chat.id, `📂 Предложения:\n\n${data.slice(-3000)}`);
    } catch {
      bot.sendMessage(msg.chat.id, "Пока предложений нет.");
    }
  });

  bot.onText(/\/stats/, (msg) => {
    if (msg.from.id !== ADMIN_ID)
      return bot.sendMessage(
        msg.chat.id,
        "У тебя нет доступа к этой команде ❌",
      );
    const stats = getGiftStats();
    bot.sendMessage(
      msg.chat.id,
      `📊 Статистика подарков:\n\n👍 Полезно: ${stats.likes}\n🔥 Сохранили: ${stats.saved}`,
    );
  });

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const photoUrl =
      "https://ivan1990nik.github.io/portfolio/assets/logo-D9_LB6JM.PNG";
    const welcomeMessage = `Привет, ${msg.from.first_name || "друг"}! 👋\n\nМой канал: <a href="https://t.me/bro_Devel">t.me/bro_Devel</a>\n\nНажми кнопку ниже, чтобы увидеть 🎁 подарок дня!`;

    bot.sendPhoto(chatId, photoUrl, {
      caption: welcomeMessage,
      parse_mode: "HTML",
    });
    bot.sendMessage(chatId, "Выбери действие:", {
      reply_markup: {
        keyboard: [["🎁 Сегодняшний подарок"]],
        resize_keyboard: true,
      },
    });
  });

  bot.onText(/🎁 Сегодняшний подарок/, (msg) => {
    const chatId = msg.chat.id;
    const todayGift = getTodayGift();
    if (!todayGift)
      return bot.sendMessage(
        chatId,
        "Сегодня подарок ещё не был опубликован ⏳",
      );

    const message = `
🎁 <b>Сегодняшний подарок</b>

📌 <b>${todayGift.title}</b>

${todayGift.description}

🔗 ${todayGift.url}
`.trim();

    bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  });

  bot.on("polling_error", (error) =>
    console.log("Polling error:", error.message),
  );
}

module.exports = { bot, initTelegramBot, TELEGRAM_CHAT_ID };
