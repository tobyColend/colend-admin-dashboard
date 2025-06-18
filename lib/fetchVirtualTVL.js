// backend/lib/fetchVirtualTVL.js
const { ethers } = require("ethers");
const assets = require("../config/assets.json");
const { logInfo, logError } = require("./utils");
const { getPriceMap } = require("./fetchPrice");

const ERC20_ABI = [
  "function totalSupply() view returns (uint256)"
];

const RPC_URL = process.env.RPC_URL || "https://rpc.coredao.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

async function fetchVirtualTVLs() {
  const result = {};
  const priceMap = await getPriceMap();

  for (const asset of assets) {
    if (!asset.virtualRewardToken) continue;

    try {
      const token = new ethers.Contract(asset.virtualRewardToken, ERC20_ABI, provider);
      const rawSupply = await token.totalSupply();
      const price = priceMap[asset.symbol] || 0;
      const tvlSubs = (Number(rawSupply) / 10 ** asset.decimals) * price;

      result[asset.symbol] = {
        tvlSubsUSD: tvlSubs,
        tvlSubsRaw: rawSupply.toString(),
        tvlSubsPct: null // leave for frontend or postprocessing
      };

      logInfo(`${asset.symbol} subscriber TVL: $${tvlSubs.toFixed(2)}`);
    } catch (err) {
      logError(`Failed to fetch virtual TVL for ${asset.symbol}`, err);
    }
  }

  return result;
}

module.exports = {
  fetchVirtualTVLs
};
