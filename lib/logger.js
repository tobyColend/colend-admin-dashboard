// backend/lib/logger.js
const pino = require("pino");

const allowed = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
let level = (process.env.LOG_LEVEL || '').trim().toLowerCase();
if (!allowed.includes(level)) level = 'info';

const prettyTransport = pino.transport({
  targets: [{
    target: 'pino-pretty',
    level,
    options: { colorize: true, translateTime: 'SYS:standard' }
  }]
});

const logger = pino({ level }, prettyTransport);

module.exports = { logger };
