// Конфиг сервера

export const CONFIG = {
  PORT: Number(process.env.PORT ?? 8080),
  DB_PATH: process.env.DB_PATH ?? "./data/game.db",
  TICK_MS: Number(process.env.TICK_MS ?? 200),
  TOKEN_SECRET: process.env.TOKEN_SECRET ?? "dev-secret",
  TOKEN_TTL: Number(process.env.TOKEN_TTL ?? 2592000),
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  PING_INTERVAL_MS: 10000,
  PING_TIMEOUT_MS: 30000,
};