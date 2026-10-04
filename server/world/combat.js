// Бой: автоатака игрока по мобам, кулдауны, урон (День 10)
// Игрок кликает по мобу — сервер бьёт автоматически, пока моб жив и
// игрок остаётся в радиусе атаки. День 12: радиус — ТОЛЬКО соседние
// по стороне клетки (inAttackRange), диагональ не считается.
// Урон мобов по игрокам — День 11.

import { findPath, isCellWalkable } from "./pathfinding.js";
import { killMob } from "./spawn.js";
import { addXp, calcKillXp, getXpToNextLevel } from "../character/leveling.js";
import { createRng, chance } from "../rng.js";
import { getAllSessions } from "../network/sessions.js";
import { logger } from "../log.js";
import * as entityStore from "./entityStore.js";

export const ATTACK_RANGE = 1.2;    // радиус атаки в клетках (вплотную)

// Радиус атаки: только соседние клетки (4 стороны) — День 12
// Манхэттен НЕ подходит: (10,10)↔(9,9) имеет манхэттен 2, но это
// диагональ, а бить можно только «по стороне»: (1,0) или (0,1).
export function inAttackRange(a, b) {
  const dx = Math.abs(Math.round(a.x) - Math.round(b.x));
  const dy = Math.abs(Math.round(a.y) - Math.round(b.y));
  // Сосед по стороне: (1, 0) или (0, 1). Не диагональ, не та же клетка.
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}
const BASE_COOLDOWN_MS = 1000;      // базовый кулдаун между ударами
const COOLDOWN_MIN_MS = 400;        // быстрее нельзя даже с большой скоростью атаки
const REPATH_MS = 500;              // пересчёт пути к цели не чаще 2 раз в секунду

const rng = createRng(0xA77AC4);

// Кулдаун удара: чем выше скорость атаки, тем короче пауза
export function attackCooldownMs(entity) {
  const speed = entity?.attackSpeed ?? 1.0;
  return Math.max(COOLDOWN_MIN_MS, Math.round(BASE_COOLDOWN_MS / speed));
}

// ============ Баффы навыков (День 12) ============
// entity.buffs = [{ stat: "atk" | "defense", mult: 1.3, until: <мс> }]
// Применяются лениво при расчёте удара — отдельный тик не нужен.

export function addBuff(entity, stat, mult, durationMs, now = Date.now()) {
  if (!Array.isArray(entity.buffs)) entity.buffs = [];
  entity.buffs = entity.buffs.filter((b) => b.stat !== stat);   // один бафф на стат
  entity.buffs.push({ stat, mult, until: now + durationMs });
}

export function buffedStat(entity, stat, base, now = Date.now()) {
  const list = entity?.buffs;
  if (!list || list.length === 0) return base;

  let mult = 1;
  let any = false;
  for (const b of list) {
    if (b.stat !== stat || b.until <= now) continue;
    mult *= b.mult;
    any = true;
  }
  return any ? base * mult : base;
}

/**
 * Автоатака: игрок с целью бьёт, пока цель жива и он в радиусе.
 * Вызывается из тик-цикла для каждой локации.
 * @returns {object[]} изменившиеся сущности (для broadcast)
 */
export function updatePlayerCombat(loc, now = Date.now()) {
  const changed = [];

  for (const entity of loc.entities.values()) {
    if (entity.type !== "player" || entity.dead) continue;
    if (!entity.targetId) continue;

    const mob = loc.entities.get(entity.targetId);

    // Цель исчезла (умерла или локация выгружена) — прекращаем автоатаку
    if (!mob || mob.type !== "mob" || mob.aiState === "dead") {
      clearTarget(entity);
      changed.push(entity);
      continue;
    }

    // Вне радиуса (не соседние по стороне клетки) — подходим к цели
    if (!inAttackRange(entity, mob)) {
      approachTarget(loc, entity, mob, now);
      changed.push(entity);
      continue;
    }

    // Дошли вплотную — бьём (если кулдаун прошёл)
    entity.path = [];
    entity.state = "idle";

    if (now < (entity.nextAttackAt ?? 0)) continue;

    strike(loc, entity, mob, now);
    changed.push(entity, mob);
  }

  return changed;
}

