// Обработчики навыков (День 12): getSkills, useSkill — слоты HUD 1-4
// Эффекты: damage (Удар), movement (Рывок — телепорт вплотную), buff (Железная кожа, Боевой клич)

import { getSession, getAllSessions } from "../network/sessions.js";
import { getLoadedLocation } from "../world/loadManager.js";
import { get, all, run } from "../db.js";
import { getClass } from "../content/classes.js";
import { SKILLS } from "../content/skills.js";
import { isCellWalkable } from "../world/pathfinding.js";
import {
  inAttackRangeFor,
  applySlow,
  cellsInRange,
  addBuff,
  buffedStat,
  handleKill,
  broadcast,
  replyToCharacter,
} from "../world/combat.js";
import { createRng, chance } from "../rng.js";
import { logger } from "../log.js";

// Свой RNG для критов навыков (боевой RNG combat.js не трогаем)
const rng = createRng(0x5C1175);

function reply(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

// ============ Список навыков персонажа ============

export function handleGetSkills(ws) {
  const session = getSession(ws);
  if (!session || !session.characterId) return;

  const rows = all(
    `SELECT skill_id, level, cooldown_until FROM character_skills WHERE character_id = ?`,
    session.characterId
  );

  // Порядок слотов 1-4 = порядок навыков класса (classes.js)
  const clsRow = get(`SELECT class FROM characters WHERE id = ?`, session.characterId);
  const order = getClass(clsRow?.class)?.skills ?? [];
  rows.sort((a, b) => {
    const ia = order.indexOf(a.skill_id);
    const ib = order.indexOf(b.skill_id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  reply(ws, {
    type: "skills",
    skills: rows.map((r) => ({
      id: r.skill_id,
      name: SKILLS[r.skill_id]?.name ?? r.skill_id,
      icon: SKILLS[r.skill_id]?.icon ?? "❓",
      cooldown: SKILLS[r.skill_id]?.cooldown ?? 0,
      mpCost: SKILLS[r.skill_id]?.mpCost ?? 0,
      cooldownUntil: r.cooldown_until ?? 0,
    })),
  });
}

// ============ Использовать навык ============

export function handleUseSkill(ws, msg) {
  const session = getSession(ws);
  if (!session || !session.characterId) return;

  const loc = getLoadedLocation(session.locationId);
  if (!loc) return;

  const entity = loc.entities.get(session.characterId);
  if (!entity || entity.dead) return;

  const skillId = msg.skillId;
  const skill = SKILLS[skillId];
  if (!skill) {
    return reply(ws, { type: "error", message: "Навык не найден" });
  }

  const known = get(
    `SELECT * FROM character_skills WHERE character_id = ? AND skill_id = ?`,
    session.characterId, skillId
  );
  if (!known) {
    return reply(ws, { type: "error", message: "Навык не изучен" });
  }

  // Кулдаун (хранится в character_skills.cooldown_until)
  const now = Date.now();
  if (known.cooldown_until && now < known.cooldown_until) {
    const left = Math.ceil((known.cooldown_until - now) / 1000);
    return reply(ws, { type: "skillCooldown", skillId, left });
  }

  // Ресурс (энергия воина / мана мага) — называем правильно в ошибке
  const resourceName = entity.resource === "energy" ? "энергии" : "маны";
  if (skill.mpCost && entity.mp < skill.mpCost) {
    return reply(ws, {
      type: "error",
      message: `Недостаточно ${resourceName} (${entity.mp}/${skill.mpCost})`,
    });
  }

  // Уже кастует — новый каст не начинаем
  if (entity.casting) {
    return reply(ws, { type: "error", message: "Уже кастуешь" });
  }

  // Цель (у удара/рывка должна быть монстр-цель)
  const targetId = msg.targetId ?? entity.targetId ?? null;
  const target = targetId ? loc.entities.get(targetId) : null;
  const needsTarget = skill.type === "damage" || skill.type === "movement";

  if (needsTarget) {
    if (!target || target.type !== "mob" || target.aiState === "dead") {
      return reply(ws, { type: "error", message: "Выбери цель-монстр" });
    }
    // Дальность навыка: range = 1 → 8 направлений; > 1 → манхэттен (День 13)
    const range = skill.range ?? 1;
    if (!inAttackRangeFor(entity, target, range)) {
      return reply(ws, { type: "error", message: "Цель слишком далеко" });
    }
  }

  // Телепорт: клиент присылает клетку под курсором (msg.targetX/targetY)
  if (skill.type === "blink") {
    const dest = validateBlinkDest(loc, entity, msg);
    if (!dest.ok) return reply(ws, { type: "error", message: dest.error });

    startCast(loc, entity, skill, dest.x, dest.y, now);
    return;   // эффект применится в updateCasts, ответ — castStarted
  }

  // Эффект
  const result = applySkillEffect(loc, entity, skill, target, now);
  if (!result.ok) {
    return reply(ws, { type: "error", message: result.error });
  }

  if (skill.mpCost) entity.mp -= skill.mpCost;

  const cooldownUntil = now + skill.cooldown * 1000;
  run(
    `UPDATE character_skills SET cooldown_until = ? WHERE character_id = ? AND skill_id = ?`,
    cooldownUntil, session.characterId, skillId
  );

  reply(ws, { type: "skillUsed", skillId, mp: entity.mp, cooldownUntil });
  logger.debug(`Player ${entity.name} used skill ${skill.name}`);
}

// ============ Телепорт мага: каст 2 секунды (День 13) ============

// Проверяем клетку под курсором: проходимая, свободная, в пределах skill.range
function validateBlinkDest(loc, entity, msg) {
  const skill = SKILLS[msg.skillId];
  const range = skill?.range ?? 5;

  const tx = Number(msg.targetX);
  const ty = Number(msg.targetY);
  if (!Number.isInteger(tx) || !Number.isInteger(ty)) {
    return { ok: false, error: "Укажи точку телепорта" };
  }

  const dist =
    Math.abs(Math.round(entity.x) - tx) + Math.abs(Math.round(entity.y) - ty);

  if (dist === 0) return { ok: false, error: "Ты уже здесь" };
  if (dist > range) return { ok: false, error: `Слишком далеко (${dist}/${range})` };
  if (!isCellWalkable(loc.data, tx, ty)) return { ok: false, error: "Туда не пройти" };

  for (const e of loc.entities.values()) {
    if (e.id === entity.id) continue;
    if (e.type === "mob" && e.aiState === "dead") continue;
    if (Math.round(e.x) === tx && Math.round(e.y) === ty) {
      return { ok: false, error: "Клетка занята" };
    }
  }

  return { ok: true, x: tx, y: ty };
}

// Начать каст: списываем ресурс и кулдаун сразу, эффект — по завершении
function startCast(loc, entity, skill, x, y, now) {
  const session = getSessionOf(entity.id);
  const castTimeMs = (skill.castTime ?? 0) * 1000;

  entity.casting = {
    skillId: skill.id,
    targetX: x,
    targetY: y,
    until: now + castTimeMs,
    interrupted: false,
  };
  entity.path = [];   // во время каста не двигаемся
  entity.state = "idle";

  if (skill.mpCost) entity.mp -= skill.mpCost;

  const cooldownUntil = now + skill.cooldown * 1000;
  if (session?.characterId) {
    run(
      `UPDATE character_skills SET cooldown_until = ?
       WHERE character_id = ? AND skill_id = ?`,
      cooldownUntil, session.characterId, skill.id
    );
  }

  replyToCharacter(entity.id, {
    type: "castStarted",
    skillId: skill.id,
    until: entity.casting.until,
    mp: entity.mp,
    cooldownUntil,
  });

  logger.debug(
    `Player ${entity.name} started casting ${skill.name} (${castTimeMs / 1000}s)`
  );
}

// ============ Отмена каста (клиент: мышь ушла / Esc) ============

export function handleCancelCast(ws) {
  const session = getSession(ws);
  if (!session || !session.characterId) return;

  const loc = getLoadedLocation(session.locationId);
  if (!loc) return;

  const entity = loc.entities.get(session.characterId);
  if (!entity || !entity.casting) return;

  entity.casting = null;
  reply(ws, { type: "castCancelled" });
}

/** Прерывает каст при получении урона (вызывается из combat.js) */
export function interruptCast(entity) {
  if (!entity?.casting) return false;
  entity.casting.interrupted = true;
  return true;
}

// Сессия по characterId — нужна для записи кулдауна в character_skills
function getSessionOf(characterId) {
  return getAllSessions().find((s) => s.characterId === characterId) ?? null;
}

// ============ Эффекты навыков ============

function applySkillEffect(loc, caster, skill, target, now) {
  // ============ Урон (slash ×1.5, arcane_bolt ×2, frost_nova ×1.5) ============
  if (skill.type === "damage") {
    const d = skillDamage(caster, skill, target, now);
    strikeBySkill(loc, caster, target, d.value, d.crit);

    // Замедление (frost_nova, День 13)
    if (skill.slow) {
      applySlow(target, skill.slow.mult, skill.slow.duration * 1000, now);
      broadcast(loc.id, {
        type: "entityEffect",
        targetId: target.id,
        effect: "slow",
        mult: skill.slow.mult,
        duration: skill.slow.duration,
      });
    }
    return { ok: true };
  }

  // ============ Рывок (charge): телепорт вплотную + удар ============
  if (skill.type === "movement") {
    const spot = findFreeAdjacent(loc, target, caster);
    if (!spot) return { ok: false, error: "Нет свободной клетки рядом" };

    caster.x = spot.x;
    caster.y = spot.y;
    caster.path = [];
    caster.state = "idle";
    caster.moveProgress = 0;

    const d = skillDamage(caster, skill, target, now);
    strikeBySkill(loc, caster, target, d.value, d.crit);
    caster.targetId = target.id;   // автоатака продолжается рядом
    return { ok: true };
  }

  // ============ Бафф (iron_skin: +50% защиты, battle_cry: +30% атаки) ============
  if (skill.type === "buff") {
    for (const [stat, value] of Object.entries(skill.buff ?? {})) {
      addBuff(caster, stat, 1 + value, (skill.duration ?? 5) * 1000, now);
    }
    return { ok: true };
  }

  return { ok: false, error: "Неизвестный тип навыка" };
}

// Урон навыка: atk × множитель (+бафф атаки) − защита цели, крит ×2
function skillDamage(caster, skill, target, now) {
  const atk = buffedStat(caster, "atk", caster.atk ?? 1, now);
  const crit = chance(rng, caster.critChance ?? 0.05);
  const raw = atk * (skill.damageMultiplier ?? 1) - (target.defense ?? 0);
  return { value: Math.max(1, Math.floor(raw * (crit ? 2 : 1))), crit };
}

// Удар по мобу: HP, combatEvent всем, провокация, смерть — штатный handleKill
function strikeBySkill(loc, caster, target, damage, crit) {
  target.provoked = true;
  target.aggro = true;
  target.hp = Math.max(0, target.hp - damage);

  broadcast(loc.id, {
    type: "combatEvent",
    attackerId: caster.id,
    targetId: target.id,
    damage,
    crit,
    hp: target.hp,
    maxHp: target.maxHp,
    killed: target.hp <= 0,
    x: target.x,
    y: target.y,
    skill: true,
  });

  logger.debug(`Skill strike: ${caster.name} → ${target.name} for ${damage}`);

  if (target.hp <= 0) handleKill(loc, caster, target);
}

// Свободная клетка, граничающая с целью по стороне (для рывка)
// Свободная клетка в радиусе 1 от цели — 8 соседей (День 13, с диагоналями)
function findFreeAdjacent(loc, target, caster) {
  const tx = Math.round(target.x);
  const ty = Math.round(target.y);
  const around = cellsInRange(tx, ty, 1);

  // Уже стоим вплотную — телепорт не нужен
  for (const c of around) {
    if (Math.round(caster.x) === c.x && Math.round(caster.y) === c.y) return c;
  }

  const occupied = new Set();
  for (const e of loc.entities.values()) {
    if (e.id === caster.id || e.id === target.id) continue;
    if (e.type === "mob" && e.aiState === "dead") continue;
    occupied.add(`${Math.round(e.x)},${Math.round(e.y)}`);
  }

  for (const c of around) {
    if (!isCellWalkable(loc.data, c.x, c.y)) continue;
    if (occupied.has(`${c.x},${c.y}`)) continue;
    return c;
  }
  return null;
}