// Обработчики мира

import { getSession, getAllSessions } from "../network/sessions.js";
import { getLoadedLocation } from "../world/loadManager.js";
import { createPlayerEntity, serializeEntity, isVisibleEntity } from "../world/entities.js";
import { getCharacter } from "../character/create.js";
import { get, run } from "../db.js";
import { newItemId } from "../ids.js";
import { findPath } from "../world/pathfinding.js";
import * as entityStore from "../world/entityStore.js";
import { loseXpOnDeath, getXpToNextLevel } from "../character/leveling.js";
import { getRegionMap } from "../content/regions/index.js";
import { logger } from "../log.js";

function reply(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function err(ws, message) {
  reply(ws, { type: "error", message, action: "world" });
}

function broadcastLocation(loc, payload, exceptWs = null) {
  const data = JSON.stringify(payload);
  for (const s of getAllSessions()) {
    if (s.locationId !== loc.id) continue;
    if (s.ws === exceptWs) continue;
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(data);
  }
}

// Данные локации для клиента (тайлы, объекты, связи) + видимые сущности (без мёртвых мобов)
function serializeLocation(loc) {
  return {
    id: loc.data.id,
    name: loc.data.name,
    width: loc.data.width,
    height: loc.data.height,
    tiles: loc.data.tiles,
    objects: loc.data.objects ?? [],
    connections: loc.data.connections ?? {},
    isSafe: loc.data.isSafe,
    gridX: loc.data.gridX ?? 0,
    gridY: loc.data.gridY ?? 0,
    // Карта региона для окна «Карта мира» (M) — День 10
    region: getRegionMap(loc.data.regionId),
  };
}

function visibleSerialized(loc, exceptId = null) {
  return [...loc.entities.values()]
    .filter(isVisibleEntity)
    .filter((e) => e.id !== exceptId)
    .map(serializeEntity);
}

// ============ Вход в мир ============

export function handleEnterWorld(ws, msg) {
  const session = getSession(ws);
  if (!session) return err(ws, "Не авторизован");

  const charId = msg.characterId ?? session.characterId;
  if (!charId) return err(ws, "Персонаж не выбран");

  const character = getCharacter(session.user.id, charId);
  if (!character) return err(ws, "Персонаж не найден");

  // Ищем тело в world_entities
  let body = entityStore.getById(character.id);
  let locationId, x, y, hp, mp, dead;

  if (body) {
    // Восстанавливаем из тела
    locationId = body.location_id;
    x = body.x;
    y = body.y;
    hp = body.hp;
    mp = body.mp;
    dead = body.dead === 1;

    // Помечаем онлайн
    entityStore.markOnline(character.id);
  } else {
    // Новое тело
    const START_LOCATION = "forest_1";
    const loc = getLoadedLocation(START_LOCATION);
    if (!loc) return err(ws, "Стартовая локация не найдена");

    locationId = START_LOCATION;
    x = loc.data.spawnPoint.x;
    y = loc.data.spawnPoint.y;
    hp = character.hp;
    mp = character.mp;
    dead = false;

    // Создаём запись
    entityStore.upsert({
      id: character.id,
      location_id: locationId,
      x, y,
      hp: character.hp,
      max_hp: character.maxHp,
      mp: character.mp,
      max_mp: character.maxMp,
      online: 1,
    });

    // Обновляем characters
    run(
      `UPDATE characters SET location_id = ?, x = ?, y = ?, last_online = ? WHERE id = ?`,
      locationId, x, y, Date.now(), character.id
    );
  }

  const loc = getLoadedLocation(locationId);
  if (!loc) return err(ws, "Локация не найдена");

  // Стартовый набор — 1 раз на персонажа (День 12): 5 зелий здоровья
  const packRow = get(
    `SELECT starter_pack_given FROM characters WHERE id = ?`,
    character.id
  );
  if (packRow && packRow.starter_pack_given === 0) {
    for (let i = 0; i < 5; i++) {
      run(
        `INSERT INTO items (id, owner_id, type, rarity, slot, level, equipped, created_at)
         VALUES (?, ?, 'health_potion', 'common', 'consumable', 1, 0, ?)`,
        newItemId(), character.id, Date.now()
      );
    }
    run(`UPDATE characters SET starter_pack_given = 1 WHERE id = ?`, character.id);
    logger.info(`Starter pack: 5 health potions → ${character.name}`);
  }

  // Создаём сущность
  const entity = createPlayerEntity(character);
  entity.x = x;
  entity.y = y;
  entity.hp = hp;
  entity.mp = mp;
  entity.dead = dead;

  // Если реконнект — убираем старую сущность
  loc.entities.delete(entity.id);

  // Если dead — не добавляем в loc.entities (труп невидим пока)
  if (!dead) {
    loc.entities.set(entity.id, entity);
  }
  loc.players.add(session.user.id);

  session.characterId = character.id;
  session.locationId = locationId;

  logger.info(`Player ${character.name} entered ${locationId} at (${x},${y})${dead ? " [DEAD]" : ""}`);

  // Отправляем новому игроку
  reply(ws, {
    type: "worldEntered",
    location: serializeLocation(loc),
    you: serializeEntity(entity),
    entities: visibleSerialized(loc, entity.id),
    dead,
    killedBy: body?.killed_by ?? null,
  });

  // Сообщаем остальным (только если живой)
  if (!dead) {
    broadcastLocation(loc, {
      type: "entityJoined",
      entity: serializeEntity(entity),
    }, ws);
  }
}

// ============ Движение ============

export function handleMoveTo(ws, msg) {
  const session = getSession(ws);
  if (!session || !session.locationId) return;

  const loc = getLoadedLocation(session.locationId);
  if (!loc) return;

  const entity = loc.entities.get(session.characterId);
  if (!entity) return;

  const targetX = Math.floor(msg.x);
  const targetY = Math.floor(msg.y);

  const occupied = new Set();
  for (const e of loc.entities.values()) {
    if (e.id === entity.id) continue;
    occupied.add(`${Math.round(e.x)},${Math.round(e.y)}`);
  }

  const startX = Math.round(entity.x);
  const startY = Math.round(entity.y);

  const path = findPath(
    loc.data,
    { x: startX, y: startY },
    { x: targetX, y: targetY },
    { occupied }
  );

  if (!path) {
    return reply(ws, { type: "pathNotFound", x: targetX, y: targetY });
  }

  // НЕ сбрасываем entity.x/y к целой клетке — дробная позиция сохраняется,
  // иначе клиент и сервер расходятся на ±0.5 клетки при каждом клике
  entity.path = path;
  entity.state = path.length > 0 ? "moving" : "idle";

  reply(ws, {
    type: "pathFound",
    path,
    x: targetX,
    y: targetY,
  });
}

export function handleStopMove(ws) {
  const session = getSession(ws);
  if (!session || !session.locationId) return;

  const loc = getLoadedLocation(session.locationId);
  if (!loc) return;

  const entity = loc.entities.get(session.characterId);
  if (!entity) return;

  entity.path = [];
  entity.state = "idle";

  reply(ws, { type: "stopped" });
}

// ============ Воскрешение ============

export function handleRespawn(ws) {
  const session = getSession(ws);
  if (!session || !session.characterId) return err(ws, "Не авторизован");

  const body = entityStore.getById(session.characterId);
  if (!body || body.dead !== 1) return err(ws, "Ты не мёртв");

  // SpawnPoint
  const START_LOCATION = "forest_1";
  const spawnLoc = getLoadedLocation(START_LOCATION);
  if (!spawnLoc) return err(ws, "Стартовая локация не найдена");

  const spawnX = spawnLoc.data.spawnPoint.x;
  const spawnY = spawnLoc.data.spawnPoint.y;

  // Обновляем world_entities
  entityStore.markAlive(session.characterId, 1, spawnX, spawnY, START_LOCATION);

  // Обновляем characters (с потерей 10% XP от XP до следующего уровня — День 9)
  const char = getCharacter(session.user.id, session.characterId);
  if (char) {
    const newXp = loseXpOnDeath(char);
    const xpLoss = char.xp - newXp;

    run(
      `UPDATE characters
       SET hp = 1, mp = 0, xp = ?, location_id = ?, x = ?, y = ?, last_online = ?
       WHERE id = ?`,
      newXp, START_LOCATION, spawnX, spawnY, Date.now(), session.characterId
    );

    logger.info(`Respawn: ${char.name} at (${spawnX},${spawnY}), lost ${xpLoss} XP`);
  }

  // Обновляем сущность в старой локации — удаляем
  const oldLoc = getLoadedLocation(session.locationId);
  if (oldLoc) {
    oldLoc.entities.delete(session.characterId);
    oldLoc.players.delete(session.user.id);

    const data = JSON.stringify({
      type: "entityLeft",
      entityId: session.characterId,
    });
    for (const s of getAllSessions()) {
      if (s.locationId !== oldLoc.id) continue;
      if (s.ws === ws) continue;
      if (s.ws.readyState === s.ws.OPEN) s.ws.send(data);
    }
  }

  // Возвращаем в стартовую локацию
  session.locationId = START_LOCATION;

  // Пересоздаём сущность
  const character = getCharacter(session.user.id, session.characterId);
  const entity = createPlayerEntity(character);
  entity.x = spawnX;
  entity.y = spawnY;
  entity.hp = 1;
  entity.mp = 0;

  spawnLoc.entities.set(entity.id, entity);
  spawnLoc.players.add(session.user.id);

  reply(ws, {
    type: "respawned",
    location: serializeLocation(spawnLoc),
    you: serializeEntity(entity),
    entities: visibleSerialized(spawnLoc, entity.id),
  });

  // Сообщаем другим в новой локации
  broadcastLocation(spawnLoc, {
    type: "entityJoined",
    entity: serializeEntity(entity),
  }, ws);
}