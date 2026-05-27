// ============================================
//  🧪 Test Script — Send one test email
// ============================================

require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');

const CONFIG = {
  newsApi: {
    key: process.env.NEWS_API_KEY,
    baseUrl: 'https://newsapi.org/v2/everything',
  },
  email: {
    sender: process.env.SENDER_EMAIL,
    password: process.env.SENDER_APP_PASSWORD,
    receiver: process.env.RECEIVER_EMAIL,
  },
};

async function testConnection() {
  console.log('\n🧪 Running Tests...\n');

  // Test 1: News API
  console.log('1️⃣  Testing News API...');
  try {
    const res = await axios.get(CONFIG.newsApi.baseUrl, {
      params: {
        q: 'artificial intelligence',
        pageSize: 3,
        sortBy: 'publishedAt',
        language: 'en',
        apiKey: CONFIG.newsApi.key,
      },
    });

    if (res.data.status === 'ok') {
      console.log(`   ✅ News API working! Found ${res.data.totalResults} total articles.`);
      console.log(`   📰 Sample: "${res.data.articles[0]?.title}"\n`);
    } else {
      console.log(`   ❌ News API returned status: ${res.data.status}\n`);
    }
  } catch (err) {
    console.log(`   ❌ News API Error: ${err.response?.data?.message || err.message}\n`);
  }

  // Test 2: Gmail SMTP
  console.log('2️⃣  Testing Gmail SMTP...');
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: CONFIG.email.sender,
        pass: CONFIG.email.password,
      },
    });

    await transporter.verify();
    console.log('   ✅ Gmail SMTP connection successful!\n');

    // Test 3: Send test email
    console.log('3️⃣  Sending test email...');
    const info = await transporter.sendMail({
      from: `"🤖 AI News Bot" <${CONFIG.email.sender}>`,
      to: CONFIG.email.receiver,
      subject: '🧪 Test Email — AI News Bot is Ready!',
      html: `
        <div style="background:#1e1e2e;padding:40px;border-radius:16px;text-align:center;font-family:Segoe UI,sans-serif;">
          <div style="font-size:64px;">🤖✅</div>
          <h1 style="color:#a6e3a1;font-size:24px;">AI News Bot is Ready!</h1>
          <p style="color:#cdd6f4;font-size:16px;">
            Aapka AI News Automation successfully configured ho gaya hai.<br/>
            Ab aapko har ghante AI ki latest news milegi! 🚀
          </p>
          <div style="background:#313244;padding:15px;border-radius:10px;margin:20px auto;max-width:300px;">
            <p style="color:#89b4fa;margin:0;font-size:14px;">
              📧 Sender: ${CONFIG.email.sender}<br/>
              📬 Receiver: ${CONFIG.email.receiver}<br/>
              ⏰ Schedule: Every Hour
            </p>
          </div>
          <p style="color:#585b70;font-size:12px;margin-top:20px;">
            Ye ek test email hai. Real news emails ab har ghante aayengi!
          </p>
        </div>
      `,
    });

    console.log(`   ✅ Test email sent! Message ID: ${info.messageId}`);
    console.log(`   📬 Check inbox of: ${CONFIG.email.receiver}\n`);
  } catch (err) {
    console.log(`   ❌ Gmail Error: ${err.message}\n`);
    if (err.message.includes('Invalid login')) {
      console.log('   💡 Tip: Make sure you are using a Gmail App Password, not your regular password.');
      console.log('   💡 Go to: https://myaccount.google.com/apppasswords\n');
    }
  }

  console.log('🧪 Test Complete!\n');
}

testConnection();
