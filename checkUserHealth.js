require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { logInfo, logError } = require("./lib/utils");
const { logger } = require("./lib/logger");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { writeWithTimestamp } = require("./lib/utils");

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const POOL_ADDRESS = "0x0CEa9F0F49F30d376390e480ba32f903B43B19C5";
const HOLDER_DIR = path.join(__dirname, "data", "holders");
const OUTPUT_FILE = path.join(__dirname, "data", "user_health.json");

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const RPC_URL = process.env.RPC_URL || "https://rpc.coredao.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const POOL_ABI = [
  "function getUserAccountData(address user) view returns (uint256,uint256,uint256,uint256,uint256,uint256)"
];
const MULTICALL_ABI = [
  "function aggregate((address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)"
];

const pool = new ethers.Contract(POOL_ADDRESS, POOL_ABI, provider);
const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL_ABI, provider);

async function sendTelegramAlert(user, healthFactor) {
  const hfNum = Number(healthFactor) / Number(10n ** 18n);
  const text = `⚠️ *Health Alert*: User [${user}](https://coredao.xyz/address/${user}) has health factor \`${hfNum.toFixed(4)}\``;

  logger.warn(`🚨 ALERT: ${user} has low health factor: ${hfNum.toFixed(4)}`);

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

function encodeUserCalls(users) {
  const iface = new ethers.Interface(POOL_ABI);
  return users.map(addr => ({
    target: POOL_ADDRESS,
    callData: iface.encodeFunctionData("getUserAccountData", [addr])
  }));
}

function decodeUserResults(users, returnData) {
  const iface = new ethers.Interface(POOL_ABI);
  return users.map((addr, i) => {
    try {
      const [collateral, debt, , , , healthFactor] = iface.decodeFunctionResult("getUserAccountData", returnData[i]);
      return { addr, collateral, debt, healthFactor };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function checkUserHealth(batchSize = 100, minUSD = 10) {
  logger.debug("Loading users with $10+ deposits...");
  const files = fs.readdirSync(HOLDER_DIR).filter(f => f.startsWith("a") && f.endsWith(".json"));

  const userUSD = {};
  for (const file of files) {
    const json = JSON.parse(fs.readFileSync(path.join(HOLDER_DIR, file)));
    for (const [addr, { usd }] of Object.entries(json.holders)) {
      const lower = addr.toLowerCase();
      userUSD[lower] = (userUSD[lower] || 0) + (usd || 0);
    }
  }

  const eligible = Object.entries(userUSD)
    .filter(([_, usd]) => usd >= minUSD)
    .map(([addr]) => addr);
  logger.info(`Eligible users: ${eligible.length}`);

  const result = {};
  const batches = Math.ceil(eligible.length / batchSize);
  const iface = new ethers.Interface(POOL_ABI);

  for (let i = 0; i < eligible.length; i += batchSize) {
    const group = eligible.slice(i, i + batchSize);
    logger.debug(`Processing batch ${i / batchSize + 1}/${batches}...`);

    try {
      const calls = encodeUserCalls(group);
      const [, returnData] = await multicall.aggregate(calls);
      const decoded = decodeUserResults(group, returnData);

      for (const { addr, collateral, debt, healthFactor } of decoded) {
        const hfNum = Number(healthFactor) / 1e18;
        const collateralUSD = Number(collateral) / 1e8;
        const debtUSD = Number(debt) / 1e8;

        result[addr] = {
          healthFactor: hfNum.toFixed(4),
          collateralUSD: collateralUSD.toFixed(2),
          debtUSD: debtUSD.toFixed(2),
          status: hfNum < 1.0 ? "at-risk" : "safe"
        };

        if (hfNum < 1.0 && debtUSD >= 5) {
          await sendTelegramAlert(addr, healthFactor);
        }
      }
    } catch (err) {
      logError("Multicall batch failed", err);
    }
  }

  const out = JSON.stringify(result, null, 2);
  const backupPath = writeWithTimestamp(OUTPUT_FILE, out);
  logInfo(`✅ Health check done: ${eligible.length} users`);
}

if (require.main === module) {
  const batchSize = parseInt(process.argv[2] || "100", 10);
  const minUSD = parseFloat(process.argv[3] || "10");
  checkUserHealth(batchSize, minUSD);
}

module.exports = {
  checkUserHealth
};
