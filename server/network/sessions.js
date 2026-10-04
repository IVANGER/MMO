// Сессии игроков: гибрид памяти и БД

import { verifyToken, deleteToken } from "../auth.js";
import { logger } from "../log.js";

const byUserId = new Map();
const byToken = new Map();

// ============ Создание ============

export function createSession(ws, token, user) {
  const old = byUserId.get(user.id);
  if (old && old.ws !== ws) {
    logger.warn(`Closing old session for ${user.nickname}`);
    try { old.ws.close(4000, "new session"); } catch {}
    byToken.delete(old.token);
  }

  const session = {
    ws,
    token,
    user,
    characterId: null,
    locationId: null,
    connectedAt: Date.now(),
    lastSeen: Date.now(),
    lastActivity: Date.now(),
  };

  byUserId.set(user.id, session);
  byToken.set(token, user.id);
  ws.userId = user.id;
  ws.token = token;

  logger.info(`Session created: ${user.nickname} (${user.id})`);
  return session;
}

// ============ Восстановление ============

export function resumeSession(ws, token) {
  const userId = byToken.get(token);
  if (userId) {
    const session = byUserId.get(userId);
    if (session) {
      try { session.ws.close(4000, "replaced"); } catch {}
      session.ws = ws;
      session.lastSeen = Date.now();
      session.lastActivity = Date.now();
      ws.userId = userId;
      ws.token = token;
      logger.info(`Session resumed (memory): ${session.user.nickname}`);
      return session;
    }
  }

  const verified = verifyToken(token);
  if (!verified) return null;

  const session = {
    ws,
    token,
    user: verified.user,
    characterId: null,
    locationId: null,
    connectedAt: Date.now(),
    lastSeen: Date.now(),
    lastActivity: Date.now(),
  };

  byUserId.set(verified.user.id, session);
  byToken.set(token, verified.user.id);
  ws.userId = verified.user.id;
  ws.token = token;

  logger.info(`Session resumed (db): ${verified.user.nickname}`);
  return session;
}

// ============ Удаление ============

export function destroySession(ws, { deleteFromDb = false } = {}) {
  const userId = ws.userId;
  if (!userId) return null;

  const session = byUserId.get(userId);
  if (!session) return null;

  if (deleteFromDb) {
    deleteToken(session.token);
    byToken.delete(session.token);
  }

  byUserId.delete(userId);
  logger.info(`Session destroyed: ${session.user.nickname}`);
  return session;
}

// ============ Активность ============

export function updateActivity(ws) {
  const session = byUserId.get(ws.userId);
  if (session) session.lastActivity = Date.now();
}

// ============ Геттеры ============

export function getSession(ws) {
  return byUserId.get(ws.userId) ?? null;
}

export function getSessionByUserId(userId) {
  return byUserId.get(userId) ?? null;
}

export function getSessionByCharacterId(charId) {
  for (const s of byUserId.values()) {
    if (s.characterId === charId) return s;
  }
  return null;
}

export function isOnline(userId) {
  return byUserId.has(userId);
}

export function getOnlineCount() {
  return byUserId.size;
}

export function getAllSessions() {
  return [...byUserId.values()];
}