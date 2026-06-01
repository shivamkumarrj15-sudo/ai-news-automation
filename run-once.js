// ============================================
//  🤖 AI News — Daily Digest (One Email Per Day)
//  Runs once daily at 6 PM IST via GitHub Actions
//  No duplicate AI updates, clean formatted email
// ============================================

require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// ─── Log File ────────────────────────────────
const LOG_FILE = path.join(__dirname, 'bot.log');

function log(msg) {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch(e) {}
}

// ─── Configuration ───────────────────────────
const CONFIG = {
  newsApi: {
    key: process.env.NEWS_API_KEY,
    baseUrl: 'https://newsapi.org/v2/everything',
    query: 'artificial intelligence OR AI launch OR AI tool OR ChatGPT OR Gemini OR Claude OR OpenAI OR Google AI OR Microsoft AI OR Meta AI OR xAI OR Grok OR Mistral OR Anthropic',
    pageSize: 100,
    sortBy: 'publishedAt',
    language: 'en',
  },
  email: {
    sender: process.env.SENDER_EMAIL,
    password: process.env.SENDER_APP_PASSWORD,
    receiver: process.env.RECEIVER_EMAIL,
  },
};

// ─── Gmail SMTP Transporter ──────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: CONFIG.email.sender,
    pass: CONFIG.email.password,
  },
});

// ─── Known AI Products & Companies ───────────
const AI_DATABASE = [
  { names: ['chatgpt', 'gpt-4', 'gpt-5', 'gpt-4o', 'gpt-4.5', 'o1', 'o3', 'o4-mini'], company: 'OpenAI', icon: '🟢' },
  { names: ['gemini', 'gemini ultra', 'gemini pro', 'gemini nano', 'gemini 2.5', 'gemma', 'bard'], company: 'Google DeepMind', icon: '🔵' },
  { names: ['claude', 'claude opus', 'claude sonnet', 'claude haiku', 'anthropic'], company: 'Anthropic', icon: '🟠' },
  { names: ['copilot', 'bing ai', 'microsoft ai', 'phi-4', 'phi-3', 'mai-1'], company: 'Microsoft', icon: '🟣' },
  { names: ['meta ai', 'llama', 'llama 4', 'llama 3', 'meta llama'], company: 'Meta', icon: '🔷' },
  { names: ['grok', 'grok-2', 'grok-3', 'xai'], company: 'xAI (Elon Musk)', icon: '⚫' },
  { names: ['mistral', 'mixtral', 'mistral large', 'mistral ai', 'le chat'], company: 'Mistral AI', icon: '🟤' },
  { names: ['midjourney'], company: 'Midjourney Inc.', icon: '🎨' },
  { names: ['stable diffusion', 'stability ai', 'stable audio'], company: 'Stability AI', icon: '🖼️' },
  { names: ['dall-e', 'dall·e', 'dalle'], company: 'OpenAI', icon: '🎭' },
  { names: ['sora'], company: 'OpenAI', icon: '🎬' },
  { names: ['perplexity'], company: 'Perplexity AI', icon: '🔍' },
  { names: ['deepseek', 'deep seek'], company: 'DeepSeek (China)', icon: '🐋' },
  { names: ['cohere', 'command r'], company: 'Cohere', icon: '💎' },
  { names: ['suno', 'suno ai'], company: 'Suno AI', icon: '🎵' },
  { names: ['runway', 'gen-3', 'gen-2'], company: 'Runway ML', icon: '🎥' },
  { names: ['adobe firefly', 'firefly'], company: 'Adobe', icon: '🔥' },
  { names: ['apple intelligence', 'apple ai'], company: 'Apple', icon: '🍎' },
  { names: ['alexa ai', 'amazon ai', 'bedrock', 'titan'], company: 'Amazon', icon: '📦' },
  { names: ['nvidia ai', 'nvidia'], company: 'NVIDIA', icon: '💚' },
  { names: ['hugging face', 'huggingface'], company: 'Hugging Face', icon: '🤗' },
  { names: ['inflection', 'pi ai'], company: 'Inflection AI', icon: '🌀' },
  { names: ['character ai', 'character.ai'], company: 'Character.AI', icon: '💬' },
  { names: ['jasper ai', 'jasper'], company: 'Jasper AI', icon: '✍️' },
  { names: ['cursor', 'cursor ai'], company: 'Anysphere', icon: '💻' },
  { names: ['replit', 'replit ai', 'ghostwriter'], company: 'Replit', icon: '👻' },
  { names: ['windsurf', 'codeium'], company: 'Codeium', icon: '🏄' },
];

