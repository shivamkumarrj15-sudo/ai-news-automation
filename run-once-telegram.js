// ============================================
//  🤖 AI News Telegram Bot — One-Shot Script
//  Runs once, fetches news, sends to Telegram, and exits.
//  Perfect for GitHub Actions (serverless) deployment!
// ============================================

require('dotenv').config();
const axios = require('axios');
const Parser = require('rss-parser');
const { GoogleGenAI } = require('@google/genai');

const CONFIG = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chatIds: (process.env.TELEGRAM_CHAT_IDS || '7863710238').split(',').map(id => id.trim()),
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    models: [
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-lite-001',
    ],
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    models: [
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ],
    maxRetries: 3,
    retryBaseDelayMs: 5000,
  },
  newsApi: {
    key: process.env.NEWS_API_KEY,
    baseUrl: 'https://newsapi.org/v2/everything',
    query: 'artificial intelligence OR AI OR machine learning OR ChatGPT OR Gemini AI OR OpenAI',
    pageSize: 8,
    sortBy: 'publishedAt',
    language: 'en',
  },
  schedule: {
    intervalMinutes: parseInt(process.env.NEWS_INTERVAL_MINUTES) || 90,
  },
  maxArticles: 8,
};

const RSS_FEEDS = [
  { name: 'TechCrunch', emoji: '🔵', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'VentureBeat', emoji: '🟣', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'The Verge', emoji: '🟢', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
];

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'AI-News-Bot/1.0' },
});

const ai = CONFIG.gemini.apiKey ? new GoogleGenAI({ apiKey: CONFIG.gemini.apiKey }) : null;

function log(msg) {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  console.log(`[${timestamp}] ${msg}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stripHTML(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function escapeHTML(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatTimeIST(date) {
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function truncate(text, maxLen = 200) {
  if (!text || text.length <= maxLen) return text || '';
  return text.substring(0, maxLen).trim() + '...';
}

// ─── Fetching News ──────────────────────────────
async function fetchRSSNews() {
  const allArticles = [];
  for (const feed of RSS_FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);
      const articles = (result.items || []).slice(0, 6).map(item => ({
        title: stripHTML(item.title) || 'Untitled',
        link: item.link || '',
        pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
        source: feed.name,
        sourceEmoji: feed.emoji,
        description: truncate(stripHTML(item.contentSnippet || item.content || item.summary || ''), 250),
      }));
      allArticles.push(...articles);
    } catch (err) {
      log(`⚠️ RSS Error (${feed.name}): ${err.message}`);
    }
  }
  return allArticles;
}

async function fetchNewsAPI() {
  if (!CONFIG.newsApi.key) return [];
  try {
    const now = new Date();
    const hoursAgo = new Date(now.getTime() - CONFIG.schedule.intervalMinutes * 60 * 1000);
    const response = await axios.get(CONFIG.newsApi.baseUrl, {
      params: {
        q: CONFIG.newsApi.query,
        from: hoursAgo.toISOString(),
        to: now.toISOString(),
        sortBy: CONFIG.newsApi.sortBy,
        language: CONFIG.newsApi.language,
        pageSize: CONFIG.newsApi.pageSize,
        apiKey: CONFIG.newsApi.key,
      },
      timeout: 15000,
    });
    if (response.data.status === 'ok' && response.data.articles) {
      return response.data.articles
        .filter(a => a.title && a.title !== '[Removed]')
        .map(a => ({
          title: stripHTML(a.title),
          link: a.url || '',
          pubDate: a.publishedAt ? new Date(a.publishedAt) : new Date(),
          source: a.source?.name || 'NewsAPI',
          sourceEmoji: '🔴',
          description: truncate(stripHTML(a.description || ''), 250),
        }));
    }
  } catch (err) {
    log(`⚠️ NewsAPI Error: ${err.message}`);
  }
  return [];
}

async function getAllLatestNews() {
  const [rssArticles, newsApiArticles] = await Promise.all([
    fetchRSSNews(),
    fetchNewsAPI(),
  ]);
  const allArticles = [...rssArticles, ...newsApiArticles];
  const seen = new Set();
  const unique = allArticles.filter(a => {
    if (!a.link || seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });
  unique.sort((a, b) => b.pubDate - a.pubDate);
  return unique;
}

// ─── AI Code ────────────────────────────────────
async function callOpenRouterModel(model, userPrompt, systemInstruction) {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1500,
    },
    {
      headers: {
        'Authorization': `Bearer ${CONFIG.openrouter.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
  if (response.data && response.data.choices && response.data.choices[0]) {
    return response.data.choices[0].message.content;
  }
  throw new Error('Invalid response from OpenRouter');
}

async function callGeminiModel(model, userPrompt, systemInstruction) {
  if (!ai) throw new Error('Gemini client not initialized');
  const response = await ai.models.generateContent({
    model: model,
    contents: userPrompt,
    config: {
      systemInstruction: systemInstruction,
      maxOutputTokens: 1500,
    },
  });
  return response.text;
}

async function askAI(userPrompt, systemInstruction = '') {
  const defaultSystem = `You are "AI News Bot" 🤖, a helpful AI assistant. You write summaries of tech news.`;
  const sysPrompt = systemInstruction || defaultSystem;

  if (CONFIG.openrouter.apiKey) {
    for (const model of CONFIG.openrouter.models) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await callOpenRouterModel(model, userPrompt, sysPrompt);
          if (result) return result;
        } catch (err) {
          log(`⚠️ OpenRouter [${model}] error: ${err.message}`);
          await sleep(1000 * attempt);
        }
      }
    }
  }

  if (CONFIG.gemini.apiKey && ai) {
    for (const model of CONFIG.gemini.models) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await callGeminiModel(model, userPrompt, sysPrompt);
          if (result) return result;
        } catch (err) {
          log(`⚠️ Gemini [${model}] error: ${err.message}`);
          await sleep(1000 * attempt);
        }
      }
    }
  }

  return null;
}

