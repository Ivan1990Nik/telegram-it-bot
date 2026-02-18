const rssParser = require("rss-parser");

// ======================
// RSS источники IT
// ======================

const RSS_SOURCES = [
  { name: "Hacker News", url: "https://news.ycombinator.com/rss" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
  { name: "GitHub Blog", url: "https://github.blog/feed/" },
];

// ======================
// Фильтр IT-новостей
// ======================
const IT_KEYWORDS = [
  "programming",
  "coding",
  "developer",
  "JavaScript",
  "Python",
  "AI",
  "artificial intelligence",
  "machine learning",
  "tech",
  "software",
  "framework",
  "library",
  "open source",
  "API",
  "GitHub",
  "dev",
  "typescript",
  "react",
  "node.js",
  "cloud",
  "backend",
  "frontend",
];
const keywordsRegex = new RegExp(IT_KEYWORDS.join("|"), "i");

function isITNews(text) {
  return keywordsRegex.test(text);
}

// ======================
// Парсинг RSS
// ======================
async function fetchITNews() {
  const parser = new rssParser({
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 10000,
  });
  let allItems = [];

  for (const source of RSS_SOURCES) {
    try {
      console.log(`📡 Парсим RSS: ${source.name}...`);
      const feed = await parser.parseURL(source.url);
      if (!feed?.items?.length) continue;

      const filtered = feed.items
        .filter((item) =>
          isITNews(item.title + " " + (item.contentSnippet || "")),
        )
        .map((item) => ({
          id: item.link,
          title: item.title?.trim() || "",
          summary:
            item.contentSnippet?.trim() ||
            item.description?.trim() ||
            "Без описания",
          image: item.enclosure?.url || item["media:content"]?.url || null, // картинка
        }));

      allItems = allItems.concat(filtered);
    } catch (err) {
      console.error(`❌ Ошибка при парсинге ${source.name}:`, err.message);
    }
  }

  return allItems.slice(0, 5); // топ-5 свежих
}

module.exports = {
  fetchITNews,
};