// ─── Detect AI name & company from article ───
function detectAI(article) {
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();

  for (const ai of AI_DATABASE) {
    for (const name of ai.names) {
      if (text.includes(name)) {
        return {
          aiName: name.charAt(0).toUpperCase() + name.slice(1),
          company: ai.company,
          icon: ai.icon,
        };
      }
    }
  }

  return null;
}

// ─── Extract what the AI does from description ─
function extractPurpose(article) {
  const desc = article.description || article.title || '';
  // Clean and trim to 200 chars max
  const clean = desc.replace(/<[^>]*>/g, '').trim();
  return clean.length > 200 ? clean.substring(0, 200) + '...' : clean;
}

// ─── Fetch Latest AI News ────────────────────
async function fetchAINews() {
  try {
    const response = await axios.get(CONFIG.newsApi.baseUrl, {
      params: {
        q: CONFIG.newsApi.query,
        sortBy: CONFIG.newsApi.sortBy,
        language: CONFIG.newsApi.language,
        pageSize: CONFIG.newsApi.pageSize,
        apiKey: CONFIG.newsApi.key,
      },
    });

    if (response.data.status === 'ok' && response.data.articles.length > 0) {
      return response.data.articles;
    }
    return [];
  } catch (error) {
    log(`❌ News API Error: ${error.response?.data?.message || error.message}`);
    return [];
  }
}

// ─── Process & Deduplicate ───────────────────
function processArticles(articles) {
  const seenAIs = new Map(); // Track unique AIs

  for (const article of articles) {
    const detected = detectAI(article);
    if (!detected) continue;

    const key = detected.aiName.toLowerCase();

    // Skip if already seen this AI
    if (seenAIs.has(key)) continue;

    seenAIs.set(key, {
      aiName: detected.aiName,
      company: detected.company,
      icon: detected.icon,
      purpose: extractPurpose(article),
      source: article.source?.name || 'Unknown',
      url: article.url,
      publishedAt: article.publishedAt,
    });
  }

  return Array.from(seenAIs.values());
}

