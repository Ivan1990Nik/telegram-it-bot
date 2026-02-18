const cron = require("node-cron");
const { bot, TELEGRAM_CHAT_ID } = require("./telegramBotService");
const { fetchITNews } = require("./rssService");
const { rewriteWithYandexGPT } = require("./gptService");
const { saveSentPost, isSent } = require("./storageService");
const { sendGiftOfTheDay } = require("./giftService");

function startCronTasks() {
  // Подарок дня
  cron.schedule("03 12 * * *", () => sendGiftOfTheDay(bot), {
    timezone: "Europe/Moscow",
  });

  // Новости 3 раза в день
  cron.schedule("30 9,12,13 * * *", dailyNewsTask, {
    timezone: "Europe/Moscow",
  });
}

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

    const max = 1024;
    const caption =
      message.length > max ? message.slice(0, max - 3) + "…" : message;
    const img =
      selectedNews.image ||
      "https://ivan1990nik.github.io/portfolio/assets/logo-D9_LB6JM.PNG";

    try {
      await bot.sendPhoto(TELEGRAM_CHAT_ID, img, {
        caption,
        parse_mode: "HTML",
      });
    } catch (err) {
      console.warn("❌ sendPhoto failed:", err.message);
      await bot.sendMessage(TELEGRAM_CHAT_ID, message.slice(0, 4096), {
        parse_mode: "HTML",
      });
    }

    saveSentPost(selectedNews.id);
  } catch (err) {
    console.error("❌ Ошибка dailyNewsTask:", err.message);
  }
}

module.exports = { startCronTasks, dailyNewsTask };