/**
 * Автоатака мобов по игрокам (День 11).
 * Мобы бьют, если:
 *  - моб агрессивный (aggro === true) ИЛИ provoked
 *  - цель — соседняя по стороне клетка (inAttackRange, День 12)
 *  - кулдаун моба прошёл
 *
 * @returns {object[]} изменившиеся сущности (для broadcast)
 */
export function updateMobCombat(loc, now = Date.now()) {
  const changed = [];

  for (const mob of loc.entities.values()) {
    if (mob.type !== "mob") continue;
    if (mob.aiState === "dead") continue;
    if (!mob.aggro && !mob.provoked) continue;

    // Цель — текущий targetId (игрок)
    const target = mob.targetId ? loc.entities.get(mob.targetId) : null;

    // Цель исчезла / умерла — сбрасываем
    if (!target || target.type !== "player" || target.dead) {
      mob.targetId = null;
      mob.nextAttackAt = 0;
      continue;
    }

    // Не соседние по стороне клетки — не бьём (моб подойдёт сам через mobAI)
    if (!inAttackRange(mob, target)) continue;

    // Кулдаун не прошёл — ждём
    if (now < (mob.nextAttackAt ?? 0)) continue;

    strikeMob(loc, mob, target, now);
    changed.push(mob, target);
  }

  return changed;
}

// ============ Удар моба ============

function strikeMob(loc, mob, player, now) {
  mob.nextAttackAt = now + attackCooldownMs(mob);
  logger.debug(`Strike: dist=${cellDistance(mob, player)}`);

  const crit = chance(rng, mob.critChance ?? 0.03);
  const raw =
    (mob.atk ?? 1) - buffedStat(player, "defense", player.defense ?? 0, now);
  const damage = Math.max(1, Math.floor(raw * (crit ? 2 : 1)));

  player.hp = Math.max(0, player.hp - damage);

  // Игроку — визуал урона (HP в HUD, цифра над головой, вспышка экрана)
  replyToCharacter(player.id, {
    type: "playerHit",
    attackerId: mob.id,
    attackerName: mob.name,
    damage,
    crit,
    hp: player.hp,
    maxHp: player.maxHp,
    x: player.x,
    y: player.y,
  });

  // Всем в локации — для отображения цифры урона над игроком
  broadcast(loc.id, {
    type: "combatEvent",
    attackerId: mob.id,
    targetId: player.id,
    targetType: "player",
    damage,
    crit,
    hp: player.hp,
    maxHp: player.maxHp,
    killed: player.hp <= 0,
    x: player.x,
    y: player.y,
  });

  logger.debug(
    `Mob ${mob.name} hit ${player.name} for ${damage}${crit ? " (crit)" : ""} ` +
    `(${player.hp}/${player.maxHp} HP)`
  );

  if (player.hp <= 0) handlePlayerDeath(loc, mob, player);
}

// ============ Смерть игрока ============

function handlePlayerDeath(loc, killer, player) {
  logger.info(`Player ${player.name} died from ${killer.name} in ${loc.id}`);

  // 1. Помечаем в БД
  entityStore.markDead(player.id, killer.id);

  // 2. Помечаем в runtime
  player.dead = true;
  player.hp = 0;
  player.path = [];
  player.state = "idle";
  player.targetId = null;
  player.nextAttackAt = 0;

  // 3. Убираем из loc.entities (труп невидим)
  loc.entities.delete(player.id);

  // 4. Сообщаем всем в локации — игрок исчез
  broadcast(loc.id, {
    type: "entityLeft",
    entityId: player.id,
  });

  // 5. Игроку — сообщение о смерти (экран «Ты мёртв»)
  replyToCharacter(player.id, {
    type: "youDied",
    killedBy: killer.name,
  });

  // 6. Все мобы, которые били этого игрока — теряют цель (не бьют труп)
  for (const m of loc.entities.values()) {
    if (m.type !== "mob") continue;
    if (m.targetId === player.id) {
      m.targetId = null;
      m.aggro = false;
      m.nextAttackAt = 0;
    }
  }
}

export function clearTarget(entity) {
  entity.targetId = null;
  entity.nextAttackAt = 0;
  entity.path = [];
  entity.state = "idle";
}

// ============ Удар ============

