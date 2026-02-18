require("dotenv").config();

// ======================
// Переменные окружения
// ======================

const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BOT_URL = process.env.BOT_URL;
const ADMIN_ID = 8297520933;

if (!TELEGRAM_CHAT_ID || !/^-100\d+$/.test(TELEGRAM_CHAT_ID)) {
  throw new Error(
    '❌ TELEGRAM_CHAT_ID должен быть в формате "-1001234567890".',
  );
}

// ======================
// Константы
// ======================

const YANDEX_URL =
  "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

const SENT_POSTS_FILE = "./sent_posts.json";
const RESOURCES_FILE = "./resources.json";
const GIFT_HISTORY_FILE = "./gift_history.json";

module.exports = {
  YANDEX_API_KEY,
  YANDEX_FOLDER_ID,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  BOT_URL,
  YANDEX_URL,
  SENT_POSTS_FILE,
  RESOURCES_FILE,
  GIFT_HISTORY_FILE,
  ADMIN_ID,
};
