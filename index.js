// ============================================
//  🤖 AI News Automation — Hourly Email Bot
//  Fetches latest AI news & sends via Gmail
// ============================================

require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
const nodemailer = require('nodemailer');

// ─── Configuration ───────────────────────────
const CONFIG = {
  newsApi: {
    key: process.env.NEWS_API_KEY,
    baseUrl: 'https://newsapi.org/v2/everything',
    query: 'artificial intelligence OR AI OR machine learning OR ChatGPT OR Gemini AI OR OpenAI',
    pageSize: 10,
    sortBy: 'publishedAt',
    language: 'en',
  },
  email: {
    sender: process.env.SENDER_EMAIL,
    password: process.env.SENDER_APP_PASSWORD,
    receiver: process.env.RECEIVER_EMAIL,
  },
  cronSchedule: process.env.CRON_SCHEDULE || '0 * * * *',
};

// ─── Gmail SMTP Transporter ──────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: CONFIG.email.sender,
    pass: CONFIG.email.password,
  },
});

// ─── Fetch Latest AI News ────────────────────
async function fetchAINews() {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const response = await axios.get(CONFIG.newsApi.baseUrl, {
      params: {
        q: CONFIG.newsApi.query,
        from: oneHourAgo.toISOString(),
        to: now.toISOString(),
        sortBy: CONFIG.newsApi.sortBy,
        language: CONFIG.newsApi.language,
        pageSize: CONFIG.newsApi.pageSize,
        apiKey: CONFIG.newsApi.key,
      },
    });

    if (response.data.status === 'ok' && response.data.articles.length > 0) {
      return response.data.articles;
    }

    // Fallback: if no articles in last hour, get latest from last 24 hours
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fallbackResponse = await axios.get(CONFIG.newsApi.baseUrl, {
      params: {
        q: CONFIG.newsApi.query,
        from: oneDayAgo.toISOString(),
        to: now.toISOString(),
        sortBy: CONFIG.newsApi.sortBy,
        language: CONFIG.newsApi.language,
        pageSize: CONFIG.newsApi.pageSize,
        apiKey: CONFIG.newsApi.key,
      },
    });

    return fallbackResponse.data.articles || [];
  } catch (error) {
    console.error('❌ News API Error:', error.response?.data?.message || error.message);
    return [];
  }
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

// ─── Build Beautiful HTML Email ──────────────
function buildEmailHTML(articles) {
  const now = formatTimeIST(new Date().toISOString());

  const articleCards = articles
    .map((article, index) => {
      const imgSection = article.urlToImage
        ? `<img src="${article.urlToImage}" alt="News Image" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px 12px 0 0;" />`
        : '';

      return `
      <div style="background:#1e1e2e;border-radius:12px;overflow:hidden;margin-bottom:20px;border:1px solid #313244;">
        ${imgSection}
        <div style="padding:20px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="background:linear-gradient(135deg,#89b4fa,#74c7ec);color:#1e1e2e;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">#${index + 1}</span>
            <span style="color:#a6adc8;font-size:12px;">${article.source?.name || 'Unknown Source'}</span>
            <span style="color:#585b70;font-size:12px;">•</span>
            <span style="color:#a6adc8;font-size:12px;">${formatTimeIST(article.publishedAt)}</span>
          </div>
          <h2 style="color:#cdd6f4;font-size:17px;font-weight:700;margin:0 0 10px 0;line-height:1.4;">
            <a href="${article.url}" style="color:#89b4fa;text-decoration:none;" target="_blank">${article.title || 'No Title'}</a>
          </h2>
          <p style="color:#bac2de;font-size:14px;line-height:1.6;margin:0 0 15px 0;">
            ${article.description || 'No description available.'}
          </p>
          <a href="${article.url}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#89b4fa,#74c7ec);color:#1e1e2e;padding:8px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">
            Read Full Article →
          </a>
        </div>
      </div>`;
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
        <h1 style="color:#cdd6f4;font-size:26px;font-weight:800;margin:0;">AI News Update</h1>
        <p style="color:#a6adc8;font-size:14px;margin:8px 0 0 0;">🕐 ${now} IST</p>
        <div style="margin-top:15px;background:#313244;border-radius:8px;padding:8px 16px;display:inline-block;">
          <span style="color:#a6e3a1;font-size:13px;font-weight:600;">📰 ${articles.length} Latest Articles Found</span>
        </div>
      </div>

      <!-- Articles -->
      ${articleCards}

      <!-- Footer -->
      <div style="text-align:center;padding:25px;margin-top:10px;border-top:1px solid #313244;">
        <p style="color:#585b70;font-size:12px;margin:0;">
          ⚡ Powered by AI News Automation Bot<br/>
          📡 Source: NewsAPI.org | ⏰ Delivered every hour<br/>
          Built with ❤️ by Shivam
        </p>
      </div>

    </div>
  </body>
  </html>`;
}

// ─── Send Email ──────────────────────────────
async function sendEmail(articles) {
  const mailOptions = {
    from: `"🤖 AI News Bot" <${CONFIG.email.sender}>`,
    to: CONFIG.email.receiver,
    subject: `🤖 AI News Update — ${formatTimeIST(new Date().toISOString())}`,
    html: buildEmailHTML(articles),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    return false;
  }
}

// ─── Main Job ────────────────────────────────
async function runNewsJob() {
  const timestamp = formatTimeIST(new Date().toISOString());
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🔄 Running AI News Job — ${timestamp}`);
  console.log(`${'═'.repeat(50)}`);

  const articles = await fetchAINews();

  if (articles.length === 0) {
    console.log('⚠️  No new AI articles found. Skipping email.');
    return;
  }

  console.log(`📰 Found ${articles.length} articles. Sending email...`);
  await sendEmail(articles);
}

// ─── Schedule Cron Job ───────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log('🤖 AI News Automation Bot Started!');
console.log(`${'═'.repeat(50)}`);
console.log(`📧 Sender  : ${CONFIG.email.sender}`);
console.log(`📬 Receiver: ${CONFIG.email.receiver}`);
console.log(`⏰ Schedule: Every hour (${CONFIG.cronSchedule})`);
console.log(`🔑 API Key : ${CONFIG.newsApi.key.slice(0, 6)}...${CONFIG.newsApi.key.slice(-4)}`);
console.log(`${'═'.repeat(50)}\n`);

// Run immediately on start
runNewsJob();

// Then schedule for every hour
cron.schedule(CONFIG.cronSchedule, () => {
  runNewsJob();
});

console.log('✅ Cron job scheduled! Bot is running...');
console.log('💡 Press Ctrl+C to stop.\n');
