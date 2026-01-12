# 🎯 Bags Fee Tracker

Automatically track and monitor fee claims from Bags tokens on Solana. A sleek, real-time dashboard for tracking fee receivers and their claim history.

![Bags Fee Tracker](https://img.shields.io/badge/status-live-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## 🌐 Live Demo

**[https://bags-tracker.vercel.app](https://bags-tracker.vercel.app)**

---

## ✨ Features

- 🔍 **Track Fee Receivers** - Search any Bags token by mint address
- 💰 **Real-time Monitoring** - Monitor WSOL/SOL fee claims as they happen
- 📊 **Claim Analytics** - View complete claim history with timestamps and amounts
- 🎨 **Modern UI** - Clean, compact interface with dark mode
- 🚀 **Fast & Reliable** - Built on Solana with Helius RPC for speed
- 🔗 **Social Integration** - Direct links to receiver Twitter profiles with avatars

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML, CSS, JavaScript |
| **Backend** | Node.js, Express |
| **Blockchain** | Solana (Helius RPC) |
| **APIs** | Bags API, Helius, Jupiter |
| **Deployment** | Vercel (Serverless) |

---

## 📦 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- Helius API key ([Get one here](https://helius.dev))
- Bags API key (Get from [Bags.fm](https://bags.fm))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/degenvcap/bags-fee-tracker.git
   cd bags-fee-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and add your API keys:
   ```env
   HELIUS_API_KEY=your_helius_api_key_here
   BAGS_API_KEY=your_bags_api_key_here
   ```

4. **Run the server**
   ```bash
   node server.js
   ```

5. **Open the app**

   Open `index.html` in your browser or visit `http://localhost:3001`

---

## 🎮 Usage

1. **Enter a token mint address** in the search box
2. **Click "Find Receivers"** to see all fee receivers
3. **Track receivers** to monitor their claims
4. **View claim history** by expanding the claims section
5. **Check for new claims** anytime with the "Check" button

---

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `HELIUS_API_KEY` | Your Helius RPC API key | ✅ Yes |
| `BAGS_API_KEY` | Your Bags.fm API key | ✅ Yes |

Get your API keys:
- **Helius**: [https://helius.dev](https://helius.dev)
- **Bags**: Contact [Bags.fm](https://bags.fm)

---

## 🚀 Deployment

This project is configured for **Vercel** deployment:

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Set environment variables in Vercel dashboard
4. Deploy: `vercel --prod`

The `vercel.json` configuration is already included.

---

## 🎨 Features Breakdown

### Compact Dashboard
- Single-line receiver rows showing all key stats
- Inline display of Fee Split, Claimed, Unclaimed, and Claim Count
- Collapsible transaction history

### Token Metadata
- Automatic fetching of token name, symbol, and logo
- Uses Helius metadata API with Jupiter fallback
- Profile images from Bags API

### Claim Tracking
- Monitors the last 50 transactions per wallet
- Detects SOL balance changes from fee claims
- Timestamps for every claim transaction
- Direct links to Solscan for verification

---

## 📂 Project Structure

```
bags-fee-tracker/
├── index.html          # Frontend UI
├── server.js           # Backend API server
├── package.json        # Dependencies
├── vercel.json         # Vercel config
├── .env.example        # Environment template
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

---

## 🔒 Security

- ✅ API keys stored in environment variables
- ✅ `.env` excluded from version control
- ✅ No hardcoded credentials
- ✅ Rate limiting implemented
- ✅ Safe for public repositories

---

## 📄 License

MIT License - feel free to use this project however you'd like!

---

## 🙏 Credits

Built with:
- [Bags.fm](https://bags.fm) - Fee sharing protocol
- [Helius](https://helius.dev) - Solana RPC & APIs
- [Jupiter](https://jup.ag) - Token metadata
- [Vercel](https://vercel.com) - Deployment

---

## 📞 Support

Found a bug or have a feature request? Open an issue on [GitHub](https://github.com/degenvcap/bags-fee-tracker/issues).

---

**Made with 💚 by [@degenvcap](https://github.com/degenvcap)**
