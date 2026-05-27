// ============================================
//  🤖 AI News — One-Shot Script
//  Runs once, sends email, then exits.
//  Designed for Windows Task Scheduler.
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
  fs.appendFileSync(LOG_FILE, line + '\n');
}

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
        ? `<img src="${article.urlToImage}" alt="News" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px 12px 0 0;" />`
        : '';

      return `
      <div style="background:#1e1e2e;border-radius:12px;overflow:hidden;margin-bottom:20px;border:1px solid #313244;">
        ${imgSection}
        <div style="padding:20px;">
          <div style="margin-bottom:10px;">
            <span style="background:linear-gradient(135deg,#89b4fa,#74c7ec);color:#1e1e2e;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">#${index + 1}</span>
            <span style="color:#a6adc8;font-size:12px;margin-left:8px;">${article.source?.name || 'Unknown'}</span>
            <span style="color:#585b70;font-size:12px;margin:0 4px;">•</span>
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
          <span style="color:#a6e3a1;font-size:13px;font-weight:600;">📰 ${articles.length} Latest Articles</span>
        </div>
      </div>
      <!-- Articles -->
      ${articleCards}
      <!-- Footer -->
      <div style="text-align:center;padding:25px;margin-top:10px;border-top:1px solid #313244;">
        <p style="color:#585b70;font-size:12px;margin:0;">
          ⚡ Powered by AI News Automation Bot<br/>
          📡 Source: NewsAPI.org | ⏰ Auto-delivered every hour<br/>
          🖥️ Running as Windows Scheduled Task<br/>
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

  const info = await transporter.sendMail(mailOptions);
  log(`✅ Email sent! ID: ${info.messageId}`);
}

// ─── Main ────────────────────────────────────
async function main() {
  log('═══ AI News Bot — One-Shot Run ═══');

  try {
    const articles = await fetchAINews();

    if (articles.length === 0) {
      log('⚠️ No new AI articles found. Skipping email.');
      process.exit(0);
    }

    log(`📰 Found ${articles.length} articles. Sending email...`);
    await sendEmail(articles);
    log('✅ Job complete. Exiting.');
    process.exit(0);
  } catch (err) {
    log(`❌ Fatal Error: ${err.message}`);
    process.exit(1);
  }
}

main();
