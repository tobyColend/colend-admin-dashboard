# Colend Admin Dashboard

Off-chain monitoring toolkit for the **Colend** (Aave-fork) money-market on Core Chain.  
It snapshots TVL, emissions and holder stats, tracks every borrower’s _health factor_, and pushes JSON artifacts & Telegram alerts so the team can react quickly.

---

## ✨ Key features

| Task | Script | What it does |
|------|--------|--------------|
| TVL + emissions snapshot | `node runOnce.js` | Builds `data/asset_stats.json`, commits & pushes to Git |
| Health-factor scan | `node checkUserHealth.js` | Creates `data/user_health.json`, Telegram-alerts any HF < 1 |
| Remote trigger bot | `node telegramBot.js` | Accepts `/tvlUpdate` and `/checkHealth` commands |

---

## 📂 Repo layout

├── config/assets.json        # Registry of all supported assets (addresses, decimals…) :contentReference[oaicite:2]{index=2}
├── data/                     # JSON outputs dropped here
│   ├── asset_stats.json
│   ├── user_health.json
│   └── holders/*.json
├── lib/                      # Re-usable helpers (price feed, Git push, emission query…)
├── runOnce.js
├── checkUserHealth.js
└── telegramBot.js

## ⚙️ Installation
Node 18 LTS (or newer) and pnpm/npm.
pnpm install
Copy .env.example → .env and fill the blanks:


RPC_URL="https://rpc.coredao.org"   # Core Chain RPC
TELEGRAM_BOT_TOKEN="XXXXXXXX"
TELEGRAM_CHAT_ID="999999999"
LOG_LEVEL="debug"

# optional – used by lib/gitPush.js
GIT_USER_NAME="Colend-Bot"
GIT_USER_EMAIL="ci@colend.xyz"
GITHUB_TOKEN="ghp_..."
GITHUB_REPO="github.com/tobyColend/colend-admin-dashboard"
🚀 Usage
One-shot snapshot
bash
Copy
Edit
# Aggregate TVL, emissions, virtual TVL, holder counts + health checks
node runOnce.js
Health-factor only
bash
Copy
Edit
# node checkUserHealth.js [batchSize] [minUSD]
node checkUserHealth.js 200 10            # default: 100 / $10 :contentReference[oaicite:3]{index=3}
Always-on Telegram bot
bash
Copy
Edit
node telegramBot.js
Commands available in your chat:

Command	Action
/tvlUpdate	Runs runOnce and replies when finished
/checkHealth	Runs checkUserHealth with $10 threshold

Tip: keep the bot alive with pm2 or a systemd service.

📤 Output formats
data/asset_stats.json
An array where each element contains:

Field	Description
symbol	Asset symbol (USDT, CORE, …)
rawSupply	Total supply of the aToken (as string)
price	CoinGecko USD price at snapshot
tvlUSD	TVL of the asset
tvlSubsUSD / tvlSubsPct	Virtual TVL from subscribed rewards, absolute & %
tvlDebtUSD / tvlDebtPct	Debt TVL, absolute & %
rewardToken, emissionPerSecond, emissionEnd	Emission data fetchEmissionData
aHolderCount, debtHolderCount	Distinct holder counts fetchHolders
updatedAt	ISO timestamp

data/user_health.json
jsonc
Copy
Edit
{
  "0xabcd...": {
    "healthFactor": "0.9732",
    "collateralUSD": "123.45",
    "debtUSD": "120.00",
    "status": "at-risk"
  },
  ...
}
Any address with status: "at-risk" also triggers a real-time Telegram alert checkUserHealth.

data/holders/<token>.json
Per-token cache containing:

jsonc
Copy
Edit
{
  "lastCheckedBlock": 13890000,
  "holders": {
    "0xabcd...": { "raw": "123456789000000000", "usd": 12.34 },
    ...
  }
}
Used by downstream scripts to speed up incremental scans fetchHolders.

🛠️ Extending
Add the new asset to config/assets.json (aToken, debtToken, decimals, CoinGecko ID, originBlock).

If the asset has a virtual reward token, also set virtualRewardToken.

Restart runOnce / bot – that’s it.

🏃‍♂️ Automation example (cron)
cron
Copy
Edit
*/15 * * * *  cd /opt/colend-admin-dashboard && pnpm runOnce >> logs/cron.log 2>&1
@reboot           pm2 start telegramBot.js --name colend-bot
❓ FAQ
RPC timeouts? Increase --timeout, switch to a faster provider or lower batchSize.

CoinGecko 429? The API is used once per snapshot; throttle your cron or add your own price oracle.

Git push fails? Ensure GITHUB_TOKEN has repo scope and user.email/name are set.