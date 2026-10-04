// Обработчики авторизации

import { register, login, createToken } from "../auth.js";
import {
  createSession,
  resumeSession,
  destroySession,
  getSession,
  getAllSessions,
} from "../network/sessions.js";
import { getLoadedLocation } from "../world/loadManager.js";
import * as entityStore from "../world/entityStore.js";
import { get, all } from "../db.js";
import { logger } from "../log.js";

// ============ helpers ============

function reply(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function ok(ws, data = {}) {
  reply(ws, { type: "ok", ...data });
}

function err(ws, message) {
  reply(ws, { type: "error", message });
}

function broadcastOnlineChange(payload, exceptWs = null) {
  const data = JSON.stringify(payload);
  for (const s of getAllSessions()) {
    if (s.ws === exceptWs) continue;
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(data);
  }
}

// ============ register ============

export function handleRegister(ws, msg) {
  const result = register(msg.nickname, msg.password);
  if (result.error) return err(ws, result.error);

  const { token, expiresAt } = createToken(result.user.id);
  createSession(ws, token, result.user);

  logger.info(`Register OK: ${result.user.nickname}`);
  ok(ws, {
    action: "registered",
    token,
    expiresAt,
    user: result.user,
  });

  broadcastOnlineChange({
    type: "onlineChange",
    userId: result.user.id,
    nickname: result.user.nickname,
    online: true,
  }, ws);
}

// ============ login ============

export function handleLogin(ws, msg) {
  const result = login(msg.nickname, msg.password);
  if (result.error) return err(ws, result.error);

  const { token, expiresAt } = createToken(result.user.id);
  createSession(ws, token, result.user);

  logger.info(`Login OK: ${result.user.nickname}`);
  ok(ws, {
    action: "loggedIn",
    token,
    expiresAt,
    user: result.user,
  });

  broadcastOnlineChange({
    type: "onlineChange",
    userId: result.user.id,
    nickname: result.user.nickname,
    online: true,
  }, ws);
}

// ============ resume ============

export function handleResume(ws, msg) {
  if (!msg.token) return err(ws, "Нет токена");

  const session = resumeSession(ws, msg.token);
  if (!session) return err(ws, "Токен недействителен");

  logger.info(`Resume OK: ${session.user.nickname}`);
  ok(ws, {
    action: "resumed",
    token: session.token,
    user: session.user,
  });

  broadcastOnlineChange({
    type: "onlineChange",
    userId: session.user.id,
    nickname: session.user.nickname,
    online: true,
  }, ws);

  // Проверяем: есть ли у игрока активное тело (offline-тело)?
  const chars = all(
    `SELECT id FROM characters WHERE user_id = ?`,
    session.user.id
  );

  if (chars.length === 0) return;

  let activeBody = null;
  for (const c of chars) {
    const body = entityStore.getById(c.id);
    if (body && body.online === 0) {
      activeBody = body;
      break;
    }
  }

  if (activeBody) {
    logger.info(`Auto-enterWorld for ${session.user.nickname} (body: ${activeBody.id})`);
    reply(ws, {
      type: "autoEnterWorld",
      characterId: activeBody.id,
    });
  }
}

// ============ logout ============

export function handleLogout(ws) {
  const session = getSession(ws);
  if (!session) return ok(ws, { action: "loggedOut" });

  const { user } = session;
  const nickname = user.nickname;

  // Проверяем, в safe-зоне ли игрок
  let isSafe = false;
  if (session.locationId && session.characterId) {
    const loc = getLoadedLocation(session.locationId);
    if (loc && loc.data.isSafe) isSafe = true;
  }

  // Если safe — удаляем тело сразу. Если нет — тело остаётся (5 мин).
  if (session.characterId && session.locationId) {
    const loc = getLoadedLocation(session.locationId);
    if (loc) {
      if (isSafe) {
        loc.entities.delete(session.characterId);
        loc.players.delete(session.user.id);
        entityStore.remove(session.characterId);

        const data = JSON.stringify({
          type: "entityLeft",
          entityId: session.characterId,
        });
        for (const s of getAllSessions()) {
          if (s.locationId !== loc.id) continue;
          if (s.ws === ws) continue;
          if (s.ws.readyState === s.ws.OPEN) s.ws.send(data);
        }

        logger.info(`Logout (safe) — removed ${session.characterId}`);
      } else {
        entityStore.markOffline(session.characterId);
        logger.info(`Logout (unsafe) — body stays for 5 min: ${session.characterId}`);
      }
    }
  }

  broadcastOnlineChange({
    type: "onlineChange",
    userId: user.id,
    nickname,
    online: false,
  });

  destroySession(ws, { deleteFromDb: true });
  logger.info(`Logout: ${nickname}`);
  ok(ws, { action: "loggedOut" });
}