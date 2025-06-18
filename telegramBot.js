// backend/telegramTrigger.js
require("dotenv").config();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { run } = require("./runOnce");
const { checkUserHealth } = require("./checkUserHealth");
const { logInfo, logError } = require("./lib/utils");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SERVICE_ID = "TVL_STATS";
let lastUpdateId = 0;

async function sendTelegramMessage(text) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: "Markdown"
        })
    });
}

async function checkTelegramCommands() {
    try {
        logInfo("📡 Polling Telegram for updates...");
        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=5`);
        const data = await res.json();

        if (data.ok && data.result.length > 0) {
            for (const update of data.result) {
                lastUpdateId = update.update_id;

                const message = update.message;
                if (!message || !message.text) continue;

                const text = message.text.trim();
                const chatId = message.chat.id;
                logInfo(`📩 Command received: ${text} from ${chatId}`);

                if (chatId.toString() !== TELEGRAM_CHAT_ID) {
                    logError(`❌ Unauthorized access attempt from ${chatId}`);
                    await sendTelegramMessage("❌ Unauthorized");
                    continue;
                }

                if (text === '/tvlUpdate') {
                    await sendTelegramMessage("⏳ TVL update started...");
                    try {
                        await run();
                        await sendTelegramMessage("✅ TVL update complete.");
                    } catch (err) {
                        await sendTelegramMessage("❌ TVL update failed.");
                        logError("Run failed during Telegram command", err);
                    }
                }
                if (text === '/checkHealth') {
                    await sendTelegramMessage("⏳ HealthFactor review started for wallet above $10USD...");
                    try {
                        await checkUserHealth(200, 10); // 10 USD threshold
                        await sendTelegramMessage("✅ HealthFactor review complete.");
                    } catch (err) {
                        await sendTelegramMessage("❌ HealthFactor review failed.");
                        logError("HealthFactor failed during Telegram command", err);
                    }
                }
            }
        }
    } catch (err) {
        logError("Telegram polling error", err);
    }

    setTimeout(checkTelegramCommands, 3000);
}

checkTelegramCommands();
logInfo("✅ Telegram bot trigger loaded and ready.");