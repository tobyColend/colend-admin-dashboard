// backend/lib/fetchPrice.js
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { logInfo, logError } = require("./utils");
const assets = require("../config/assets.json");

async function getPriceMap() {
  const ids = assets.map(a => a.coingeckoId).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const priceMap = {};

    for (const asset of assets) {
      const id = asset.coingeckoId;
      const price = json[id]?.usd || 0;
      priceMap[asset.symbol] = price;
      logInfo(`CoinGecko price for ${asset.symbol} (${id}): $${price}`);
    }

    return priceMap;
  } catch (err) {
    logError("Failed to fetch CoinGecko prices", err);
    return {};
  }
}

module.exports = {
  getPriceMap
};
