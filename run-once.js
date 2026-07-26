// ============================================
//  🤖 AI Daily Digest — Complete AI Updates
//  Categories: 🎬 Video AI | ⚙️ Automation AI | 🏢 Largest AI
//  Runs daily at 6 PM IST | No duplicates | Free tools highlighted
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

// ─── Search Queries (multiple for better coverage) ─
const SEARCH_QUERIES = [
  'ChatGPT OR Gemini AI OR Claude OR OpenAI OR Google AI OR Anthropic OR Meta AI OR xAI OR Grok',
  'Sora OR Runway AI OR Pika OR Kling AI OR HeyGen OR Synthesia OR AI video',
  'AI automation OR Zapier AI OR Make AI OR n8n AI OR AutoGPT OR AI agent OR AI workflow',
  'Midjourney OR Stable Diffusion OR DALL-E OR AI image OR Copilot OR Cursor AI OR Perplexity',
  'DeepSeek OR Mistral OR LLaMA OR Nvidia AI OR Apple Intelligence OR AI free tool',
];

// ─── Gmail SMTP Transporter ──────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: CONFIG.email.sender, pass: CONFIG.email.password },
});

// ─── AI Database with Categories ─────────────
const AI_DATABASE = [
  // 🏢 LARGEST AI COMPANIES
  { names: ['chatgpt', 'gpt-4', 'gpt-5', 'gpt-4o', 'gpt-4.5', 'gpt-o1', 'gpt-o3', 'o4-mini', 'openai'], company: 'OpenAI', icon: '🟢', category: 'largest', free: true, desc: 'AI chatbot — text, image, code generation' },
  { names: ['gemini', 'gemini ultra', 'gemini pro', 'gemini nano', 'gemini 2.5', 'gemma'], company: 'Google DeepMind', icon: '🔵', category: 'largest', free: true, desc: 'Google ka AI assistant — multimodal AI' },
  { names: ['claude', 'claude opus', 'claude sonnet', 'claude haiku'], company: 'Anthropic', icon: '🟠', category: 'largest', free: true, desc: 'Safe AI assistant — coding, analysis, writing' },
  { names: ['copilot', 'bing ai', 'microsoft ai', 'phi-4', 'phi-3'], company: 'Microsoft', icon: '🟣', category: 'largest', free: true, desc: 'AI assistant integrated in Windows, Office, Edge' },
  { names: ['meta ai', 'llama', 'llama 4', 'llama 3', 'meta llama'], company: 'Meta', icon: '🔷', category: 'largest', free: true, desc: 'Open-source AI models — free for everyone' },
  { names: ['grok', 'grok-2', 'grok-3', 'grok-4', 'xai'], company: 'xAI (Elon Musk)', icon: '⚫', category: 'largest', free: true, desc: 'X/Twitter ka AI — real-time information' },
  { names: ['deepseek', 'deep seek'], company: 'DeepSeek (China)', icon: '🐋', category: 'largest', free: true, desc: 'Chinese open-source AI — coding & reasoning' },
  { names: ['mistral', 'mixtral', 'mistral large', 'le chat'], company: 'Mistral AI', icon: '🟤', category: 'largest', free: true, desc: 'European open-source AI models' },
  { names: ['perplexity'], company: 'Perplexity AI', icon: '🔍', category: 'largest', free: true, desc: 'AI search engine — answers with sources' },
  { names: ['apple intelligence', 'apple ai'], company: 'Apple', icon: '🍎', category: 'largest', free: true, desc: 'iPhone, Mac ke liye built-in AI features' },
  { names: ['nvidia ai', 'nvidia'], company: 'NVIDIA', icon: '💚', category: 'largest', free: false, desc: 'AI chips & GPU — powers most AI models' },
  { names: ['amazon ai', 'bedrock', 'alexa ai'], company: 'Amazon', icon: '📦', category: 'largest', free: false, desc: 'Cloud AI services & Alexa voice AI' },

  // 🎬 VIDEO AI TOOLS
  { names: ['sora'], company: 'OpenAI', icon: '🎬', category: 'video', free: false, desc: 'Text-to-video AI — realistic video generation' },
  { names: ['runway', 'runway ml', 'gen-3', 'gen-4'], company: 'Runway ML', icon: '🎥', category: 'video', free: true, desc: 'AI video editing, text-to-video, image-to-video' },
  { names: ['pika', 'pika labs', 'pika ai'], company: 'Pika Labs', icon: '🎞️', category: 'video', free: true, desc: 'Free AI video generator — text/image to video' },
  { names: ['kling', 'kling ai', 'kuaishou'], company: 'Kuaishou (China)', icon: '🎭', category: 'video', free: true, desc: 'Free AI video generation — high quality clips' },
  { names: ['luma', 'luma ai', 'dream machine'], company: 'Luma AI', icon: '✨', category: 'video', free: true, desc: 'Dream Machine — free AI video from text/image' },
  { names: ['heygen', 'hey gen'], company: 'HeyGen', icon: '🗣️', category: 'video', free: true, desc: 'AI avatar video — talking head videos from text' },
  { names: ['synthesia'], company: 'Synthesia', icon: '👤', category: 'video', free: true, desc: 'AI video with virtual presenters — 140+ languages' },
  { names: ['d-id', 'did ai'], company: 'D-ID', icon: '😊', category: 'video', free: true, desc: 'Photo to talking video — face animation AI' },
  { names: ['invideo', 'invideo ai'], company: 'InVideo', icon: '📹', category: 'video', free: true, desc: 'AI video maker — auto editing & scripts' },
  { names: ['fliki', 'fliki ai'], company: 'Fliki', icon: '🎙️', category: 'video', free: true, desc: 'Text to video with AI voices — free tier' },
  { names: ['capcut ai', 'capcut'], company: 'ByteDance', icon: '✂️', category: 'video', free: true, desc: 'Free AI video editor — auto captions, effects' },
  { names: ['descript'], company: 'Descript', icon: '📝', category: 'video', free: true, desc: 'AI video/podcast editor — edit video like text' },
  { names: ['veed', 'veed ai'], company: 'VEED.IO', icon: '📺', category: 'video', free: true, desc: 'Online AI video editor — subtitles, effects' },

  // ⚙️ AUTOMATION AI TOOLS
  { names: ['zapier ai', 'zapier'], company: 'Zapier', icon: '⚡', category: 'automation', free: true, desc: 'No-code automation — 6000+ app connections' },
  { names: ['make.com', 'make ai', 'integromat'], company: 'Make (Integromat)', icon: '🔄', category: 'automation', free: true, desc: 'Visual automation builder — complex workflows free' },
  { names: ['n8n'], company: 'n8n.io', icon: '🔗', category: 'automation', free: true, desc: 'Open-source workflow automation — self-hostable' },
  { names: ['autogpt', 'auto-gpt', 'auto gpt'], company: 'AutoGPT (Open Source)', icon: '🤖', category: 'automation', free: true, desc: 'Autonomous AI agent — completes tasks by itself' },
  { names: ['crewai', 'crew ai'], company: 'CrewAI', icon: '👥', category: 'automation', free: true, desc: 'Multi-agent AI framework — team of AI agents' },
  { names: ['langchain'], company: 'LangChain', icon: '🔗', category: 'automation', free: true, desc: 'AI app development framework — build AI apps' },
  { names: ['botpress'], company: 'Botpress', icon: '💬', category: 'automation', free: true, desc: 'Free AI chatbot builder — no code needed' },
  { names: ['voiceflow'], company: 'Voiceflow', icon: '🎤', category: 'automation', free: true, desc: 'AI voice/chat agent builder — drag & drop' },
  { names: ['activepieces'], company: 'Activepieces', icon: '🧩', category: 'automation', free: true, desc: 'Open-source Zapier alternative — 100% free' },
  { names: ['ifttt'], company: 'IFTTT', icon: '🔀', category: 'automation', free: true, desc: 'Simple automation — if this then that triggers' },
  { names: ['dify', 'dify ai'], company: 'Dify', icon: '🏗️', category: 'automation', free: true, desc: 'Open-source AI app builder — RAG, agents, workflows' },
  { names: ['flowise'], company: 'Flowise', icon: '🌊', category: 'automation', free: true, desc: 'Open-source no-code AI workflow builder' },

  // 🎨 IMAGE AI
  { names: ['midjourney'], company: 'Midjourney Inc.', icon: '🎨', category: 'largest', free: false, desc: 'Best AI image generator — artistic quality' },
  { names: ['stable diffusion', 'stability ai'], company: 'Stability AI', icon: '🖼️', category: 'largest', free: true, desc: 'Open-source image AI — free & customizable' },
  { names: ['dall-e', 'dall·e', 'dalle'], company: 'OpenAI', icon: '🎨', category: 'largest', free: true, desc: 'AI image generation inside ChatGPT' },
  { names: ['adobe firefly', 'firefly'], company: 'Adobe', icon: '🔥', category: 'largest', free: true, desc: 'Adobe ka AI image tool — commercial safe' },
  { names: ['ideogram'], company: 'Ideogram', icon: '✏️', category: 'largest', free: true, desc: 'AI image gen — best at text in images' },

  // 💻 CODING AI
  { names: ['cursor', 'cursor ai'], company: 'Anysphere', icon: '💻', category: 'automation', free: true, desc: 'AI code editor — writes code for you' },
  { names: ['replit', 'replit ai'], company: 'Replit', icon: '👻', category: 'automation', free: true, desc: 'AI coding platform — build apps with AI' },
  { names: ['windsurf', 'codeium'], company: 'Codeium', icon: '🏄', category: 'automation', free: true, desc: 'Free AI code completion — VS Code extension' },
  { names: ['github copilot'], company: 'GitHub/Microsoft', icon: '🐙', category: 'automation', free: false, desc: 'AI pair programmer — code suggestions in IDE' },
  { names: ['tabnine'], company: 'Tabnine', icon: '⌨️', category: 'automation', free: true, desc: 'AI code completion — privacy focused' },

  // 🎵 AUDIO AI
  { names: ['suno', 'suno ai'], company: 'Suno AI', icon: '🎵', category: 'video', free: true, desc: 'AI music generator — create songs from text' },
  { names: ['udio'], company: 'Udio', icon: '🎶', category: 'video', free: true, desc: 'AI music creation — high quality songs free' },
  { names: ['elevenlabs', 'eleven labs'], company: 'ElevenLabs', icon: '🔊', category: 'video', free: true, desc: 'AI voice cloning & text-to-speech' },

  // 🤗 OTHER
  { names: ['hugging face', 'huggingface'], company: 'Hugging Face', icon: '🤗', category: 'largest', free: true, desc: 'Open-source AI hub — models, datasets, spaces' },
  { names: ['character ai', 'character.ai'], company: 'Character.AI', icon: '💬', category: 'largest', free: true, desc: 'AI characters — chat with fictional/real personas' },
  { names: ['cohere', 'command r'], company: 'Cohere', icon: '💎', category: 'largest', free: true, desc: 'Enterprise AI — RAG & text generation' },
];

