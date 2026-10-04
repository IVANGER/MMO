// Бой: автоатака игрока по мобам, кулдауны, урон (День 10)
// Игрок кликает по мобу — сервер бьёт автоматически, пока моб жив и
// игрок остаётся в радиусе атаки (ATTACK_RANGE клеток).
// Урон мобов по игрокам — День 11.

import { findPath, isCellWalkable } from "./pathfinding.js";
import { killMob } from "./spawn.js";
import { addXp, calcKillXp, getXpToNextLevel } from "../character/leveling.js";
import { createRng, chance } from "../rng.js";
import { getAllSessions } from "../network/sessions.js";
import { logger } from "../log.js";

export const ATTACK_RANGE = 1.2;    // радиус атаки в клетках (вплотную)
const BASE_COOLDOWN_MS = 1000;      // базовый кулдаун между ударами
const COOLDOWN_MIN_MS = 400;        // быстрее нельзя даже с большой скоростью атаки
const REPATH_MS = 500;              // пересчёт пути к цели не чаще 2 раз в секунду

const rng = createRng(0xA77AC4);

// Кулдаун удара: чем выше скорость атаки, тем короче пауза
export function attackCooldownMs(entity) {
  const speed = entity?.attackSpeed ?? 1.0;
  return Math.max(COOLDOWN_MIN_MS, Math.round(BASE_COOLDOWN_MS / speed));
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

    // Вне радиуса — подходим к цели
    if (cellDistance(entity, mob) > ATTACK_RANGE) {
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

  const crit = chance(rng, attacker.critChance ?? 0.05);
  const raw = (attacker.atk ?? 1) - (mob.defense ?? 0);
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

function handleKill(loc, attacker, mob) {
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

function broadcast(locationId, payload) {
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