async function generateHindiSummary(articles) {
  const articleList = articles
    .map((a, i) => `${i + 1}. "${a.title}" — ${a.source}\n   ${a.description}`)
    .join('\n\n');
  const prompt = `इन AI news articles का Hindi (Hinglish mix OK) में एक brief summary दो। 
हर article के लिए 1-2 lines में main point बताओ। Emojis use करो।
Format: numbered list with emoji bullet points.

Articles:
${articleList}`;

  return await askAI(prompt, 'You are a Hindi news summarizer. Write concise Hinglish summaries.');
}

// ─── Messaging ──────────────────────────────────
function formatNewsMessage(articles) {
  const now = formatTimeIST(new Date());
  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  let header = `🤖 <b>AI News Update (Actions Run)</b>\n━━━━━━━━━━━━━━━━━━━━━\n🕐 ${escapeHTML(now)} IST\n📰 <b>${articles.length} New Articles</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
  let body = '';
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    body += `${numberEmojis[i] || `#${i + 1}`} <b>${escapeHTML(a.title)}</b>\n   ${a.sourceEmoji} ${escapeHTML(a.source)} • ${escapeHTML(formatTimeIST(a.pubDate))}\n`;
    if (a.description) body += `   ${escapeHTML(a.description)}\n`;
    body += `   🔗 <a href="${a.link}">Read More</a>\n\n`;
  }
  let footer = `━━━━━━━━━━━━━━━━━━━━━\n⚡ <i>GitHub Action Run Complete</i>`;
  return header + body + footer;
}

async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${CONFIG.telegram.token}/sendMessage`;
  // Telegram character limit is 4096. Clean split if needed.
  if (text.length <= 4000) {
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  } else {
    // Basic chunking
    const chunks = [];
    let current = '';
    const lines = text.split('\n');
    for (const line of lines) {
      if ((current + '\n' + line).length > 4000) {
        chunks.push(current);
        current = line;
      } else {
        current += (current ? '\n' : '') + line;
      }
    }
    if (current) chunks.push(current);
    for (const chunk of chunks) {
      await axios.post(url, {
        chat_id: chatId,
        text: chunk,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      await sleep(500);
    }
  }
}

// ─── Main ──────────────────────────────────────
async function main() {
  log('🚀 Starting run-once-telegram script...');

  if (!CONFIG.telegram.token) {
    log('❌ TELEGRAM_BOT_TOKEN is missing!');
    process.exit(1);
  }

  try {
    const allArticles = await getAllLatestNews();
    if (allArticles.length === 0) {
      log('ℹ️ No articles found.');
      process.exit(0);
    }

    // Filter to only include articles published in the last NEWS_INTERVAL_MINUTES (default 90 mins)
    const maxAgeMs = CONFIG.schedule.intervalMinutes * 60 * 1000;
    const now = Date.now();
    const newArticles = allArticles.filter(a => (now - a.pubDate.getTime()) <= maxAgeMs).slice(0, CONFIG.maxArticles);

    if (newArticles.length === 0) {
      log('ℹ️ No NEW articles published in the last scheduled interval. Skipping send.');
      process.exit(0);
    }

    log(`📰 Found ${newArticles.length} new articles to send.`);

    const newsMessage = formatNewsMessage(newArticles);
    let summaryMessage = '';
    try {
      const summary = await generateHindiSummary(newArticles);
      if (summary) {
        summaryMessage = `\n\n🇮🇳 <b>Hindi Summary:</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n${escapeHTML(summary)}`;
      }
    } catch (aiErr) {
      log(`⚠️ Summary generation failed: ${aiErr.message}`);
    }

    const fullMessage = newsMessage + summaryMessage;

    for (const chatId of CONFIG.telegram.chatIds) {
      try {
        log(`📤 Sending to chat ${chatId}...`);
        await sendTelegramMessage(chatId, fullMessage);
        log(`✅ Sent to chat ${chatId}`);
      } catch (sendErr) {
        log(`❌ Error sending to chat ${chatId}: ${sendErr.response?.data?.description || sendErr.message}`);
      }
    }

    log('🎉 Run complete!');
    process.exit(0);
  } catch (err) {
    log(`❌ Fatal error: ${err.message}`);
    process.exit(1);
  }
}

main();
