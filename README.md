# 🤖 AI News Automation Bot

Har **1.5 ghante** AI ki latest news automatically **Telegram** pe + **Email** pe bhejta hai — 24/7!
Ab interactive Q&A bhi hai — **Gemini AI** se koi bhi sawaal pucho! 🧠

## 🚀 Features

### 📱 Telegram Bot (NEW!)
- ⏰ Har 1.5 ghante automatically AI news Telegram pe
- 💬 **Interactive Q&A** — kuch bhi pucho, AI jawab dega
- 🇮🇳 **Hindi Summary** — news ka Hindi mein summary
- 📡 Multiple sources: TechCrunch, VentureBeat, The Verge, NewsAPI
- 🧠 Powered by **Google Gemini AI**
- 🔄 Smart deduplication — same news dobara nahi aayegi

### 📧 Email Bot (Original)
- ⏰ Har 1 ghante automatically email
- 📰 News API se latest AI news fetch
- 📧 Beautiful dark-themed HTML email

## 🛠️ Setup

### Step 1: Telegram Bot Token Lo
1. Telegram pe **@BotFather** kholo
2. `/newbot` bhejo
3. Bot ka naam do (e.g., "Shivam AI News")
4. Username do (e.g., `shivam_ai_news_bot`)
5. **Token copy karo** 📋

### Step 2: .env File Update Karo
```env
TELEGRAM_BOT_TOKEN=paste_your_token_here
GEMINI_API_KEY=your_gemini_key
NEWS_INTERVAL_MINUTES=90
```

### Step 3: Dependencies Install Karo
```bash
npm install
```

### Step 4: Bot Start Karo
```bash
npm run telegram
```
Ya simply `start-telegram.bat` double-click karo!

### Step 5: Bot Se /start Karo
Telegram pe apne bot ko kholo aur `/start` bhejo! 🎉

## 📋 Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Bot start karo + register ho jao |
| `/news` | Abhi turant latest AI news |
| `/hindi` | News ka Hindi summary |
| `/ask <question>` | AI se koi bhi sawaal pucho |
| `/status` | Bot ki current status |
| `/help` | Sab commands ki list |
| **Any text** | AI se baat karo — reply aayega! |

## 📡 News Sources
- 🔵 **TechCrunch** AI Section
- 🟣 **VentureBeat** AI Section
- 🟢 **The Verge** AI Section
- 🔴 **NewsAPI** (optional, for extra coverage)

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ | @BotFather se milega |
| `GEMINI_API_KEY` | ✅ | Google AI Studio se |
| `NEWS_API_KEY` | ❌ | Extra news source (optional) |
| `NEWS_INTERVAL_MINUTES` | ❌ | Default: 90 (1.5 hours) |
| `SENDER_EMAIL` | ❌ | Email bot ke liye |
| `SENDER_APP_PASSWORD` | ❌ | Gmail App Password |
| `RECEIVER_EMAIL` | ❌ | Email receiver |

## 📁 Project Structure
```
ai-news-automation/
├── telegram-bot.js      # 📱 Telegram Bot (main)
├── index.js             # 📧 Email Bot (original)
├── run-once.js          # 📧 Email one-shot script
├── .env                 # 🔐 Configuration
├── package.json         # 📦 Dependencies
├── data/                # 💾 Persistent data
│   ├── sent-articles.json
│   └── chat-ids.json
├── start-telegram.bat   # 🖥️ Windows launcher
├── start-bot.bat        # 🖥️ Email bot launcher
└── README.md            # 📖 This file
```

## Built with ❤️ by Shivam
