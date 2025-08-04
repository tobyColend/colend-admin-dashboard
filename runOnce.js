// backend/runOnce.js
require("dotenv").config();
const { fetchTotalSupplyInUSD } = require("./lib/fetchOnChainData");
const { fetchEmissionStats } = require("./lib/fetchEmissionData");
const { fetchVirtualTVLs } = require("./lib/fetchVirtualTVL");
const { fetchHolderCounts } = require("./lib/fetchHolders");
const { pushAssetStats } = require("./lib/gitPush");
const fs = require("fs");
const path = require("path");
const { logInfo, logError } = require("./lib/utils");
const { checkUserHealth } = require("./checkUserHealth");
const { writeWithTimestamp } = require("./lib/utils");

async function run() {
    try {
        logInfo("🔁 Starting TVL, emission, holder and health aggregation...");

        const tvlData = await fetchTotalSupplyInUSD();
        const emissionData = await fetchEmissionStats();
        const virtualTVLMap = await fetchVirtualTVLs();
        const holderData = await fetchHolderCounts(true); // pass true to indicate usd fetch mode

        const combined = tvlData.map(asset => {
            const emission = emissionData[asset.symbol] || {};
            const virtual = virtualTVLMap[asset.symbol] || {};
            const holders = holderData[asset.symbol]?.aToken || {}; // only aToken used for health
            const debt = holderData[asset.symbol]?.debtToken || {};

            let tvlSubsPct = null;
            if (asset.tvlUSD && virtual.tvlSubsUSD) {
                tvlSubsPct = (virtual.tvlSubsUSD / asset.tvlUSD) * 100;
            }
            let tvlDebtPct = null;
            if (asset.tvlUSD && debt.tvlDebtUSD) {
                tvlDebtPct = (debt.tvlDebtUSD / asset.tvlUSD) * 100;
            }

            return {
                ...asset,
                ...emission,
                ...virtual,
                ...holders,
                ...debt,
                tvlSubsPct,
                tvlDebtPct
            };
        });

        const outputPath = path.join(__dirname, "data", "asset_stats.json");
        const out = JSON.stringify(combined, null, 2);
        const backupPath = writeWithTimestamp(outputPath, out);
        logInfo(`📁 Combined data written to ${outputPath}`);
        logInfo(`📁 Snapshot saved to ${backupPath}`);

        await checkUserHealth(200, 0);
        pushAssetStats();
    } catch (err) {
        logError("❌ Failed to run aggregation", err);
    }
}

if (require.main === module) {
    run();
}

module.exports = {
    run
};
