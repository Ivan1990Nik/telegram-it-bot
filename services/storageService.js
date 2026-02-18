const fs = require("fs");
const { SENT_POSTS_FILE } = require("../config/config");

let sentPosts = new Set();
try {
  const saved = JSON.parse(fs.readFileSync(SENT_POSTS_FILE));
  sentPosts = new Set(saved);
} catch (err) {
  console.warn("⚠️ SENT_POSTS_FILE не найден, создаем новый");
}

function saveSentPost(id) {
  sentPosts.add(id);
  fs.writeFileSync(SENT_POSTS_FILE, JSON.stringify([...sentPosts], null, 2));
}

function isSent(id) {
  return sentPosts.has(id);
}

module.exports = { saveSentPost, isSent };
