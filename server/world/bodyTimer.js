// Таймер тела: если игрок не вернулся 5 минут — удаляем или авто-респавн

import { logger } from "../log.js";
import * as entityStore from "./entityStore.js";
import { getLoadedLocation } from "./loadManager.js";
import { getAllSessions } from "../network/sessions.js";
import { get, run } from "../db.js";

export const BODY_TIMEOUT_MS = 5 * 60 * 1000;   // 5 минут

const CHECK_INTERVAL_MS = 10 * 1000;            // проверка каждые 10 сек

let timer = null;

export function startBodyTimer() {
  if (timer) return;
  timer = setInterval(check, CHECK_INTERVAL_MS);
  logger.info(`Body timer started (timeout ${BODY_TIMEOUT_MS / 1000}s, check every ${CHECK_INTERVAL_MS / 1000}s)`);
}

function check() {
  const expired = entityStore.getExpiredOffline(BODY_TIMEOUT_MS);

  for (const body of expired) {
    // Есть ли активная сессия на этого персонажа?
    const hasSession = getAllSessions().some(s => s.characterId === body.id);
    if (hasSession) continue;   // игрок вернулся — пропускаем

    if (body.dead) {
      // Тело мёртвое — авто-респавн
      autoRespawn(body);
    } else {
      // Тело живое — просто удаляем
      removeBody(body);
    }
  }
}

// ============ Авто-респавн ============

function autoRespawn(body) {
  logger.info(`Auto-respawn for ${body.id} (was dead, killed by ${body.killed_by ?? "unknown"})`);

  // 1. Записываем в characters: HP = 1, spawnPoint
  const START_LOCATION = "forest_1";
  const loc = getLoadedLocation(START_LOCATION);

  let spawnX = 10, spawnY = 7;
  if (loc) {
    spawnX = loc.data.spawnPoint.x;
    spawnY = loc.data.spawnPoint.y;
  }

  run(
    `UPDATE characters
     SET hp = 1, mp = 0, location_id = ?, x = ?, y = ?, last_online = ?
     WHERE id = ?`,
    START_LOCATION, spawnX, spawnY, Date.now(), body.id
  );

  // 2. Удаляем тело из мира
  entityStore.remove(body.id);

  // 3. Если локация загружена — убираем сущность
  const curLoc = getLoadedLocation(body.location_id);
  if (curLoc) {
    curLoc.entities.delete(body.id);
    curLoc.players.delete(getUserIdByCharId(body.id));
  }

  // 4. Уведомляем других
  broadcastLeave(body.location_id, body.id);
}

// ============ Удаление живого тела ============

function removeBody(body) {
  logger.info(`Body timeout for ${body.id} (alive, removed)`);

  entityStore.remove(body.id);

  const curLoc = getLoadedLocation(body.location_id);
  if (curLoc) {
    curLoc.entities.delete(body.id);
    curLoc.players.delete(getUserIdByCharId(body.id));
  }

  broadcastLeave(body.location_id, body.id);
}

// ============ Helpers ============

function getUserIdByCharId(charId) {
  const row = get(`SELECT user_id FROM characters WHERE id = ?`, charId);
  return row?.user_id ?? null;
}

function broadcastLeave(locationId, entityId) {
  const data = JSON.stringify({ type: "entityLeft", entityId });
  for (const s of getAllSessions()) {
    if (s.locationId !== locationId) continue;
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(data);
  }
}