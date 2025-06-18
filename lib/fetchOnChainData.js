// backend/lib/fetchOnChainData.js
const { ethers } = require("ethers");
const { formatUnits, logInfo, logError } = require("./utils");
const { getPriceMap } = require("./fetchPrice");
const assets = require("../config/assets.json");

const RPC_URL = process.env.RPC_URL || "https://rpc.coredao.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const ERC20_ABI = [
  "function totalSupply() view returns (uint256)"
];

async function fetchTotalSupplyInUSD() {
  const result = [];
  const priceMap = await getPriceMap();

  for (const asset of assets) {
    try {
      const aToken = new ethers.Contract(asset.aToken, ERC20_ABI, provider);
      const rawSupply = await aToken.totalSupply();
      const price = priceMap[asset.symbol] || 0;
      const tvl = (Number(rawSupply) / 10 ** asset.decimals) * price;

      logInfo(`${asset.symbol} TVL: $${tvl.toFixed(2)}`);
      result.push({
        symbol: asset.symbol,
        rawSupply: rawSupply.toString(),
        decimals: asset.decimals,
        price,
        tvlUSD: tvl,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      logError(`Error fetching data for ${asset.symbol}`, err);
    }
  }

  return result;
}

module.exports = {
  fetchTotalSupplyInUSD
};
