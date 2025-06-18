// backend/lib/fetchEmissionData.js
const { ethers } = require("ethers");
const { logInfo, logError } = require("./utils");
const assets = require("../config/assets.json");

const REWARDS_CONTROLLER_ADDRESS = "0xB80Fe8ECA48F4725009136f3AdA7e6a92935ba80";
const REWARDS_CONTROLLER_ABI = [
  "function getRewardsByAsset(address asset) view returns (address[] memory)",
  "function getRewardsData(address asset, address reward) view returns (uint256 index, uint256 emissionPerSecond, uint256 startTime, uint256 endTime)"
];

const RPC_URL = process.env.RPC_URL || "https://rpc.coredao.org";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const rewardsController = new ethers.Contract(REWARDS_CONTROLLER_ADDRESS, REWARDS_CONTROLLER_ABI, provider);

async function fetchEmissionStats() {
  const results = {};

  for (const asset of assets) {
    if (!asset.virtualRewardToken) {
      logInfo(`${asset.symbol}: no virtualRewardToken defined, skipping.`);
      continue;
    }

    try {
      const rewardTokens = await rewardsController.getRewardsByAsset(asset.virtualRewardToken);

      if (rewardTokens.length === 0) {
        logInfo(`${asset.symbol}: no reward tokens found`);
        continue;
      }

      // Assume only one reward token is used
      const rewardToken = rewardTokens[0];
      const [, emissionPerSecond, , endTime] = await rewardsController.getRewardsData(
        asset.virtualRewardToken,
        rewardToken
      );

      results[asset.symbol] = {
        rewardToken,
        emissionPerSecond: emissionPerSecond.toString(),
        emissionEnd: new Date(Number(endTime) * 1000).toISOString()
      };

      logInfo(`${asset.symbol}: emission ${emissionPerSecond.toString()} until ${results[asset.symbol].emissionEnd}`);
    } catch (err) {
      logError(`Failed to fetch emission for ${asset.symbol}`, err);
    }
  }

  return results;
}

module.exports = {
  fetchEmissionStats
};
// This module fetches emission data for virtual reward tokens associated with assets.
// It retrieves the reward tokens and their emission rates from the rewards controller contract.
// The results are returned as an object mapping asset symbols to their respective emission data.
// It logs information about the emissions and handles errors gracefully.