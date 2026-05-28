// ============================================
//  🤖 AI News Telegram Bot
//  Scheduled AI News + Interactive Gemini Q&A
//  Built with ❤️ by Shivam
// ============================================

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Parser = require('rss-parser');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

// ─── Configuration ─────────────────────────────
const CONFIG = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    // Fallback models for OpenRouter (including free models)
    models: [
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-lite-001',
    ],
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    // Fallback model chain for direct Google Gemini API
    models: [
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
    ],
    maxRetries: 3,
    retryBaseDelayMs: 5000, // 5s → 10s → 20s exponential backoff
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

// ─── Rate Limiter ──────────────────────────────
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.timestamps = [];
  }

  async waitForSlot() {
    const now = Date.now();
    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(t => t > now - this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const waitTime = this.timestamps[0] + this.windowMs - now + 500;
      log(`⏳ Rate limit: waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(r => setTimeout(r, waitTime));
      return this.waitForSlot(); // Recheck after waiting
    }

    this.timestamps.push(now);
  }
}

// Max 8 Gemini requests per minute (free tier allows ~10)
const geminiRateLimiter = new RateLimiter(8, 60000);

// ─── RSS Feed Sources ──────────────────────────
const RSS_FEEDS = [
  { name: 'TechCrunch', emoji: '🔵', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'VentureBeat', emoji: '🟣', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'The Verge', emoji: '🟢', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
];

// ─── Data Persistence Paths ────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const SENT_ARTICLES_FILE = path.join(DATA_DIR, 'sent-articles.json');
const CHAT_IDS_FILE = path.join(DATA_DIR, 'chat-ids.json');
const LOG_FILE = path.join(__dirname, 'telegram-bot.log');

// ─── Initialize Services ──────────────────────
const bot = new TelegramBot(CONFIG.telegram.token, { polling: true });
const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'AI-News-Bot/1.0' },
});
const ai = CONFIG.gemini.apiKey ? new GoogleGenAI({ apiKey: CONFIG.gemini.apiKey }) : null;

// ─── State ─────────────────────────────────────
let sentArticleUrls = new Set();
let registeredChatIds = new Set();
let lastNewsArticles = [];
let schedulerInterval = null;

// ═══════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════

function log(msg) {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (_) {}
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSentArticles() {
  try {
    if (fs.existsSync(SENT_ARTICLES_FILE)) {
      const data = JSON.parse(fs.readFileSync(SENT_ARTICLES_FILE, 'utf8'));
      sentArticleUrls = new Set(data.slice(-500)); // Keep last 500
    }
  } catch (_) {
    sentArticleUrls = new Set();
  }
}

function saveSentArticles() {
  try {
    const data = [...sentArticleUrls].slice(-500);
    fs.writeFileSync(SENT_ARTICLES_FILE, JSON.stringify(data, null, 2));
  } catch (_) {}
}

function loadChatIds() {
  try {
    if (fs.existsSync(CHAT_IDS_FILE)) {
      const data = JSON.parse(fs.readFileSync(CHAT_IDS_FILE, 'utf8'));
      registeredChatIds = new Set(data);
    }
  } catch (_) {
    registeredChatIds = new Set();
  }
}

function saveChatId(chatId) {
  registeredChatIds.add(chatId);
  try {
    fs.writeFileSync(CHAT_IDS_FILE, JSON.stringify([...registeredChatIds], null, 2));
  } catch (_) {}
}

function escapeHTML(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

// ═══════════════════════════════════════════════
//  NEWS FETCHING
// ═══════════════════════════════════════════════

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
      log(`📡 RSS: ${feed.name} → ${articles.length} articles`);
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
      const articles = response.data.articles
        .filter(a => a.title && a.title !== '[Removed]')
        .map(a => ({
          title: stripHTML(a.title),
          link: a.url || '',
          pubDate: a.publishedAt ? new Date(a.publishedAt) : new Date(),
          source: a.source?.name || 'NewsAPI',
          sourceEmoji: '🔴',
          description: truncate(stripHTML(a.description || ''), 250),
        }));
      log(`📡 NewsAPI → ${articles.length} articles`);
      return articles;
    }
  } catch (err) {
    log(`⚠️ NewsAPI Error: ${err.response?.data?.message || err.message}`);
  }

  return [];
}

async function getAllLatestNews() {
  const [rssArticles, newsApiArticles] = await Promise.all([
    fetchRSSNews(),
    fetchNewsAPI(),
  ]);

  // Combine all articles
  const allArticles = [...rssArticles, ...newsApiArticles];

  // Deduplicate by URL
  const seen = new Set();
  const unique = allArticles.filter(a => {
    if (!a.link || seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });

  // Sort by date (newest first)
  unique.sort((a, b) => b.pubDate - a.pubDate);

  // Return top N
  return unique.slice(0, CONFIG.maxArticles);
}

// ═══════════════════════════════════════════════
//  GEMINI AI — with Retry, Fallback & Rate Limit
// ═══════════════════════════════════════════════

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract retry delay from Gemini error response
function getRetryDelay(error) {
  try {
    const msg = error.message || '';
    const match = msg.match(/retry in ([\d.]+)s/i) || msg.match(/retryDelay.*?(\d+)s/i);
    if (match) return Math.ceil(parseFloat(match[1])) * 1000;
  } catch (_) {}
  return null;
}

// Core OpenRouter call with single model
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

// Core Gemini call with single model
async function callGeminiModel(model, userPrompt, systemInstruction) {
  if (!ai) {
    throw new Error('Gemini API client not initialized');
  }
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

// Main AI calling function: try OpenRouter first, then fallback to direct Gemini API
async function askGemini(userPrompt, systemInstruction = '') {
  const defaultSystem = `You are "AI News Bot" 🤖, a helpful AI assistant on Telegram. 
You specialize in AI, technology, and latest developments.
Reply in the SAME language as the user's message (Hindi/Hinglish/English).
Keep responses concise, informative, and engaging. Use emojis where appropriate.
If the user asks about recent AI news, use this context:\n${lastNewsArticles.map(a => `- ${a.title} (${a.source})`).join('\n')}`;

  const sysPrompt = systemInstruction || defaultSystem;

  // 1. TRY OPENROUTER FIRST (if configured)
  if (CONFIG.openrouter.apiKey) {
    for (let modelIdx = 0; modelIdx < CONFIG.openrouter.models.length; modelIdx++) {
      const model = CONFIG.openrouter.models[modelIdx];

      for (let attempt = 1; attempt <= CONFIG.gemini.maxRetries; attempt++) {
        try {
          const result = await callOpenRouterModel(model, userPrompt, sysPrompt);

          if (result) {
            if (modelIdx > 0 || attempt > 1) {
              log(`✅ OpenRouter success: model=${model}, attempt=${attempt}`);
            }
            return result;
          }
        } catch (error) {
          const errMsg = error.response?.data?.error?.message || error.message || '';
          log(`⚠️ OpenRouter [${model}] attempt ${attempt}/${CONFIG.gemini.maxRetries} Error: ${errMsg.substring(0, 150)}`);

          if (attempt < CONFIG.gemini.maxRetries) {
            const waitTime = CONFIG.gemini.retryBaseDelayMs * Math.pow(2, attempt - 1);
            log(`⏳ Waiting ${Math.ceil(waitTime / 1000)}s before retry...`);
            await sleep(waitTime);
          }
        }
      }
    }
    log(`⚠️ All OpenRouter models failed. Falling back to direct Google Gemini API...`);
  }

  // 2. FALLBACK TO DIRECT GEMINI API
  if (CONFIG.gemini.apiKey && ai) {
    for (let modelIdx = 0; modelIdx < CONFIG.gemini.models.length; modelIdx++) {
      const model = CONFIG.gemini.models[modelIdx];

      // Retry loop for current model
      for (let attempt = 1; attempt <= CONFIG.gemini.maxRetries; attempt++) {
        try {
          // Wait for rate limit slot
          await geminiRateLimiter.waitForSlot();

          const result = await callGeminiModel(model, userPrompt, sysPrompt);

          if (result) {
            if (modelIdx > 0 || attempt > 1) {
              log(`✅ Gemini success: model=${model}, attempt=${attempt}`);
            }
            return result;
          }
        } catch (error) {
          const errMsg = error.message || '';
          const is429 = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');
          const is503 = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('overloaded');

          log(`⚠️ Gemini [${model}] attempt ${attempt}/${CONFIG.gemini.maxRetries}: ${is429 ? '429 Rate Limit' : is503 ? '503 Overloaded' : 'Error'} — ${errMsg.substring(0, 150)}`);

          if (is429 || is503) {
            // Get retry delay from error or use exponential backoff
            const serverDelay = getRetryDelay(error);
            const backoffDelay = CONFIG.gemini.retryBaseDelayMs * Math.pow(2, attempt - 1);
            const waitTime = serverDelay || backoffDelay;

            if (attempt < CONFIG.gemini.maxRetries) {
              log(`⏳ Waiting ${Math.ceil(waitTime / 1000)}s before retry...`);
              await sleep(waitTime);
              continue; // Retry same model
            }
            // All retries exhausted for this model, try next model
            log(`🔄 Model ${model} exhausted, trying next fallback...`);
            break;
          } else {
            // Non-retryable error (auth, invalid request, etc.)
            log(`❌ Non-retryable Gemini error: ${errMsg.substring(0, 200)}`);
            // Try next model
            break;
          }
        }
      }
    }
  }

  // All models and providers exhausted
  log(`❌ All AI models (OpenRouter & Gemini) failed after retries.`);
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

  const result = await askGemini(prompt, 'You are a Hindi news summarizer. Write concise Hindi/Hinglish summaries of tech news articles. Use simple language that everyone can understand.');
  return result || '⚠️ Hindi summary generate nahi ho payi. Thodi der baad /hindi try karo.';
}

// ═══════════════════════════════════════════════
//  TELEGRAM MESSAGE FORMATTING
// ═══════════════════════════════════════════════

function formatNewsMessage(articles) {
  const now = formatTimeIST(new Date());
  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

  let header = `🤖 <b>AI News Update</b>\n`;
  header += `━━━━━━━━━━━━━━━━━━━━━\n`;
  header += `🕐 ${escapeHTML(now)} IST\n`;
  header += `📰 <b>${articles.length} Latest Articles</b>\n`;
  header += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  let body = '';
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const num = numberEmojis[i] || `#${i + 1}`;
    const time = formatTimeIST(a.pubDate);

    body += `${num} <b>${escapeHTML(a.title)}</b>\n`;
    body += `   ${a.sourceEmoji} ${escapeHTML(a.source)} • ${escapeHTML(time)}\n`;
    if (a.description) {
      body += `   ${escapeHTML(a.description)}\n`;
    }
    body += `   🔗 <a href="${a.link}">Read More</a>\n\n`;
  }

  let footer = `━━━━━━━━━━━━━━━━━━━━━\n`;
  footer += `⚡ <i>Powered by AI News Bot</i>\n`;
  footer += `💬 <i>कोई सवाल है? बस reply करो!</i>\n`;
  footer += `📋 /help — सभी commands देखो`;

  return header + body + footer;
}

// Split message if > 4096 chars (Telegram limit)
function splitMessage(text, maxLength = 4000) {
  if (text.length <= maxLength) return [text];

  const parts = [];
  let current = '';
  const lines = text.split('\n');

  for (const line of lines) {
    if ((current + '\n' + line).length > maxLength) {
      if (current) parts.push(current.trim());
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts;
}

async function sendLongMessage(chatId, text, options = {}) {
  const parts = splitMessage(text);
  for (const part of parts) {
    try {
      await bot.sendMessage(chatId, part, options);
      // Small delay between parts to avoid rate limiting
      if (parts.length > 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      log(`❌ Send Error (chat ${chatId}): ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════
//  COMMAND HANDLERS
// ═══════════════════════════════════════════════

// /start — Welcome + Register
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  saveChatId(chatId);
  log(`👤 New user registered: ${msg.from?.first_name || 'Unknown'} (${chatId})`);

  const welcome = `🤖 <b>Welcome to AI News Bot!</b>\n\n` +
    `Namaste <b>${escapeHTML(msg.from?.first_name || 'Friend')}</b>! 🙏\n\n` +
    `Main tumhe har <b>${CONFIG.schedule.intervalMinutes} minutes</b> mein latest AI news bhejunga! 🚀\n\n` +
    `<b>🎯 Main Features:</b>\n` +
    `├ 📰 Automatic AI news every ${CONFIG.schedule.intervalMinutes} min\n` +
    `├ 💬 Koi bhi sawaal pucho — AI reply dega\n` +
    `├ 🇮🇳 Hindi summary available\n` +
    `└ 🔗 Direct article links\n\n` +
    `<b>📋 Commands:</b>\n` +
    `├ /news — Abhi turant latest news\n` +
    `├ /hindi — Hindi mein news summary\n` +
    `├ /ask — AI se koi bhi sawaal pucho\n` +
    `├ /status — Bot status dekho\n` +
    `└ /help — Sab commands ki list\n\n` +
    `<b>💡 Tip:</b> Bina command ke bhi kuch bhi type karo — AI reply karega! ✨\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 Your Chat ID: <code>${chatId}</code>\n` +
    `⏰ Schedule: Every ${CONFIG.schedule.intervalMinutes} minutes`;

  await bot.sendMessage(chatId, welcome, { parse_mode: 'HTML' });

  // Send first news immediately
  await sendNewsToChat(chatId);
});

// /news — On-demand latest news
bot.onText(/\/news/, async (msg) => {
  const chatId = msg.chat.id;
  saveChatId(chatId);

  await bot.sendMessage(chatId, '🔄 <i>Latest AI news fetch ho rahi hai...</i>', { parse_mode: 'HTML' });

  try {
    const articles = await getAllLatestNews();

    if (articles.length === 0) {
      await bot.sendMessage(chatId, '😕 Abhi koi nayi AI news nahi mili. Thodi der baad try karo!', { parse_mode: 'HTML' });
      return;
    }

    lastNewsArticles = articles;
    const message = formatNewsMessage(articles);
    await sendLongMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true });

    log(`📤 On-demand news sent to chat ${chatId} (${articles.length} articles)`);
  } catch (err) {
    log(`❌ /news Error: ${err.message}`);
    await bot.sendMessage(chatId, '❌ News fetch mein error aaya. Thodi der baad try karo.');
  }
});

// /hindi — Hindi summary of latest news
bot.onText(/\/hindi/, async (msg) => {
  const chatId = msg.chat.id;
  saveChatId(chatId);

  if (lastNewsArticles.length === 0) {
    await bot.sendMessage(chatId, '⚠️ Pehle /news run karo taaki articles fetch ho jayein!');
    return;
  }

  await bot.sendMessage(chatId, '🇮🇳 <i>Hindi summary generate ho rahi hai...</i>', { parse_mode: 'HTML' });

  try {
    const hindiSummary = await generateHindiSummary(lastNewsArticles);

    const message = `🇮🇳 <b>AI News — Hindi Summary</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${escapeHTML(hindiSummary)}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 <i>Full articles ke liye /news use karo</i>`;

    await sendLongMessage(chatId, message, { parse_mode: 'HTML' });
    log(`🇮🇳 Hindi summary sent to chat ${chatId}`);
  } catch (err) {
    log(`❌ /hindi Error: ${err.message}`);
    await bot.sendMessage(chatId, '❌ Hindi summary generate nahi ho payi. Try again!');
  }
});

// /ask <question> — Direct AI question
bot.onText(/\/ask (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const question = match[1];
  saveChatId(chatId);

  await bot.sendMessage(chatId, '🧠 <i>Soch raha hoon...</i>', { parse_mode: 'HTML' });

  try {
    const answer = await askGemini(question);

    if (!answer) {
      await bot.sendMessage(chatId, '⚠️ AI abhi busy hai — quota limit ho gayi. 1-2 minute baad try karo! ⏰');
      return;
    }

    const message = `🧠 <b>AI Answer</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `❓ <b>Q:</b> ${escapeHTML(question)}\n\n` +
      `💡 <b>A:</b> ${escapeHTML(answer)}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Aur sawaal hai? Bas type karo!</i> 💬`;

    await sendLongMessage(chatId, message, { parse_mode: 'HTML' });
    log(`🧠 Q&A: "${question.substring(0, 50)}..." → chat ${chatId}`);
  } catch (err) {
    log(`❌ /ask Error: ${err.message}`);
    await bot.sendMessage(chatId, '❌ Answer generate nahi ho paaya. Dobara try karo!');
  }
});

// /status — Bot status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  saveChatId(chatId);

  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  const status = `📊 <b>Bot Status</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🟢 <b>Status:</b> Online & Running\n` +
    `⏱️ <b>Uptime:</b> ${hours}h ${minutes}m ${seconds}s\n` +
    `👥 <b>Registered Users:</b> ${registeredChatIds.size}\n` +
    `📰 <b>Articles Sent:</b> ${sentArticleUrls.size}\n` +
    `⏰ <b>News Schedule:</b> Every ${CONFIG.schedule.intervalMinutes} min\n` +
    `🔗 <b>RSS Sources:</b> ${RSS_FEEDS.map(f => f.name).join(', ')}\n` +
    `🤖 <b>AI Models:</b> ${CONFIG.gemini.models.join(' → ')}\n` +
    `📡 <b>NewsAPI:</b> ${CONFIG.newsApi.key ? '✅ Active' : '❌ Not configured'}\n` +
    `🔄 <b>Rate Limit:</b> ${geminiRateLimiter.timestamps.length}/${geminiRateLimiter.maxRequests} req/min\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `🕐 Server Time: ${formatTimeIST(new Date())}`;

  await bot.sendMessage(chatId, status, { parse_mode: 'HTML' });
});

// /help — All commands
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  saveChatId(chatId);

  const help = `📋 <b>AI News Bot — Commands</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `📰 /news — Latest AI news abhi turant\n` +
    `🇮🇳 /hindi — News ka Hindi summary\n` +
    `🧠 /ask &lt;question&gt; — AI se sawaal pucho\n` +
    `📊 /status — Bot ki current status\n` +
    `❓ /help — Ye help message\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `<b>💬 Interactive Chat:</b>\n` +
    `Bina command ke kuch bhi type karo!\n` +
    `Bot AI se answer generate karke reply karega.\n\n` +
    `<b>Examples:</b>\n` +
    `• "ChatGPT ka latest update kya hai?"\n` +
    `• "Explain transformer architecture"\n` +
    `• "AI jobs market kaisa hai 2026 mein?"\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ Powered by Gemini AI + RSS Feeds\n` +
    `⏰ Auto news: Every ${CONFIG.schedule.intervalMinutes} min`;

  await bot.sendMessage(chatId, help, { parse_mode: 'HTML' });
});

// ═══════════════════════════════════════════════
//  INTERACTIVE Q&A — Any message = AI reply
// ═══════════════════════════════════════════════

bot.on('message', async (msg) => {
  // Skip commands (they're handled above)
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const userMessage = msg.text.trim();
  saveChatId(chatId);

  if (!userMessage) return;

  log(`💬 Chat from ${msg.from?.first_name || 'Unknown'}: "${userMessage.substring(0, 80)}..."`);

  // Show typing indicator
  try {
    await bot.sendChatAction(chatId, 'typing');
  } catch (_) {}

  try {
    const answer = await askGemini(userMessage);

    if (!answer) {
      await bot.sendMessage(chatId,
        '⚠️ AI abhi busy hai — quota limit lag gayi hai.\n\n' +
        '💡 <b>Solutions:</b>\n' +
        '├ ⏰ 1-2 minute baad try karo\n' +
        '├ 📰 /news — news toh bina AI ke bhi aati hai\n' +
        '└ 🔑 Naya Gemini API key try karo: aistudio.google.com/apikey',
        { parse_mode: 'HTML' }
      );
      return;
    }

    await sendLongMessage(chatId, `💡 ${escapeHTML(answer)}`, { parse_mode: 'HTML' });
  } catch (err) {
    log(`❌ Chat Error: ${err.message}`);
    await bot.sendMessage(chatId, '❌ Reply generate nahi ho paaya. Thodi der baad try karo!');
  }
});

// ═══════════════════════════════════════════════
//  SCHEDULED NEWS DELIVERY
// ═══════════════════════════════════════════════

async function sendNewsToChat(chatId) {
  try {
    const articles = await getAllLatestNews();

    if (articles.length === 0) {
      log(`⚠️ No new articles found for scheduled delivery`);
      return;
    }

    // Filter out already sent articles
    const newArticles = articles.filter(a => !sentArticleUrls.has(a.link));

    if (newArticles.length === 0) {
      log(`ℹ️ All articles already sent. Skipping.`);
      return;
    }

    // Update state
    lastNewsArticles = newArticles;
    newArticles.forEach(a => sentArticleUrls.add(a.link));
    saveSentArticles();

    // Format and send news
    const newsMessage = formatNewsMessage(newArticles);
    await sendLongMessage(chatId, newsMessage, { parse_mode: 'HTML', disable_web_page_preview: true });

    // Generate and send Hindi summary
    try {
      const hindiSummary = await generateHindiSummary(newArticles);
      const hindiMessage = `\n🇮🇳 <b>Hindi Summary:</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n${escapeHTML(hindiSummary)}`;
      await sendLongMessage(chatId, hindiMessage, { parse_mode: 'HTML' });
    } catch (err) {
      log(`⚠️ Hindi summary failed: ${err.message}`);
    }

    log(`📤 Scheduled news sent to chat ${chatId} (${newArticles.length} new articles)`);
  } catch (err) {
    log(`❌ Scheduled send error (chat ${chatId}): ${err.message}`);
  }
}

async function sendScheduledNews() {
  log(`\n${'═'.repeat(50)}`);
  log(`🔄 Scheduled News Job — ${formatTimeIST(new Date())}`);
  log(`${'═'.repeat(50)}`);

  if (registeredChatIds.size === 0) {
    log(`⚠️ No registered chats. Send /start to the bot first!`);
    return;
  }

  for (const chatId of registeredChatIds) {
    await sendNewsToChat(chatId);
    // Small delay between users
    if (registeredChatIds.size > 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

function startScheduler() {
  const intervalMs = CONFIG.schedule.intervalMinutes * 60 * 1000;
  const intervalHours = (CONFIG.schedule.intervalMinutes / 60).toFixed(1);

  log(`⏰ Scheduler started: Every ${CONFIG.schedule.intervalMinutes} minutes (${intervalHours} hours)`);

  schedulerInterval = setInterval(() => {
    sendScheduledNews();
  }, intervalMs);
}

// ═══════════════════════════════════════════════
//  ERROR HANDLING
// ═══════════════════════════════════════════════

bot.on('polling_error', (error) => {
  if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
    log(`⚠️ Another bot instance is running. Please stop it first.`);
  } else if (error.code === 'EFATAL') {
    log(`💀 Fatal polling error: ${error.message}`);
  } else {
    log(`⚠️ Polling error: ${error.message}`);
  }
});

bot.on('error', (error) => {
  log(`❌ Bot error: ${error.message}`);
});

process.on('unhandledRejection', (reason) => {
  log(`❌ Unhandled rejection: ${reason}`);
});

process.on('SIGINT', () => {
  log(`\n🛑 Bot shutting down gracefully...`);
  if (schedulerInterval) clearInterval(schedulerInterval);
  saveSentArticles();
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log(`\n🛑 Bot terminated.`);
  if (schedulerInterval) clearInterval(schedulerInterval);
  saveSentArticles();
  bot.stopPolling();
  process.exit(0);
});

// ═══════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════

async function main() {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  🤖 AI News Telegram Bot — Starting...`);
  console.log(`${'═'.repeat(55)}`);

  // Validate config
  if (!CONFIG.telegram.token) {
    console.error('❌ TELEGRAM_BOT_TOKEN is missing in .env!');
    console.error('   @BotFather se token lo aur .env mein paste karo.');
    process.exit(1);
  }

  if (!CONFIG.gemini.apiKey && !CONFIG.openrouter.apiKey) {
    console.error('❌ Both GEMINI_API_KEY and OPENROUTER_API_KEY are missing in .env!');
    console.error('   Kam se kam ek AI API Key configuration zaroori hai.');
    process.exit(1);
  }

  // Initialize data
  ensureDataDir();
  loadSentArticles();
  loadChatIds();

  console.log(`  📡 RSS Feeds    : ${RSS_FEEDS.map(f => f.name).join(', ')}`);
  if (CONFIG.openrouter.apiKey) {
    console.log(`  🤖 OpenRouter   : ✅ Enabled (Models: ${CONFIG.openrouter.models.join(', ')})`);
  }
  if (CONFIG.gemini.apiKey) {
    console.log(`  🤖 Gemini API   : ✅ Enabled (Models: ${CONFIG.gemini.models.join(', ')})`);
  }
  console.log(`  ⏰ Schedule     : Every ${CONFIG.schedule.intervalMinutes} min`);
  console.log(`  👥 Saved Users  : ${registeredChatIds.size}`);
  console.log(`  📰 Sent Articles: ${sentArticleUrls.size}`);
  console.log(`  📡 NewsAPI      : ${CONFIG.newsApi.key ? '✅ Active' : '⚠️ Not configured'}`);
  console.log(`${'═'.repeat(55)}`);

  // Start scheduler
  startScheduler();

  console.log(`\n  ✅ Bot is LIVE! Send /start to your bot on Telegram.`);
  console.log(`  💡 Press Ctrl+C to stop.\n`);

  // If we have registered users, send news immediately on boot
  if (registeredChatIds.size > 0) {
    log(`📤 Sending initial news to ${registeredChatIds.size} user(s)...`);
    // Slight delay to ensure bot is fully ready
    setTimeout(() => sendScheduledNews(), 3000);
  }
}

main();
