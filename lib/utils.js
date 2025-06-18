// backend/lib/utils.js
const { logger } = require("./logger");
const path = require("path");
const fs = require("fs");

function logInfo(...args) {
    logger.info(...args);
}

function logError(msg, err) {
    logger.error(msg);
    if (err) logger.error(err);
}

function formatUnits(value, decimals) {
    return Number(BigInt(value) / BigInt(10 ** decimals));
}

function writeWithTimestamp(filePath, json) {
    fs.writeFileSync(filePath, json);

    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp

    const { dir, name, ext } = path.parse(filePath);
    const backupName = `${name}.${timestamp}${ext}`;
    const backupPath = path.join(dir, backupName);

    fs.writeFileSync(backupPath, json);
    return backupPath;
}

module.exports = {
    logInfo,
    logError,
    formatUnits,
    writeWithTimestamp
};
