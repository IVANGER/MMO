// Ping/Pong — определение отключений
// Сервер шлёт ping каждые N секунд, клиент отвечает pong.
// Если клиент не ответил за PING_TIMEOUT_MS — считаем отключённым.

import { CONFIG } from "../config.js";
import { logger } from "../log.js";

const clients = new Map();  // ws → { lastPong, userId }

export function registerClient(ws) {
  clients.set(ws, { lastPong: Date.now(), userId: null });
}

export function unregisterClient(ws) {
  clients.delete(ws);
}

export function onPong(ws) {
  const c = clients.get(ws);
  if (c) c.lastPong = Date.now();
}

export function setUserId(ws, userId) {
  const c = clients.get(ws);
  if (c) c.userId = userId;
}

// Запускаем цикл проверки
export function startHeartbeat() {
  setInterval(() => {
    const now = Date.now();
    for (const [ws, c] of clients) {
      if (ws.readyState !== ws.OPEN) continue;

      // Проверяем таймаут
      if (now - c.lastPong > CONFIG.PING_TIMEOUT_MS) {
        logger.warn(`Heartbeat timeout, closing connection`, { userId: c.userId });
        ws.close(1000, "heartbeat timeout");
        clients.delete(ws);
        continue;
      }

      // Шлём ping
      try {
        ws.send(JSON.stringify({ type: "ping", t: now }));
      } catch (e) {
        logger.error("Failed to send ping", e.message);
      }
    }
  }, CONFIG.PING_INTERVAL_MS);

  logger.info(`Heartbeat started (interval ${CONFIG.PING_INTERVAL_MS}ms, timeout ${CONFIG.PING_TIMEOUT_MS}ms)`);
}