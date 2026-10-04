// Спавн, смерть и респавн мобов
// Состояние мобов сохраняется в таблицу mob_states (при выгрузке локации)

import { get, all, run } from "../db.js";
import { newMobId } from "../ids.js";
import { logger } from "../log.js";
import { getMob } from "../content/mobs/index.js";
import { createMobEntity, serializeEntity } from "./entities.js";
import { getAllSessions } from "../network/sessions.js";

// ============ Спавн при загрузке локации ============

export function ensureMobsSpawned(loc) {
  const spawns = loc.data.spawns ?? [];
  if (spawns.length === 0) return 0;

  const saved = loadMobStates(loc.id);
  let spawned = 0;

  for (const spawn of spawns) {
    const tmpl = getMob(spawn.type);
    if (!tmpl) {
      logger.warn(`Unknown mob type "${spawn.type}" in ${loc.id}`);
      continue;
    }

    // Стабильный ключ: сам спавн-слот (координаты в данных локации)
    const key = `${spawn.x},${spawn.y}`;
    const st = saved.get(key);

    const entity = createMobEntity(st?.id ?? newMobId(), spawn, tmpl);

    // Восстановление состояния из БД
    if (st) {
      entity.x = st.x;
      entity.y = st.y;
      entity.hp = st.hp;

      if (st.state === "dead") {
        entity.aiState = "dead";
        entity.hp = 0;
        entity.respawnAt = st.respawn_at ?? Date.now() + entity.respawnSec * 1000;
      } else {
        entity.aiState = st.state ?? "idle";
      }
    }

    loc.entities.set(entity.id, entity);
    spawned++;
  }

  logger.info(`Mobs spawned in ${loc.id}: ${spawned} (${spawns.length} слотов)`);
  return spawned;
}

// ============ Смерть моба ============

export function killMob(loc, mob, killerId = null) {
  if (!mob || mob.type !== "mob" || mob.aiState === "dead") return false;

  mob.hp = 0;
  mob.aiState = "dead";
  mob.state = "idle";
  mob.path = [];
  mob.aggro = false;
  mob.targetId = null;
  mob.respawnAt = Date.now() + mob.respawnSec * 1000;

  // Труп не показываем — убираем из видимости других
  broadcast(loc.id, { type: "entityLeft", entityId: mob.id });

  saveMobState(loc.id, mob, killerId);

  logger.info(`Mob died: ${mob.name} (${mob.id}) in ${loc.id}`);
  return true;
}

// ============ Респавн моба ============

export function respawnMob(loc, mob) {
  mob.x = mob.spawnX;
  mob.y = mob.spawnY;
  mob.hp = mob.maxHp;
  mob.aiState = "idle";
  mob.state = "idle";
  mob.path = [];
  mob.justArrived = false;
  mob.aggro = false;
  mob.targetId = null;
  mob.provoked = false;
  mob.respawnAt = 0;
  mob.nextWanderAt = Date.now() + 1000;

  saveMobState(loc.id, mob, null);

  broadcast(loc.id, { type: "entityJoined", entity: serializeEntity(mob) });

  logger.info(`Mob respawned: ${mob.name} (${mob.id}) at (${mob.x},${mob.y})`);
  return true;
}

// ============ Сохранение / загрузка mob_states ============

export function saveMobStates(loc) {
  let saved = 0;
  for (const e of loc.entities.values()) {
    if (e.type !== "mob") continue;
    saveMobState(loc.id, e, null);
    saved++;
  }
  if (saved > 0) logger.info(`Mob states saved: ${saved} (${loc.id})`);
  return saved;
}

function saveMobState(locationId, mob, killerId) {
  const data = JSON.stringify({ spawnX: mob.spawnX, spawnY: mob.spawnY });

  const existing = get(`SELECT id FROM mob_states WHERE id = ?`, mob.id);

  if (existing) {
    run(
      `UPDATE mob_states
       SET location_id = ?, type = ?, x = ?, y = ?, hp = ?, max_hp = ?,
           level = ?, state = ?, target_id = ?, killer_id = ?, respawn_at = ?, data = ?
       WHERE id = ?`,
      locationId, mob.mobType, mob.x, mob.y, mob.hp, mob.maxHp,
      mob.level, mob.aiState, mob.targetId, killerId, mob.respawnAt || null, data,
      mob.id
    );
  } else {
    run(
      `INSERT INTO mob_states (
         id, location_id, type, x, y, hp, max_hp, level,
         state, target_id, damage_by, killer_id, effects, respawn_at, data
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)`,
      mob.id, locationId, mob.mobType, mob.x, mob.y, mob.hp, mob.maxHp, mob.level,
      mob.aiState, mob.targetId, killerId, mob.respawnAt || null, data
    );
  }
}

// Карта сохранённых состояний: "spawnX,spawnY" → строка БД
function loadMobStates(locationId) {
  const rows = all(`SELECT * FROM mob_states WHERE location_id = ?`, locationId);
  const map = new Map();

  for (const row of rows) {
    let spawn = null;
    try {
      spawn = row.data ? JSON.parse(row.data) : null;
    } catch {
      spawn = null;
    }

    const key = spawn?.spawnX !== undefined
      ? `${spawn.spawnX},${spawn.spawnY}`
      : `${Math.round(row.x)},${Math.round(row.y)}`;

    map.set(key, row);
  }

  return map;
}

// ============ Broadcast ============

function broadcast(locationId, payload) {
  const data = JSON.stringify(payload);
  for (const s of getAllSessions()) {
    if (s.locationId !== locationId) continue;
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(data);
  }
}

// ============ Видимость ============