// ─── Detect AI from article ──────────────────
function detectAI(article) {
  const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();
  for (const ai of AI_DATABASE) {
    for (const name of ai.names) {
      if (text.includes(name.toLowerCase())) {
        const displayName = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return { aiName: displayName, company: ai.company, icon: ai.icon, category: ai.category, free: ai.free, builtInDesc: ai.desc };
      }
    }
  }
  return null;
}

// ─── Extract purpose ─────────────────────────
function extractPurpose(article) {
  const desc = article.description || article.title || '';
  const clean = desc.replace(/<[^>]*>/g, '').trim();
  return clean.length > 180 ? clean.substring(0, 180) + '...' : clean;
}

// ─── Fetch News (multiple queries) ───────────
async function fetchAINews() {
  let allArticles = [];

  for (const query of SEARCH_QUERIES) {
    try {
      const res = await axios.get(CONFIG.newsApi.baseUrl, {
        params: {
          q: query,
          sortBy: CONFIG.newsApi.sortBy,
          language: CONFIG.newsApi.language,
          pageSize: CONFIG.newsApi.pageSize,
          apiKey: CONFIG.newsApi.key,
        },
      });
      if (res.data.status === 'ok') {
        allArticles = allArticles.concat(res.data.articles || []);
      }
    } catch (e) {
      log(`⚠️ Query failed: ${query.substring(0, 30)}... — ${e.message}`);
    }
  }

  // Deduplicate by URL
  const seen = new Set();
  allArticles = allArticles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });

  return allArticles;
}

