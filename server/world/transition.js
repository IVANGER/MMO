// Переходы между локациями (по краям карты, через connections)

import { getLoadedLocation } from "./loadManager.js";
import { isCellWalkable } from "./pathfinding.js";
import { serializeEntity, isVisibleEntity } from "./entities.js";
import { getSessionByCharacterId, getAllSessions } from "../network/sessions.js";
import { getRegionMap } from "../content/regions/index.js";
import * as entityStore from "./entityStore.js";
import { logger } from "../log.js";

const EDGE_INSET = 1;   // на сколько клеток от края появляемся в новой локации

const OPPOSITE = { north: "south", south: "north", east: "west", west: "east" };

// ============ Проверка переходов (из тик-цикла) ============

export function checkTransitions(loc) {
  for (const entity of loc.entities.values()) {
    if (entity.type !== "player") continue;
    if (entity.dead) continue;

    // Проверяем только в момент прибытия в клетку (одноразовый флаг от movement.js)
    if (!entity.justArrived) continue;
    entity.justArrived = false;

    const cell = { x: Math.round(entity.x), y: Math.round(entity.y) };
    const dir = edgeDirection(loc.data, cell);
    if (!dir) continue;

    const targetId = loc.data.connections?.[dir];
    if (!targetId) continue;   // нет связи — игрок просто упирается в край

    const target = getLoadedLocation(targetId);
    if (!target) {
      logger.warn(`Transition target "${targetId}" not loaded (from ${loc.id})`);
      continue;
    }

    transitionPlayer(loc, target, entity, dir);
  }
}

// На каком краю стоит игрок?
export function edgeDirection(locData, cell) {
  if (cell.x >= locData.width - 1) return "east";
  if (cell.x <= 0) return "west";
  if (cell.y >= locData.height - 1) return "south";
  if (cell.y <= 0) return "north";
  return null;
}

// ============ Сам переход ============

function transitionPlayer(from, to, entity, dir) {
  const session = getSessionByCharacterId(entity.id);
  if (!session) return;

  const opp = OPPOSITE[dir];
  // Предпочтение — координата вдоль края: для запад/восток это y, для север/юг — x
  const prefer = (dir === "east" || dir === "west") ? Math.round(entity.y) : Math.round(entity.x);
  const entry = findEntryCell(to, opp, prefer);
  if (!entry) {
    logger.warn(`No entry cell in ${to.id} from ${opp}`);
    return;
  }

  // 1. Убираем из старой локации
  from.entities.delete(entity.id);
  from.players.delete(session.user.id);

  // 2. Добавляем в новую (на противоположной стороне)
  entity.x = entry.x;
  entity.y = entry.y;
  entity.path = [];
  entity.state = "idle";
  entity.justArrived = false;

  to.entities.set(entity.id, entity);
  to.players.add(session.user.id);
  session.locationId = to.id;

  // 3. Сохраняем в БД
  entityStore.updateLocation(entity.id, to.id, entry.x, entry.y);

  // 4. Broadcast: ушёл из старой, появился в новой
  broadcast(from.id, { type: "entityLeft", entityId: entity.id }, session.ws);
  broadcast(to.id, { type: "entityJoined", entity: serializeEntity(entity) }, session.ws);

  // 5. Игроку — новая локация целиком
  reply(session.ws, {
    type: "locationChange",
    direction: dir,
    from: from.id,
    location: {
      id: to.data.id,
      name: to.data.name,
      width: to.data.width,
      height: to.data.height,
      tiles: to.data.tiles,
      objects: to.data.objects ?? [],
      connections: to.data.connections ?? {},
      isSafe: to.data.isSafe,
      gridX: to.data.gridX ?? 0,
      gridY: to.data.gridY ?? 0,
      region: getRegionMap(to.data.regionId),   // карта региона для окна «Карта мира»
    },
    you: serializeEntity(entity),
    entities: visibleEntities(to)
      .filter((e) => e.id !== entity.id)
      .map(serializeEntity),
  });

  logger.info(
    `Transition: ${entity.name} ${from.id} → ${to.id} (${dir}) → (${entry.x},${entry.y})`
  );
}

// ============ Точка входа на противоположной стороне ============

export function findEntryCell(loc, edge, preferCoord) {
  const data = loc.data;

  // Координата, фиксированная у края
  let fixed = null;
  if (edge === "west") fixed = { x: EDGE_INSET };
  else if (edge === "east") fixed = { x: data.width - 1 - EDGE_INSET };
  else if (edge === "north") fixed = { y: EDGE_INSET };
  else if (edge === "south") fixed = { y: data.height - 1 - EDGE_INSET };
  else return null;

  for (const v of scanOrder(preferCoord)) {
    const x = fixed.x !== undefined ? fixed.x : v;
    const y = fixed.y !== undefined ? fixed.y : v;

    if (x < 0 || y < 0 || x >= data.width || y >= data.height) continue;
    if (!isCellWalkable(data, x, y)) continue;
    if (isOccupied(loc, x, y)) continue;

    return { x, y };
  }

  return null;
}

// Сначала предпочтительная координата, затем в обе стороны
function scanOrder(prefer) {
  const out = [prefer];
  for (let d = 1; d <= 64; d++) {
    out.push(prefer - d, prefer + d);
  }
  return out;
}

function isOccupied(loc, x, y) {
  for (const e of loc.entities.values()) {
    if (Math.round(e.x) === x && Math.round(e.y) === y) return true;
  }
  return false;
}

// ============ Хелперы ============

function visibleEntities(loc) {
  return [...loc.entities.values()].filter(isVisibleEntity);
}

function reply(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function broadcast(locationId, payload, exceptWs = null) {
  const data = JSON.stringify(payload);
  for (const s of getAllSessions()) {
    if (s.locationId !== locationId) continue;
    if (s.ws === exceptWs) continue;
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(data);
  }
}
