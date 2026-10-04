// Авторизация: регистрация, вход, токены

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { get, run } from "./db.js";
import { newUserId, newToken } from "./ids.js";
import { CONFIG } from "./config.js";
import { logger } from "./log.js";
import { validateNickname, validatePassword } from "./validate.js";

// ============ Хеш пароля ============

const SCRYPT_KEYLEN = 64;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, SCRYPT_KEYLEN);
  if (hashBuf.length !== testBuf.length) return false;
  return timingSafeEqual(hashBuf, testBuf);
}

// ============ Регистрация ============

export function register(nickname, password) {
  const nickErr = validateNickname(nickname);
  if (nickErr) return { error: nickErr };

  const passErr = validatePassword(password);
  if (passErr) return { error: passErr };

  const nick = nickname.trim();
  const nickLower = nick.toLowerCase();

  const existing = get(
    `SELECT id FROM users WHERE nickname_lower = ?`,
    nickLower
  );
  if (existing) return { error: "Ник уже занят" };

  const userId = newUserId();
  const now = Date.now();

  run(
    `INSERT INTO users (id, nickname, nickname_lower, password_hash, created_at, last_seen)
     VALUES (?, ?, ?, ?, ?, ?)`,
    userId, nick, nickLower, hashPassword(password), now, now
  );

  // Создаём профиль по умолчанию
  run(
    `INSERT INTO profiles (user_id, updated_at) VALUES (?, ?)`,
    userId, now
  );

  // Создаём рейтинг по умолчанию
  run(
    `INSERT INTO ratings (user_id, updated_at) VALUES (?, ?)`,
    userId, now
  );

  logger.info(`Registered: ${nick} (${userId})`);

  return {
    user: {
      id: userId,
      nickname: nick,
      createdAt: now,
    },
  };
}

// ============ Вход ============

export function login(nickname, password) {
  if (typeof nickname !== "string" || typeof password !== "string") {
    return { error: "Неверные данные" };
  }

  const nickLower = nickname.trim().toLowerCase();
  const user = get(
    `SELECT * FROM users WHERE nickname_lower = ?`,
    nickLower
  );

  if (!user) return { error: "Неверный ник или пароль" };
  if (user.is_banned) return { error: "Аккаунт заблокирован" };

  if (!verifyPassword(password, user.password_hash)) {
    return { error: "Неверный ник или пароль" };
  }

  run(`UPDATE users SET last_seen = ? WHERE id = ?`, Date.now(), user.id);

  logger.info(`Login: ${user.nickname} (${user.id})`);

  return {
    user: {
      id: user.id,
      nickname: user.nickname,
      createdAt: user.created_at,
    },
  };
}

// ============ Токены ============

export function createToken(userId) {
  const token = newToken();
  const now = Date.now();
  const expiresAt = now + CONFIG.TOKEN_TTL * 1000;

  run(
    `INSERT INTO tokens (token, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
    token, userId, now, expiresAt
  );

  return { token, expiresAt };
}

export function verifyToken(token) {
  if (typeof token !== "string" || token.length < 10) return null;

  const row = get(
    `SELECT t.token, t.user_id, t.expires_at, u.nickname, u.created_at
     FROM tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token = ?`,
    token
  );

  if (!row) return null;
  if (row.expires_at < Date.now()) {
    // Удаляем просроченный
    run(`DELETE FROM tokens WHERE token = ?`, token);
    return null;
  }

  return {
    user: {
      id: row.user_id,
      nickname: row.nickname,
      createdAt: row.created_at,
    },
    expiresAt: row.expires_at,
  };
}

export function deleteToken(token) {
  if (typeof token !== "string") return;
  run(`DELETE FROM tokens WHERE token = ?`, token);
}

export function cleanExpiredTokens() {
  const result = run(
    `DELETE FROM tokens WHERE expires_at < ?`,
    Date.now()
  );
  if (result.changes > 0) {
    logger.info(`Cleaned ${result.changes} expired tokens`);
  }
  return result.changes;
}