function strike(loc, attacker, mob, now) {
  attacker.nextAttackAt = now + attackCooldownMs(attacker);
  mob.provoked = true;   // пассивный моб после удара становится враждебным
  mob.aggro = true;
  logger.debug(`Strike: dist=${cellDistance(attacker, mob)}`);

  const crit = chance(rng, attacker.critChance ?? 0.05);
  const raw =
    buffedStat(attacker, "atk", attacker.atk ?? 1, now) - (mob.defense ?? 0);
  const damage = Math.max(1, Math.floor(raw * (crit ? 2 : 1)));

  mob.hp = Math.max(0, mob.hp - damage);

  broadcast(loc.id, {
    type: "combatEvent",
    attackerId: attacker.id,
    targetId: mob.id,
    damage,
    crit,
    hp: mob.hp,
    maxHp: mob.maxHp,
    killed: mob.hp <= 0,
    x: mob.x,
    y: mob.y,
  });

  if (mob.hp <= 0) handleKill(loc, attacker, mob);
}

export function handleKill(loc, attacker, mob) {
  killMob(loc, mob, attacker.id);

  // Опыт за убийство — по формуле Дня 9 (calcKillXp)
  const gained = calcKillXp(mob.xp ?? 0, mob.level ?? 1, attacker.level ?? 1);
  const result = addXp(attacker.id, gained);

  logger.info(
    `Player ${attacker.name} killed ${mob.name} in ${loc.id} ` +
    `(+${gained} XP, ур. ${result?.level ?? attacker.level})`
  );

  replyToCharacter(attacker.id, {
    type: "xpGained",
    amount: gained,
    xp: result?.xp ?? attacker.xp ?? 0,
    xpToNext: result?.xpToNext ?? getXpToNextLevel(attacker.level ?? 1),
    level: result?.level ?? attacker.level ?? 1,
    leveledUp: result?.leveled === true,
  });

  // Автоатака прекращается — моба больше нет
  clearTarget(attacker);
}

// ============ Подход к цели ============

function approachTarget(loc, entity, mob, now) {
  // Путь уже есть и пересчитывать рано — идём
  if (entity.path.length > 0 && now < (entity.nextRepathAt ?? 0)) return;

  entity.nextRepathAt = now + REPATH_MS;

  const occupied = buildOccupied(loc, entity);
  const goal = findAdjacentCell(loc, mob, occupied);

  if (!goal) {
    entity.path = [];
    entity.state = "idle";
    return;
  }

  const path = findPath(
    loc.data,
    { x: Math.round(entity.x), y: Math.round(entity.y) },
    goal,
    { occupied }
  );

  entity.path = path ?? [];
  entity.state = entity.path.length > 0 ? "moving" : "idle";
}

// Любая свободная проходимая клетка вплотную к мобу
function findAdjacentCell(loc, mob, occupied) {
  const mx = Math.round(mob.x);
  const my = Math.round(mob.y);

  const around = [
    { x: mx, y: my - 1 },
    { x: mx, y: my + 1 },
    { x: mx - 1, y: my },
    { x: mx + 1, y: my },
  ];

  for (const c of around) {
    if (!isCellWalkable(loc.data, c.x, c.y)) continue;
    if (occupied.has(`${c.x},${c.y}`)) continue;
    return c;
  }

  return null;
}

function buildOccupied(loc, self) {
  const set = new Set();
  for (const e of loc.entities.values()) {
    if (e.id === self.id) continue;
    if (e.type === "mob" && e.aiState === "dead") continue;
    set.add(`${Math.round(e.x)},${Math.round(e.y)}`);
  }
  return set;
}

function cellDistance(a, b) {
  return (
    Math.abs(Math.round(a.x) - Math.round(b.x)) +
    Math.abs(Math.round(a.y) - Math.round(b.y))
  );
}

// ============ Рассылка ============

export function broadcast(locationId, payload) {
  const data = JSON.stringify(payload);
  for (const s of getAllSessions()) {
    if (s.locationId !== locationId) continue;
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(data);
  }
}

function replyToCharacter(characterId, payload) {
  const data = JSON.stringify(payload);
  for (const s of getAllSessions()) {
    if (s.characterId !== characterId) continue;
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(data);
  }
}
