// Работа с таблицей world_entities — тела игроков в мире

import { get, all, run } from "../db.js";

// ============ Создать / обновить ============

export function upsert(data) {
  const existing = get(
    `SELECT id FROM world_entities WHERE id = ?`,
    data.id
  );

  if (existing) {
    run(
      `UPDATE world_entities
       SET location_id = ?, x = ?, y = ?,
           hp = ?, max_hp = ?, mp = ?, max_mp = ?,
           online = ?, disconnect_at = ?,
           last_seen = ?
       WHERE id = ?`,
      data.location_id, data.x, data.y,
      data.hp, data.max_hp, data.mp, data.max_mp,
      data.online ?? 1, data.disconnect_at ?? null,
      Date.now(),
      data.id
    );
  } else {
    run(
      `INSERT INTO world_entities (
        id, location_id, x, y,
        hp, max_hp, mp, max_mp,
        online, disconnect_at,
        dead, died_at, killed_by,
        last_seen, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?)`,
      data.id, data.location_id, data.x, data.y,
      data.hp, data.max_hp, data.mp, data.max_mp,
      data.online ?? 1, data.disconnect_at ?? null,
      Date.now(), Date.now()
    );
  }
}

// ============ Получить одного ============

export function getById(id) {
  return get(`SELECT * FROM world_entities WHERE id = ?`, id);
}

// ============ Получить всех в локации ============

export function getByLocation(locationId) {
  return all(
    `SELECT * FROM world_entities WHERE location_id = ?`,
    locationId
  );
}

// ============ Обновить позицию ============

export function updatePosition(id, x, y) {
  run(
    `UPDATE world_entities SET x = ?, y = ?, last_seen = ? WHERE id = ?`,
    x, y, Date.now(), id
  );
}

// ============ Обновить локацию + позицию (переход между локациями) ============

export function updateLocation(id, locationId, x, y) {
  run(
    `UPDATE world_entities SET location_id = ?, x = ?, y = ?, last_seen = ? WHERE id = ?`,
    locationId, x, y, Date.now(), id
  );

  run(
    `UPDATE characters SET location_id = ?, x = ?, y = ? WHERE id = ?`,
    locationId, x, y, id
  );
}

// ============ Обновить HP/MP ============

export function updateStats(id, hp, mp) {
  run(
    `UPDATE world_entities SET hp = ?, mp = ?, last_seen = ? WHERE id = ?`,
    hp, mp, Date.now(), id
  );
}

// ============ Пометить онлайн ============

export function markOnline(id) {
  run(
    `UPDATE world_entities
     SET online = 1, disconnect_at = NULL, last_seen = ?
     WHERE id = ?`,
    Date.now(), id
  );
}

// ============ Пометить оффлайн ============

export function markOffline(id) {
  run(
    `UPDATE world_entities
     SET online = 0, disconnect_at = ?, last_seen = ?
     WHERE id = ?`,
    Date.now(), Date.now(), id
  );
}

// ============ Смерть ============

export function markDead(id, killedBy) {
  run(
    `UPDATE world_entities
     SET dead = 1, died_at = ?, killed_by = ?, hp = 0, last_seen = ?
     WHERE id = ?`,
    Date.now(), killedBy ?? null, Date.now(), id
  );
}

// ============ Воскрешение ============

export function markAlive(id, hp, x, y, locationId) {
  run(
    `UPDATE world_entities
     SET dead = 0, died_at = NULL, killed_by = NULL,
         hp = ?, x = ?, y = ?, location_id = ?, last_seen = ?
     WHERE id = ?`,
    hp, x, y, locationId, Date.now(), id
  );
}

// ============ Удалить ============

export function remove(id) {
  run(`DELETE FROM world_entities WHERE id = ?`, id);
}

// ============ Получить всех оффлайн с истёкшим таймером ============

export function getExpiredOffline(timeoutMs) {
  const threshold = Date.now() - timeoutMs;
  return all(
    `SELECT * FROM world_entities
     WHERE online = 0 AND disconnect_at IS NOT NULL AND disconnect_at < ?`,
    threshold
  );
}