// ─── Format Time (IST) ──────────────────────
function formatTimeIST(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateIST() {
  return new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Build Daily Digest HTML Email ───────────
function buildEmailHTML(aiUpdates) {
  const today = formatDateIST();
  const now = formatTimeIST(new Date().toISOString());

  const updateCards = aiUpdates
    .map((update, index) => {
      return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #313244;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50" style="vertical-align:top;padding-right:12px;">
                <div style="width:44px;height:44px;background:#313244;border-radius:12px;text-align:center;line-height:44px;font-size:22px;">
                  ${update.icon}
                </div>
              </td>
              <td style="vertical-align:top;">
                <div style="margin-bottom:6px;">
                  <span style="color:#cdd6f4;font-size:16px;font-weight:700;">${update.aiName}</span>
                  <span style="color:#585b70;margin:0 6px;">•</span>
                  <span style="background:linear-gradient(135deg,#89b4fa,#74c7ec);color:#1e1e2e;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;">${update.company}</span>
                </div>
                <p style="color:#bac2de;font-size:13px;line-height:1.5;margin:0 0 8px 0;">
                  ${update.purpose}
                </p>
                <div>
                  <a href="${update.url}" target="_blank" style="color:#89b4fa;font-size:12px;text-decoration:none;font-weight:600;">
                    Read More →
                  </a>
                  <span style="color:#585b70;font-size:11px;margin-left:10px;">${update.source}</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
  <body style="margin:0;padding:0;background:#11111b;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:30px 20px;">

      <!-- Header -->
      <div style="text-align:center;margin-bottom:30px;padding:30px;background:linear-gradient(135deg,#1e1e2e 0%,#181825 100%);border-radius:16px;border:1px solid #313244;">
        <div style="font-size:48px;margin-bottom:10px;">🤖</div>
        <h1 style="color:#cdd6f4;font-size:24px;font-weight:800;margin:0;">AI Daily Digest</h1>
        <p style="color:#a6adc8;font-size:14px;margin:8px 0 0 0;">📅 ${today}</p>
        <p style="color:#585b70;font-size:12px;margin:4px 0 0 0;">🕐 ${now} IST</p>
        <div style="margin-top:15px;background:#313244;border-radius:8px;padding:8px 16px;display:inline-block;">
          <span style="color:#a6e3a1;font-size:13px;font-weight:600;">🚀 ${aiUpdates.length} AI Updates Today</span>
        </div>
      </div>

      <!-- AI Updates List -->
      <div style="background:#1e1e2e;border-radius:12px;padding:20px;border:1px solid #313244;margin-bottom:20px;">
        <h2 style="color:#cdd6f4;font-size:16px;font-weight:700;margin:0 0 15px 0;padding-bottom:10px;border-bottom:1px solid #313244;">
          📰 Aaj Ki AI Updates
        </h2>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${updateCards}
        </table>
      </div>

      <!-- Summary Box -->
      <div style="background:#1e1e2e;border-radius:12px;padding:20px;border:1px solid #313244;margin-bottom:20px;">
        <h3 style="color:#cdd6f4;font-size:14px;font-weight:700;margin:0 0 12px 0;">📊 Quick Summary</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${aiUpdates.map(u => `
          <tr>
            <td style="padding:4px 0;color:#bac2de;font-size:13px;">
              ${u.icon} <strong style="color:#cdd6f4;">${u.aiName}</strong>
              <span style="color:#585b70;">—</span>
              <span style="color:#a6adc8;">${u.company}</span>
            </td>
          </tr>`).join('')}
        </table>
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:25px;margin-top:10px;border-top:1px solid #313244;">
        <p style="color:#585b70;font-size:12px;margin:0;">
          ⚡ Powered by AI News Automation Bot<br/>
          📡 Source: NewsAPI.org | 📅 Daily at 6:00 PM IST<br/>
          🔄 No duplicate updates — Each AI listed once<br/>
          Built with ❤️ by Shivam
        </p>
      </div>

    </div>
  </body>
  </html>`;
}

// ─── Send Email ──────────────────────────────
async function sendEmail(aiUpdates) {
  const today = formatDateIST();
  const mailOptions = {
    from: `"🤖 AI Daily Digest" <${CONFIG.email.sender}>`,
    to: CONFIG.email.receiver,
    subject: `🤖 AI Daily Digest — ${today} | ${aiUpdates.length} Updates`,
    html: buildEmailHTML(aiUpdates),
  };

  const info = await transporter.sendMail(mailOptions);
  log(`✅ Email sent! ID: ${info.messageId}`);
}

// ─── Main ────────────────────────────────────
async function main() {
  log('═══ AI Daily Digest — Running ═══');

  try {
    const articles = await fetchAINews();
    log(`📥 Fetched ${articles.length} raw articles from News API`);

    const aiUpdates = processArticles(articles);
    log(`🤖 Found ${aiUpdates.length} unique AI updates (deduplicated)`);

    if (aiUpdates.length === 0) {
      log('⚠️ No AI updates found today. Skipping email.');
      process.exit(0);
    }

    await sendEmail(aiUpdates);
    log('✅ Daily digest sent. Exiting.');
    process.exit(0);
  } catch (err) {
    log(`❌ Fatal Error: ${err.message}`);
    process.exit(1);
  }
}

main();
