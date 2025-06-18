// backend/lib/gitPush.js
require("dotenv").config();
const { execSync } = require("child_process");
const { logInfo, logError } = require("./utils");
const path = require("path");

function pushAssetStats() {
  try {
    const timestamp = new Date().toISOString();
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    const user = process.env.GIT_USER_NAME || "bot";
    const email = process.env.GIT_USER_EMAIL || "bot@example.com";

    if (!repo || !token) {
      throw new Error("Missing GITHUB_REPO or GITHUB_TOKEN in .env");
    }

    const remoteUrl = `https://${token}@${repo.replace(/^https?:\/\//, "")}`;

    const cwd = path.join(__dirname, "..");

    execSync(`git config user.name "${user}"`, { cwd });
    execSync(`git config user.email "${email}"`, { cwd });
    execSync(`git add data`, { cwd });
    execSync(`git commit -m "Update data at ${timestamp}"`, { cwd });
    execSync(`git push "${remoteUrl}" HEAD:main`, { cwd });

    logInfo("✅ Git push completed.");
  } catch (err) {
    logError("❌ Git push failed", err);
  }
}

module.exports = {
  pushAssetStats
};
