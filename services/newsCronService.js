const cron = require("node-cron");
const { bot, TELEGRAM_CHAT_ID } = require("./telegramBotService");
const { fetchITNews } = require("./rssService");
const { rewriteWithYandexGPT } = require("./gptService");
const { saveSentPost, isSent } = require("./storageService");
const { sendGiftOfTheDay } = require("./giftService");

/**
 * Запуск всех cron-задач
 */
function startCronTasks() {
  // Подарок дня
  cron.schedule("03 14 * * *", () => sendGiftOfTheDay(bot), {
    timezone: "Europe/Moscow",
  });

  // Новости 3 раза в день
  cron.schedule("50 9,12,13 * * *", dailyNewsTask, {
    timezone: "Europe/Moscow",
  });
}

/**
 * Ежедневная рассылка новостей
 */
async function dailyNewsTask() {
  console.log("🕒 Запуск задачи dailyNewsTask...");

  try {
    const newsList = await fetchITNews();
    const freshNews = newsList.filter((item) => !isSent(item.id));

    if (!freshNews.length) {
      console.log("⚠️ Новых IT-новостей нет");
      return;
    }

    const sortedNews = freshNews.sort(
      (a, b) => new Date(b.pubDate) - new Date(a.pubDate),
    );
    const recentNews = sortedNews.slice(0, 3);
    const selectedNews =
      recentNews[Math.floor(Math.random() * recentNews.length)];

    console.log(`✅ Выбрана новость: ${selectedNews.title}`);

    const rewritten = await rewriteWithYandexGPT(
      `${selectedNews.title}\n\n${selectedNews.summary}`,
    );
    const cleaned = rewritten.replace(/\n\s*\n/g, "\n").trim();
    const message = `🚀 IT-разбор:\n\n${cleaned}\n\nt.me/bro_Devel`;

    const img =
      selectedNews.image ||
      "https://ivan1990nik.github.io/portfolio/assets/logo-D9_LB6JM.PNG";

    try {
      // Отправляем картинку как документ, caption до 4096 символов
      await bot.sendDocument(TELEGRAM_CHAT_ID, img, {
        caption: message,
        parse_mode: "HTML",
      });
    } catch (err) {
      console.warn("❌ sendDocument failed:", err.message);
      // fallback: текст отдельным сообщением
      await bot.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: "HTML" });
    }

    // Сохраняем ID новости, чтобы не отправлять повторно
    saveSentPost(selectedNews.id);
  } catch (err) {
    console.error("❌ Ошибка dailyNewsTask:", err.message);
  }
}

module.exports = { startCronTasks, dailyNewsTask };
