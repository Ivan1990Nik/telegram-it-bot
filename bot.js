require('dotenv').config();

const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const rssParser = require('rss-parser');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

// ======================
// Конфиг
// ======================

const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BOT_URL = process.env.BOT_URL; // например https://telegram-it-bot.onrender.com

if (!TELEGRAM_CHAT_ID || !/^-100\d+$/.test(TELEGRAM_CHAT_ID)) {
  throw new Error(
    '❌ TELEGRAM_CHAT_ID должен быть в формате "-1001234567890".'
  );
}

const YANDEX_URL =
  'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

const SENT_POSTS_FILE = './sent_posts.json';

// ======================
// RSS источники IT
// ======================

const RSS_SOURCES = [
  { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/' },
];

// ======================
// Работа с отправленными постами
// ======================

let sentPosts = new Set();
try {
  const saved = JSON.parse(fs.readFileSync(SENT_POSTS_FILE));
  sentPosts = new Set(saved);
} catch {}

function saveSentPost(id) {
  sentPosts.add(id);
  fs.writeFileSync(SENT_POSTS_FILE, JSON.stringify([...sentPosts], null, 2));
}

// ======================
// Фильтр IT-новостей
// ======================

const IT_KEYWORDS = [
  'programming','coding','developer','JavaScript','Python','AI','artificial intelligence',
  'machine learning','tech','software','framework','library','open source','API','GitHub',
  'dev','typescript','react','node.js','cloud','backend','frontend'
];

const keywordsRegex = new RegExp(IT_KEYWORDS.join('|'), 'i');

function isITNews(text) {
  return keywordsRegex.test(text);
}

// ======================
// Парсинг RSS
// ======================

async function fetchITNews() {
  const parser = new rssParser({ headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 });
  let allItems = [];

  for (const source of RSS_SOURCES) {
    try {
      console.log(`📡 Парсим RSS: ${source.name}...`);
      const feed = await parser.parseURL(source.url);
      if (!feed?.items?.length) continue;

      const filtered = feed.items
        .filter(item => isITNews(item.title + ' ' + (item.contentSnippet || '')))
        .map(item => ({
          id: item.link,
          title: item.title?.trim() || '',
          summary: item.contentSnippet?.trim() || item.description?.trim() || 'Без описания',
        }));

      allItems = allItems.concat(filtered);
    } catch (err) {
      console.error(`❌ Ошибка при парсинге ${source.name}:`, err.message);
    }
  }

  return allItems.slice(0, 15); // топ-15 свежих
}

// ======================
// Yandex GPT
// ======================

async function rewriteWithYandexGPT(text) {
  const prompt = `
Ты — профессиональный IT-копирайтер с 10 годами опыта.
Перепиши текст так, будто объясняешь другу-программисту и обычному человеку одновременно.

Стиль:
- Уверенно, без глупостей
- Простой язык
- Лёгкий юмор, 2–5 эмодзи
- Технически грамотно
- Без канцелярита, пафоса, сухих новостных формулировок

Структура:
1. Короткий заход (1–2 предложения)
2. Суть простыми словами
3. Почему важно
4. Личное мнение
5. Лёгкий вопрос или мысль для обсуждения

Исходный текст:
${text}
`.trim();

  const response = await fetch(YANDEX_URL, {
    method: 'POST',
    headers: {
      Authorization: `Api-Key ${YANDEX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt/latest`,
      completionOptions: { stream: false, temperature: 0.85, maxTokens: 800 },
      messages: [{ role: 'user', text: prompt }],
    }),
  });

  const data = await response.json();
  const result = data?.result?.alternatives?.[0]?.message?.text?.trim();
  if (!result) throw new Error('GPT вернул пустой ответ');
  return result;
}

// ======================
// Telegram Bot
// ======================

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);
bot.setWebHook(`${BOT_URL}/bot${TELEGRAM_BOT_TOKEN}`);

// Обработка ошибок
bot.on('polling_error', (error) => console.log('Polling error:', error.message));

// Команда /start

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Путь к изображению (локальный файл или URL)
  const welcomeMessage = `Привет, ${msg.from.first_name || 'друг'}! 👋\n\nДобро пожаловать в мой мир! 🚀\n\nПодписывайся на мой канале:\n👉 (https://t.me/bro_Devel)`;
  
  const photoUrl = 'https://ivan1990nik.github.io/portfolio/assets/logo-D9_LB6JM.PNG'; // 🔗 Ссылка на изображение

  // Отправляем фото с подписью
  bot.sendPhoto(chatId, photoUrl, {
    caption: welcomeMessage,
    parse_mode: 'Markdown' // Чтобы работали эмодзи и форматирование ссылок
  });
});






// ======================
// Функция отправки в Telegram с retry
// ======================

async function sendToTelegram(text, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text
      });
      console.log('🎉 Новость отправлена в Telegram!');
      return true;
    } catch (err) {
      console.error('❌ Ошибка Telegram:', err.response?.data?.description || err.message);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  return false;
}

// ======================
// Основная задача
// ======================

async function dailyNewsTask() {
  console.log('🕒 Запуск задачи...');
  try {
    const newsList = await fetchITNews();
    const freshNews = newsList.find(item => !sentPosts.has(item.id));

    if (!freshNews) {
      console.log('⚠️ Новых IT-новостей нет');
      return;
    }

    console.log('📰 Берём новость:', freshNews.title);
    const rewritten = await rewriteWithYandexGPT(`${freshNews.title}\n\n${freshNews.summary}`);
    const cleaned = rewritten.replace(/\n\s*\n/g, '\n').trim();
    const message = `🚀 IT-разбор:\n\n${cleaned}\n\n t.me/bro_Devel`;

    const sent = await sendToTelegram(message);
    if (sent) saveSentPost(freshNews.id);

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  }
}

// ======================
// Cron — 2 раза в день
// ======================

cron.schedule('05 9,18 * * *', dailyNewsTask, { timezone: 'Europe/Moscow' });

// ======================
// Express сервер + webhook
// ======================

const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Your service is live 🎉'));
app.get('/health', (req, res) => res.send('OK'));

app.post(`/bot${TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

console.log('⏳ Бот готов к публикации IT-новостей...');