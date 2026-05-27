# 🤖 AI News Automation Bot

Har ghante AI ki latest news automatically email karta hai — **24/7**, PC off ho ya on!

## 🚀 Features
- ⏰ Har 1 ghante automatically chalti hai (GitHub Actions)
- 📰 News API se latest AI news fetch karta hai
- 📧 Beautiful dark-themed HTML email bhejta hai
- 🌐 Cloud pe chalta hai — PC off hone se koi farak nahi
- 📝 Logs maintain karta hai

## 🔐 GitHub Secrets Required
Go to **Settings → Secrets → Actions** and add:

| Secret Name | Value |
|------------|-------|
| `NEWS_API_KEY` | Your News API key |
| `SENDER_EMAIL` | Gmail sender address |
| `SENDER_APP_PASSWORD` | Gmail App Password (no spaces) |
| `RECEIVER_EMAIL` | Receiver email address |

## 📋 Manual Run
Go to **Actions** tab → **AI News Hourly Email Bot** → **Run workflow**

## Built with ❤️ by Shivam
