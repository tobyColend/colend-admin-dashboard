// backend/lib/fetchHolders.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const assets = require("../config/assets.json");
const { logInfo, logError } = require("./utils");
const { logger } = require("./logger");
const { getPriceMap } = require("./fetchPrice");
const { writeWithTimestamp } = require("./utils");


const ERC20_ABI = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "function balanceOf(address account) view returns (uint256)"
];

const RPC_URL = process.env.RPC_URL || "https://rpc.coredao.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const HOLDER_DATA_DIR = path.join(__dirname, "..", "data", "holders");
if (!fs.existsSync(HOLDER_DATA_DIR)) fs.mkdirSync(HOLDER_DATA_DIR, { recursive: true });

async function processToken(address, label, symbol, originBlock = 0, latestBlock, priceMap, withUSD) {
    const filePath = path.join(HOLDER_DATA_DIR, `${label}${symbol}.json`);
    let cache = {
        lastCheckedBlock: originBlock,
        holders: {}
    };

    const contract = new ethers.Contract(address, ERC20_ABI, provider);
    if (fs.existsSync(filePath)) {
        cache = JSON.parse(fs.readFileSync(filePath));
        logger.debug(`${label}${symbol}: loaded ${Object.keys(cache.holders).length} from cache`);
    }

    async function fetchLogsInChunks(fromBlock, toBlock, step = 50000) {
        let logs = [];
        for (let start = fromBlock; start <= toBlock; start += step) {
            const end = Math.min(start + step - 1, toBlock);
            try {
                const chunk = await contract.queryFilter("Transfer", start, end);
                logger.debug(`Fetched ${chunk.length} logs from blocks ${start}–${end}`);
                logs = logs.concat(chunk);
            } catch (err) {
                logError(`Failed to fetch logs for block ${start}–${end}`, err);
            }
        }
        return logs;
    }

    const logs = await fetchLogsInChunks(cache.lastCheckedBlock + 1, latestBlock);

    for (const log of logs) {
        const from = log.args.from.toLowerCase();
        const to = log.args.to.toLowerCase();
        if (from !== ethers.ZeroAddress) cache.holders[from] = { raw: "0", usd: 0 };
        if (to !== ethers.ZeroAddress) cache.holders[to] = { raw: "0", usd: 0 };
    }

    const addresses = Object.keys(cache.holders);
    logger.debug(`${label}${symbol}: checking balances for ${addresses.length} addresses`);
    const balances = await Promise.all(
        addresses.map(addr => contract.balanceOf(addr).catch(() => 0n))
    );

    let count = 0;
    for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i];
        const bal = balances[i];
        const raw = bal.toString();
        const usd = withUSD && priceMap[symbol] ? (Number(bal) / 10 ** assets.find(a => a.symbol === symbol).decimals) * priceMap[symbol] : null;

        if (BigInt(bal) > 0n && (!withUSD || usd >= 0.01)) {
            cache.holders[addr] = withUSD ? { raw, usd } : raw;
            count++;
        } else {
            delete cache.holders[addr];
        }
    }

    cache.lastCheckedBlock = latestBlock;
    const out = JSON.stringify(cache, null, 2);
    const backup = writeWithTimestamp(filePath, out);
    logger.debug(`Snapshot saved to ${backup}`);
    logInfo(`${label}${symbol}: holder count = ${count}`);

    return {
        holderCount: count,
        holders: cache.holders
    };
}

async function fetchHolderCounts(withUSD = false) {
    const latestBlock = await provider.getBlockNumber();
    const results = {};
    const priceMap = withUSD ? await getPriceMap() : {};

    for (const asset of assets) {
        const symbol = asset.symbol;
        results[symbol] = {};

        try {
            if (asset.aToken) {
                results[symbol].aToken = await processToken(
                    asset.aToken,
                    "a",
                    symbol,
                    asset.originBlock,
                    latestBlock,
                    priceMap,
                    withUSD
                );
            }
            if (asset.virtualRewardToken) {
                results[symbol].virtualToken = await processToken(
                    asset.virtualRewardToken,
                    "virtual",
                    symbol,
                    asset.originBlock,
                    latestBlock,
                    priceMap,
                    withUSD
                );
            }
        } catch (err) {
            logError(`Failed to process holders for ${symbol}`, err);
        }
    }

    return results;
}

module.exports = {
    fetchHolderCounts
};
