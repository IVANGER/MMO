// Логирование

import { CONFIG } from "./config.js";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[CONFIG.LOG_LEVEL] ?? 1;

export function log(level, msg, data) {
  if ((LEVELS[level] ?? 1) < MIN_LEVEL) return;
  const time = new Date().toISOString().slice(11, 23);
  const prefix = `[${time}] [${level.toUpperCase()}]`;
  if (data !== undefined) {
    console.log(prefix, msg, data);
  } else {
    console.log(prefix, msg);
  }
}

export const logger = {
  debug: (m, d) => log("debug", m, d),
  info: (m, d) => log("info", m, d),
  warn: (m, d) => log("warn", m, d),
  error: (m, d) => log("error", m, d),
};