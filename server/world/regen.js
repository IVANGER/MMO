// Реген ресурсов и касты (День 13)
//
// updateRegen — HP и ресурса (мана у мага / энергия у воина) восстанавливаются
//   каждый тик. Ресурс берётся из entity.resource: "mana" | "energy".
// updateCasts — завершает касты (телепорт мага): когда срок вышел, игрока
//   телепортирует в заданную клетку. Если игрок получил урон — каст прерван.

import { logger } from "../log.js";
import { SKILLS } from "../content/skills.js";
import { isCellWalkable } from "./pathfinding.js";
import { broadcast, replyToCharacter } from "./combat.js";

// ============ Реген ============

/**
 * @param {object} loc — runtime локации
 * @param {number} dt — секунд с прошлого тика
 * @returns {object[]} изменившиеся сущности
 */
export function updateRegen(loc, dt) {
  const changed = [];

  for (const entity of loc.entities.values()) {
    if (entity.type !== "player" || entity.dead) continue;

    let dirty = false;

    if (entity.hp < entity.maxHp) {
      entity.hp = Math.min(entity.maxHp, entity.hp + (entity.hpRegen ?? 0.5) * dt);
      dirty = true;
    }

    // Ресурс навыков: энергия (воин) или мана (маг) — оба в поле mp/maxMp
    const resource = entity.resource ?? "mana";
    const regen = resource === "energy"
      ? (entity.resourceRegen ?? 0.5)
      : (entity.resourceRegen ?? 0.3);

    if (entity.mp < entity.maxMp) {
      entity.mp = Math.min(entity.maxMp, entity.mp + regen * dt);
      dirty = true;
    }

    if (dirty) changed.push(entity);
  }

  return changed;
}

// ============ Касты ============

/**
 * Проверяем касты игроков: завершившиеся → применяем эффект,
 * прерванные уроном → снимаем.
 */
export function updateCasts(loc, now = Date.now()) {
  const changed = [];

  for (const entity of loc.entities.values()) {
    if (entity.type !== "player" || entity.dead) continue;

    const cast = entity.casting;
    if (!cast) continue;

    // Каст прерван уроном (отмена при получении урона)
    if (cast.interrupted) {
      entity.casting = null;
      replyToCharacter(entity.id, {
        type: "castInterrupted",
        skillId: cast.skillId,
        reason: "Урон получен",
      });
      changed.push(entity);
      continue;
    }

    // Срок каста вышел
    if (now < cast.until) continue;

    entity.casting = null;
    const skill = SKILLS[cast.skillId];

    // Телепорт: если цель недоступна — applyBlink сам пришлёт castInterrupted
    if (skill?.type === "blink" && !applyBlink(loc, entity, cast, now)) {
      changed.push(entity);
      continue;
    }

    replyToCharacter(entity.id, {
      type: "castFinished",
      skillId: cast.skillId,
      x: entity.x,
      y: entity.y,
      mp: entity.mp,
    });

    changed.push(entity);
  }

  return changed;
}

// Телепорт мага в заранее проверенную клетку.
// @returns {boolean} true — телепорт выполнен, false — отменён (castInterrupted уже отправлен)
function applyBlink(loc, entity, cast, now) {
  // В cast клетка хранится как targetX/targetY (так же, как приходит от клиента)
  const x = cast.targetX;
  const y = cast.targetY;

  if (x === undefined || y === undefined) {
    logger.warn(`Blink ${entity.name}: нет координат в касте`);
    replyToCharacter(entity.id, {
      type: "castInterrupted",
      skillId: cast.skillId,
      reason: "Ошибка каста",
    });
    return false;
  }

  // Повторная проверка: клетка могла заняться за время каста
  if (!isCellWalkable(loc.data, x, y) || isOccupied(loc, x, y, entity.id)) {
    logger.debug(`Blink ${entity.name} → (${x},${y}) отменён: клетка занята`);
    replyToCharacter(entity.id, {
      type: "castInterrupted",
      skillId: cast.skillId,
      reason: "Клетка занята",
    });
    return false;
  }

  entity.x = x;
  entity.y = y;
  entity.path = [];
  entity.state = "idle";
  entity.moveProgress = 0;

  broadcast(loc.id, {
    type: "entityMoved",
    entities: [{ id: entity.id, x, y, state: "idle" }],
  });

  logger.debug(`Blink: ${entity.name} → (${x}, ${y})`);
  return true;
}

function isOccupied(loc, x, y, selfId) {
  for (const e of loc.entities.values()) {
    if (e.id === selfId) continue;
    if (e.type === "mob" && e.aiState === "dead") continue;
    if (Math.round(e.x) === x && Math.round(e.y) === y) return true;
  }
  return false;
}