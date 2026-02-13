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
const BOT_URL = process.env.BOT_URL;

if (!TELEGRAM_CHAT_ID || !/^-100\d+$/.test(TELEGRAM_CHAT_ID)) {
  throw new Error('❌ TELEGRAM_CHAT_ID должен быть в формате "-1001234567890".');
}

const YANDEX_URL =
  'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';

const SENT_POSTS_FILE = './sent_posts.json';
const RESOURCES_FILE = './resources.json';
const GIFT_HISTORY_FILE = './gift_history.json';

let todayGift = null;

// ======================
// Подарок дня — логика
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

function getRandomResource(resources, history) {
  const recent = history.slice(-7);
  const filtered = resources.filter(r => !recent.includes(r.title));

  if (!filtered.length) {
    return resources[Math.floor(Math.random() * resources.length)];
  }

  return filtered[Math.floor(Math.random() * filtered.length)];
}

async function sendGiftOfTheDay() {
  console.log('🎁 Отправка подарка дня...');

  const resources = loadResources();
  if (!resources.length) return console.log('Нет ресурсов');

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
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '👍 Полезно', callback_data: 'gift_like' },
            { text: '🔥 Сохранил', callback_data: 'gift_saved' }
          ]
        ]
      }
    });

    history.push(resource.title);
    saveGiftHistory(history);

    console.log('✅ Подарок отправлен');
  } catch (err) {
    console.error('❌ Ошибка отправки подарка:', err.message);
  }
}

// ======================
// Обработка реакций
// ======================

let giftStats = { likes: 0, saved: 0 };

function saveGiftStats() {
  fs.writeFileSync('./gift_stats.json', JSON.stringify(giftStats, null, 2));
}



// ======================
// Cron для подарка
// ======================

cron.schedule('45 20 * * *', sendGiftOfTheDay, {
  timezone: 'Europe/Moscow'
});

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


bot?.on?.('callback_query', async (query) => {
  if (query.data === 'gift_like') {
    giftStats.likes++;
    saveGiftStats();
    await bot.answerCallbackQuery(query.id, { text: 'Рад что полезно 🙌' });
  }

  if (query.data === 'gift_saved') {
    giftStats.saved++;
    saveGiftStats();
    await bot.answerCallbackQuery(query.id, { text: 'Отличный выбор 🔥' });
  }
});

// ======================
// /suggestresource
// ======================

bot?.onText?.(/\/suggestresource (.+)/, (msg, match) => {
  const suggestion = `
От: ${msg.from.username || msg.from.first_name}
Текст: ${match[1]}
Дата: ${new Date().toISOString()}
---
`;

  fs.appendFileSync('suggestions.txt', suggestion);
  bot.sendMessage(msg.chat.id, 'Спасибо! Мы рассмотрим твой ресурс 🙌');
});



// Обработка ошибок
bot.on('polling_error', (error) => console.log('Polling error:', error.message));


bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  const welcomeMessage = `
Привет, ${msg.from.first_name || 'друг'}! 👋

Мой канал: <a href="https://t.me/bro_Devel">t.me/bro_Devel</a>

Выбирай действие ниже:
`;

  const photoUrl = 'https://ivan1990nik.github.io/portfolio/assets/logo-D9_LB6JM.PNG';

  // Сначала отправляем фото с подписью
  bot.sendPhoto(chatId, photoUrl, {
    caption: welcomeMessage,
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [
        ['🎁 Сегодняшний подарок']
      ],
      resize_keyboard: true
    }
  });
});
bot.onText(/🎁 Сегодняшний подарок/, (msg) => {
  const chatId = msg.chat.id;

  if (!todayGift) {
    return bot.sendMessage(chatId, 'Сегодня подарок ещё не был опубликован ⏳');
  }

  const message = `
🎁 <b>Сегодняшний подарок</b>

📌 <b>${todayGift.title}</b>

${todayGift.description}

🔗 ${todayGift.url}
`.trim();

  bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
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
    const freshNews = newsList.filter(item => !sentPosts.has(item.id));

    if (freshNews.length === 0) {
      console.log('⚠️ Новых IT-новостей нет');
      return;
    }

    // 🔽 ВЕСЬМА ВАЖНОЕ ИЗМЕНЕНИЕ - приоритет новым
    // Сортируем по дате (свежие первыми)
    const sortedNews = freshNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    
    // Берём топ-5 самых свежих (или другое число)
    const recentNews = sortedNews.slice(0, 3);
    
    // Выбираем случайную ИЗ САМЫХ СВЕЖИХ
    const randomIndex = Math.floor(Math.random() * recentNews.length);
    const selectedNews = recentNews[randomIndex];
    
    console.log(`✅ Найдено ${freshNews.length} новых статей`);
    console.log(`📅 Выбираем из ${recentNews.length} самых свежих`);
    console.log('📰 Выбрана:', selectedNews.title);

    try {
      const rewritten = await rewriteWithYandexGPT(`${selectedNews.title}\n\n${selectedNews.summary}`);
      const cleaned = rewritten.replace(/\n\s*\n/g, '\n').trim();
      const message = `🚀 IT-разбор:\n\n${cleaned}\n\n t.me/bro_Devel`;

      const sent = await sendToTelegram(message);
      if (sent) saveSentPost(selectedNews.id);
    } catch (err) {
      console.error('❌ Ошибка при обработке статьи:', selectedNews.title, err.message);
    }

  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  }
}

// ======================
// Cron — 2 раза в день
// ======================

cron.schedule('32 9,15,19 * * *', dailyNewsTask, { timezone: 'Europe/Moscow' });


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



