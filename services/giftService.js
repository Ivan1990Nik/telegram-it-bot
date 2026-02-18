const fs = require("fs");
const {
  TELEGRAM_CHAT_ID,
  RESOURCES_FILE,
  GIFT_HISTORY_FILE,
} = require("../config/config");

// ======================
// Локальное состояние
// ======================

let todayGift = null;
let giftStats = { likes: 0, saved: 0 };

// ======================
// Работа с файлами
// ======================

function loadResources() {
  try {
    return JSON.parse(fs.readFileSync(RESOURCES_FILE));
  } catch {
    return [];
  }
}

function loadGiftHistory() {
  try {
    return JSON.parse(fs.readFileSync(GIFT_HISTORY_FILE));
  } catch {
    return [];
  }
}

function saveGiftHistory(history) {
  fs.writeFileSync(GIFT_HISTORY_FILE, JSON.stringify(history, null, 2));
}

function saveGiftStats() {
  fs.writeFileSync("./gift_stats.json", JSON.stringify(giftStats, null, 2));
}

// ======================
// Выбор случайного ресурса
// ======================

function getRandomResource(resources, history) {
  const recent = history.slice(-7);
  const filtered = resources.filter((r) => !recent.includes(r.title));

  if (!filtered.length) {
    return resources[Math.floor(Math.random() * resources.length)];
  }

  return filtered[Math.floor(Math.random() * filtered.length)];
}

// ======================
// Отправка подарка дня
// ======================

async function sendGiftOfTheDay() {
  console.log("🎁 Отправка подарка дня...");

  const resources = loadResources();
  if (!resources.length) return console.log("Нет ресурсов");

  const history = loadGiftHistory();
  const resource = getRandomResource(resources, history);
  todayGift = resource;

  const message = `
🎁 <b>Подарок дня</b>

📌 <b>${resource.title}</b>

${resource.description}

🔗 ${resource.url}
`.trim();

  try {
    await bot.sendMessage(TELEGRAM_CHAT_ID, message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "👍 Полезно", callback_data: "gift_like" },
            { text: "🔥 Сохранил", callback_data: "gift_saved" },
          ],
        ],
      },
    });

    history.push(resource.title);
    saveGiftHistory(history);

    console.log("✅ Подарок отправлен");
  } catch (err) {
    console.error("❌ Ошибка отправки подарка:", err.message);
  }
}

// ======================
// Работа с реакциями
// ======================

function handleGiftReaction(type) {
  if (type === "gift_like") {
    giftStats.likes++;
  }

  if (type === "gift_saved") {
    giftStats.saved++;
  }

  saveGiftStats();
}

function getTodayGift() {
  return todayGift;
}

function getGiftStats() {
  return giftStats;
}

module.exports = {
  sendGiftOfTheDay,
  handleGiftReaction,
  getTodayGift,
  getGiftStats,
};
