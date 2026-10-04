// ИИ мобов: idle (бродят у спавна), chase (преследуют игрока),
// return (возвращаются домой), dead (ждут респавна)
// Само перемещение выполняет movement.js — ИИ только ставит путь и состояние

import { findPath, isCellWalkable } from "./pathfinding.js";
import { respawnMob } from "./spawn.js";
import { createRng, randomInt } from "../rng.js";
import { logger } from "../log.js";

const REPATH_MS = 500;          // не чаще 2 раз в секунду
const WANDER_MIN_MS = 1500;
const WANDER_MAX_MS = 4000;

// Один seeded RNG на процесс — только для блуждания
const rng = createRng(0x5eed1234);

/**
 * Обновить всех мобов локации.
 * @returns {object[]} мобы, у которых изменился статус (агро/HP) — для broadcast
 */
export function updateMobs(loc, dt) {
  const now = Date.now();
  const changed = [];

  const players = [];
  for (const e of loc.entities.values()) {
    if (e.type === "player" && e.dead !== true) players.push(e);
  }

  for (const mob of loc.entities.values()) {
    if (mob.type !== "mob") continue;

    // Мёртвый — ждёт респавна
    if (mob.aiState === "dead") {
      if (now >= mob.respawnAt) respawnMob(loc, mob);
      continue;
    }

    if (think(loc, mob, players, now)) changed.push(mob);
  }

  return changed;
}

// ============ Один шаг мышления ============

// @returns {boolean} изменился ли статус (агро / HP / aiState)
function think(loc, mob, players, now) {
  const before = `${mob.aiState}|${mob.aggro}|${mob.hp}`;

  // Кого видит моб?
  const target = findTarget(mob, players);

  // Атака вплотную (урон — День 10)
  if (target && cellDistance(mob, target) <= mob.attackRange) {
    setAggro(mob, true, target);
    mob.path = [];
    mob.state = "idle";
    return statusChanged(mob, before);
  }

  // Цель есть и не уводит за лиш — преследование
  if (target && withinLeash(mob, target.x, target.y)) {
    setAggro(mob, true, target);
    mob.aiState = "chase";

    if (now >= mob.nextRepathAt || mob.path.length === 0) {
      mob.nextRepathAt = now + REPATH_MS;
      const occupied = buildOccupied(loc, mob);

      const ok = setPathTo(loc, mob, Math.round(target.x), Math.round(target.y), occupied);
      if (!ok) {
        mob.path = [];
        mob.state = "idle";
      }
    }

    return statusChanged(mob, before);
  }

  // Цель потеряна / ушла за лиш — возвращаемся домой
  const homeDist =
    Math.abs(Math.round(mob.x) - mob.spawnX) + Math.abs(Math.round(mob.y) - mob.spawnY);

  if (homeDist > 0 && (mob.aiState === "chase" || mob.aiState === "return")) {
    setAggro(mob, false, null);
    mob.aiState = "return";

    if (now >= mob.nextRepathAt || mob.path.length === 0) {
      mob.nextRepathAt = now + REPATH_MS;
      const occupied = buildOccupied(loc, mob);
      const ok = setPathTo(loc, mob, mob.spawnX, mob.spawnY, occupied, true);

      if (!ok) {
        // Путь домой не найден — телепорт на спавн (страховка)
        logger.warn(`Mob ${mob.id} не смог вернуться домой — телепорт на спавн`);
        mob.x = mob.spawnX;
        mob.y = mob.spawnY;
        mob.path = [];
        mob.state = "idle";
        mob.aiState = "idle";
      }
    }

    // Пришёл домой
    if (homeDist === 0 && mob.path.length === 0 && mob.aiState === "return") {
      mob.aiState = "idle";
      mob.nextWanderAt = now + randomInt(rng, WANDER_MIN_MS, WANDER_MAX_MS);
    }

    return statusChanged(mob, before);
  }

  // Свободен: бродим вокруг спавна
  if (mob.aiState !== "idle") {
    setAggro(mob, false, null);
    mob.aiState = "idle";
    mob.path = [];
    mob.state = "idle";
  }

  if (now >= mob.nextWanderAt && mob.path.length === 0) {
    mob.nextWanderAt = now + randomInt(rng, WANDER_MIN_MS, WANDER_MAX_MS);
    if (mob.wanderRadius > 0) wander(loc, mob);
  }

  return statusChanged(mob, before);
}

function statusChanged(mob, before) {
  return before !== `${mob.aiState}|${mob.aggro}|${mob.hp}`;
}

// ============ Блуждание ============

function wander(loc, mob) {
  const occupied = buildOccupied(loc, mob);
  const r = mob.wanderRadius;

  // 5 попыток найти свободную клетку в радиусе
  for (let i = 0; i < 5; i++) {
    const tx = mob.spawnX + randomInt(rng, -r, r);
    const ty = mob.spawnY + randomInt(rng, -r, r);

    if (!isCellWalkable(loc.data, tx, ty)) continue;
    if (occupied.has(`${tx},${ty}`)) continue;

    if (setPathTo(loc, mob, tx, ty, occupied)) return true;
  }

  return false;
}

// ============ Цель ============

function findTarget(mob, players) {
  if (players.length === 0) return null;

  // Пассивный моб агрится только если его ударили (День 9)
  const canAggro = mob.aggressive === true || mob.provoked === true;
  if (!canAggro) return null;

  const range = mob.provoked ? Math.max(mob.aggroRange, 8) : mob.aggroRange;
  if (range <= 0) return null;

  let best = null;
  let bestDist = Infinity;

  for (const p of players) {
    const d = cellDistance(mob, p);
    if (d <= range && d < bestDist) {
      best = p;
      bestDist = d;
    }
  }

  return best;
}

function setAggro(mob, aggro, target) {
  mob.aggro = aggro;
  mob.targetId = aggro ? target?.id ?? null : null;
}

// ============ Путь ============

function setPathTo(loc, mob, tx, ty, occupied, trimLeash = false) {
  const startX = Math.round(mob.x);
  const startY = Math.round(mob.y);

  const path = findPath(
    loc.data,
    { x: startX, y: startY },
    { x: tx, y: ty },
    { occupied }
  );

  if (!path) return false;

  // Обрезка по лишу (для пути домой)
  const finalPath = trimLeash ? trimToLeash(mob, path) : path;

  mob.path = finalPath;
  mob.state = finalPath.length > 0 ? "moving" : "idle";
  mob.justArrived = false;
  return true;
}

function trimToLeash(mob, path) {
  const out = [];
  for (const p of path) {
    if (!withinLeash(mob, p.x, p.y)) break;
    out.push(p);
  }
  return out;
}

function withinLeash(mob, x, y) {
  return (
    Math.abs(Math.round(x) - mob.spawnX) + Math.abs(Math.round(y) - mob.spawnY) <= mob.leashRange
  );
}

// ============ Занятые клетки (другие сущности) ============

function buildOccupied(loc, self) {
  const set = new Set();
  for (const e of loc.entities.values()) {
    if (e.id === self.id) continue;
    if (e.type === "mob" && e.aiState === "dead") continue;
    set.add(`${Math.round(e.x)},${Math.round(e.y)}`);
  }
  return set;
}

// ============ Хелперы ============

function cellDistance(a, b) {
  return Math.abs(Math.round(a.x) - Math.round(b.x)) + Math.abs(Math.round(a.y) - Math.round(b.y));
}