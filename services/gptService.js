const {
  YANDEX_API_KEY,
  YANDEX_FOLDER_ID,
  YANDEX_URL,
} = require("../config/config");

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
-текст не должен привышать 1000 символов

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
    method: "POST",
    headers: {
      Authorization: `Api-Key ${YANDEX_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modelUri: `gpt://${YANDEX_FOLDER_ID}/yandexgpt/latest`,
      completionOptions: { stream: false, temperature: 0.85, maxTokens: 800 },
      messages: [{ role: "user", text: prompt }],
    }),
  });

  const data = await response.json();
  const result = data?.result?.alternatives?.[0]?.message?.text?.trim();
  if (!result) throw new Error("GPT вернул пустой ответ");
  return result;
}

module.exports = {
  rewriteWithYandexGPT,
};