// ─── Process & Deduplicate by AI name ────────
function processArticles(articles) {
  const seenAIs = new Map();

  for (const article of articles) {
    const detected = detectAI(article);
    if (!detected) continue;
    const key = detected.aiName.toLowerCase();
    if (seenAIs.has(key)) continue;

    seenAIs.set(key, {
      aiName: detected.aiName,
      company: detected.company,
      icon: detected.icon,
      category: detected.category,
      free: detected.free,
      builtInDesc: detected.builtInDesc,
      latestNews: extractPurpose(article),
      source: article.source?.name || 'Unknown',
      url: article.url,
    });
  }

  return Array.from(seenAIs.values());
}

// ─── Format Time (IST) ──────────────────────
function formatTimeIST(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function formatDateIST() {
  return new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

// ─── Category Labels ─────────────────────────
const CATEGORY_CONFIG = {
  largest: { label: '🏢 Largest AI Companies', color: '#89b4fa', bg: '#1e3a5f' },
  video: { label: '🎬 Video & Media AI (Free)', color: '#f38ba8', bg: '#5f1e3a' },
  automation: { label: '⚙️ Automation & Coding AI (Free)', color: '#a6e3a1', bg: '#1e5f3a' },
};

// ─── Build Card HTML ─────────────────────────
function buildCard(update) {
  const freeTag = update.free
    ? '<span style="background:#a6e3a1;color:#1e1e2e;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;margin-left:6px;">FREE ✅</span>'
    : '<span style="background:#f38ba8;color:#1e1e2e;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;margin-left:6px;">PAID 💰</span>';

  return `
  <tr>
    <td style="padding:14px 0;border-bottom:1px solid #313244;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50" style="vertical-align:top;padding-right:12px;">
            <div style="width:44px;height:44px;background:#313244;border-radius:12px;text-align:center;line-height:44px;font-size:22px;">${update.icon}</div>
          </td>
          <td style="vertical-align:top;">
            <div style="margin-bottom:4px;">
              <span style="color:#cdd6f4;font-size:16px;font-weight:700;">${update.aiName}</span>
              ${freeTag}
            </div>
            <div style="margin-bottom:6px;">
              <span style="background:linear-gradient(135deg,#89b4fa,#74c7ec);color:#1e1e2e;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;">🏢 ${update.company}</span>
            </div>
            <p style="color:#f5c2e7;font-size:12px;margin:0 0 4px 0;font-weight:600;">📋 Kya karta hai: ${update.builtInDesc}</p>
            <p style="color:#bac2de;font-size:12px;line-height:1.4;margin:0 0 6px 0;">📰 Latest: ${update.latestNews}</p>
            <a href="${update.url}" target="_blank" style="color:#89b4fa;font-size:11px;text-decoration:none;font-weight:600;">Read More → ${update.source}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ─── Build Full Email HTML ───────────────────
function buildEmailHTML(aiUpdates) {
  const today = formatDateIST();
  const now = formatTimeIST(new Date().toISOString());

  // Group by category
  const groups = { largest: [], video: [], automation: [] };
  aiUpdates.forEach(u => {
    if (groups[u.category]) groups[u.category].push(u);
  });

  let sectionsHTML = '';
  for (const [cat, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    const cfg = CATEGORY_CONFIG[cat];
    sectionsHTML += `
    <div style="background:#1e1e2e;border-radius:12px;padding:20px;border:1px solid #313244;margin-bottom:16px;">
      <h2 style="color:${cfg.color};font-size:16px;font-weight:700;margin:0 0 12px 0;padding-bottom:10px;border-bottom:2px solid ${cfg.color}20;">
        ${cfg.label} (${items.length})
      </h2>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${items.map(u => buildCard(u)).join('')}
      </table>
    </div>`;
  }

  // Quick summary table
  const summaryRows = aiUpdates.map(u => {
    const freeText = u.free ? '✅ Free' : '💰 Paid';
    return `<tr>
      <td style="padding:3px 8px;color:#cdd6f4;font-size:12px;border-bottom:1px solid #31324440;">${u.icon} ${u.aiName}</td>
      <td style="padding:3px 8px;color:#a6adc8;font-size:12px;border-bottom:1px solid #31324440;">${u.company}</td>
      <td style="padding:3px 8px;color:${u.free ? '#a6e3a1' : '#f38ba8'};font-size:12px;border-bottom:1px solid #31324440;">${freeText}</td>
    </tr>`;
  }).join('');

  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
  <body style="margin:0;padding:0;background:#11111b;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:30px 20px;">

      <!-- Header -->
      <div style="text-align:center;margin-bottom:24px;padding:30px;background:linear-gradient(135deg,#1e1e2e 0%,#181825 100%);border-radius:16px;border:1px solid #313244;">
        <div style="font-size:48px;margin-bottom:10px;">🤖</div>
        <h1 style="color:#cdd6f4;font-size:24px;font-weight:800;margin:0;">AI Daily Digest</h1>
        <p style="color:#a6adc8;font-size:13px;margin:6px 0 0 0;">📅 ${today} | 🕐 ${now} IST</p>
        <div style="margin-top:12px;display:inline-block;">
          <span style="background:#313244;border-radius:8px;padding:6px 14px;color:#a6e3a1;font-size:13px;font-weight:600;">
            🚀 ${aiUpdates.length} AI Updates | 🎬 Video AI | ⚙️ Automation AI | 🏢 Top AI
          </span>
        </div>
      </div>

      <!-- Sections -->
      ${sectionsHTML}

      <!-- Quick Summary Table -->
      <div style="background:#1e1e2e;border-radius:12px;padding:20px;border:1px solid #313244;margin-bottom:16px;">
        <h3 style="color:#cdd6f4;font-size:14px;font-weight:700;margin:0 0 10px 0;">📊 Quick Summary</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr style="background:#313244;">
            <td style="padding:6px 8px;color:#89b4fa;font-size:11px;font-weight:700;border-radius:6px 0 0 0;">AI Name</td>
            <td style="padding:6px 8px;color:#89b4fa;font-size:11px;font-weight:700;">Company</td>
            <td style="padding:6px 8px;color:#89b4fa;font-size:11px;font-weight:700;border-radius:0 6px 0 0;">Price</td>
          </tr>
          ${summaryRows}
        </table>
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:20px;border-top:1px solid #313244;">
        <p style="color:#585b70;font-size:11px;margin:0;">
          ⚡ AI Daily Digest Bot | 📅 Roz 6 PM IST<br/>
          🎬 Video AI | ⚙️ Automation AI | 🏢 Largest AI<br/>
          🔄 No duplicates — Each AI listed once<br/>
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
  const cats = { largest: 0, video: 0, automation: 0 };
  aiUpdates.forEach(u => cats[u.category]++);

  const mailOptions = {
    from: `"🤖 AI Daily Digest" <${CONFIG.email.sender}>`,
    to: CONFIG.email.receiver,
    subject: `🤖 AI Digest — ${today} | 🏢${cats.largest} Largest | 🎬${cats.video} Video | ⚙️${cats.automation} Automation`,
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
    log(`📥 Fetched ${articles.length} raw articles`);

    let aiUpdates = processArticles(articles);
    log(`🤖 Found ${aiUpdates.length} unique AI updates`);
    log(`   🏢 Largest: ${aiUpdates.filter(u => u.category === 'largest').length}`);
    log(`   🎬 Video: ${aiUpdates.filter(u => u.category === 'video').length}`);
    log(`   ⚙️ Automation: ${aiUpdates.filter(u => u.category === 'automation').length}`);

    // Fallback: broader search
    if (aiUpdates.length < 3) {
      log('🔄 Trying broader search...');
      try {
        const broader = await axios.get(CONFIG.newsApi.baseUrl, {
          params: { q: 'AI artificial intelligence', sortBy: 'publishedAt', language: 'en', pageSize: 100, apiKey: CONFIG.newsApi.key },
        });
        if (broader.data.status === 'ok') {
          const moreUpdates = processArticles(broader.data.articles || []);
          const existingKeys = new Set(aiUpdates.map(u => u.aiName.toLowerCase()));
          moreUpdates.forEach(u => {
            if (!existingKeys.has(u.aiName.toLowerCase())) {
              aiUpdates.push(u);
              existingKeys.add(u.aiName.toLowerCase());
            }
          });
          log(`🔄 After broader search: ${aiUpdates.length} total updates`);
        }
      } catch (e) {
        log(`⚠️ Broader search failed: ${e.message}`);
      }
    }

    // Fallback: raw articles
    if (aiUpdates.length === 0 && articles.length > 0) {
      log('📋 Using raw articles as fallback...');
      aiUpdates = articles.slice(0, 10).map(a => ({
        aiName: 'AI Update', company: a.source?.name || 'Unknown', icon: '🤖',
        category: 'largest', free: true, builtInDesc: 'AI news update',
        latestNews: (a.description || a.title || '').substring(0, 180),
        source: a.source?.name || 'Unknown', url: a.url,
      }));
    }

    // Ultimate fallback: status email
    if (aiUpdates.length === 0) {
      log('⚠️ No articles at all. Sending status email...');
      await transporter.sendMail({
        from: `"🤖 AI Daily Digest" <${CONFIG.email.sender}>`,
        to: CONFIG.email.receiver,
        subject: `🤖 AI Bot Active ✅ — ${formatDateIST()}`,
        html: `<div style="background:#1e1e2e;padding:40px;border-radius:16px;text-align:center;font-family:Segoe UI,sans-serif;">
          <div style="font-size:64px;">🤖✅</div>
          <h1 style="color:#a6e3a1;font-size:22px;">Bot Active — No Major AI Updates Today</h1>
          <p style="color:#cdd6f4;">Kal phir check karunga!</p>
        </div>`,
      });
      log('✅ Status email sent.');
      process.exit(0);
    }

    await sendEmail(aiUpdates);
    log('✅ Daily digest sent!');
    process.exit(0);
  } catch (err) {
    log(`❌ Error: ${err.message}`);
    process.exit(0); // Never exit 1
  }
}

main();
