require('dotenv').config();

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

if (!TELEGRAM_CHAT_ID || !/^-100\d+$/.test(TELEGRAM_CHAT_ID)) {
  throw new Error(
    '❌ TELEGRAM_CHAT_ID должен быть в формате "-1001234567890".'
  );
}

const YANDEX_URL =
  'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

const TELEGRAM_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

const SENT_POSTS_FILE = './sent_posts.json';

// RSS источники IT
const RSS_SOURCES = [
  { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/' },
];

// ======================
// Работа с отправленными постами
// ======================

function getSentPosts() {
  try {
    return JSON.parse(fs.readFileSync(SENT_POSTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveSentPost(id) {
  const sent = getSentPosts();
  sent.push(id);
  fs.writeFileSync(SENT_POSTS_FILE, JSON.stringify(sent, null, 2));
}

// ======================
// Фильтр IT-новостей
// ======================

const IT_KEYWORDS = [
  'programming',
  'coding',
  'developer',
  'JavaScript',
  'Python',
  'AI',
  'artificial intelligence',
  'machine learning',
  'tech',
  'software',
  'framework',
  'library',
  'open source',
  'API',
  'GitHub',
  'dev',
  'typescript',
  'react',
  'node.js',
  'cloud',
  'backend',
  'frontend',
];

function isITNews(text) {
  const lower = text.toLowerCase();
  return IT_KEYWORDS.some(keyword => lower.includes(keyword.toLowerCase()));
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

  // Возвращаем топ-15 свежих
  return allItems.slice(0, 15);
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
// Telegram
// ======================

async function sendToTelegram(text) {
  if (!text || text.trim().length < 10) return false;

  try {
    await axios.post(TELEGRAM_URL, { chat_id: TELEGRAM_CHAT_ID, text });
    console.log('🎉 Новость отправлена в Telegram!');
    return true;
  } catch (err) {
    console.error('❌ Ошибка Telegram:', err.response?.data?.description || err.message);
    return false;
  }
}

// ======================
// Основная задача
// ======================

async function dailyNewsTask() {
  console.log('🕒 Запуск задачи...');

  try {
    const newsList = await fetchITNews();
    const sentPosts = getSentPosts();

    const freshNews = newsList.find(item => !sentPosts.includes(item.id));

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
// Telegram Bot init
// ======================

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

bot.on('polling_start', () => console.log('🤖 Бот запущен'));

// Команда /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const welcomeMessage = `
Привет, ${msg.from.first_name || 'друг'}! 👋

 свежие IT-новости: программирование, ИИ, разработки и всё, что связано с кодингом. 💻🤖

Просто публикаций утром и вечером, и делись своими мыслями! 💬
`;

  bot.sendMessage(chatId, welcomeMessage);
});

// ======================
// Cron — 2 раза в день
// ======================

cron.schedule('04 13 * * *', dailyNewsTask, { timezone: 'Europe/Moscow' }); // 10:30
cron.schedule('05 13 * * *', dailyNewsTask, { timezone: 'Europe/Moscow' }); // 18:30

console.log('⏳ Бот готов к публикации IT-новостей...');
