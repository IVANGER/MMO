// Опыт, уровни, характеристики (День 9)

import { get, run } from "../db.js";
import { getClass } from "../content/classes.js";
import { calcAll } from "../../shared/derivedStats.js";
import { logger } from "../log.js";

// ============ Опыт ============

// XP до следующего уровня: floor(100 × level^1.5)
export function getXpToNextLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

// Опыт за убийство: baseXP × (1 + 0.1 × mobLevel) × levelPenalty
export function calcKillXp(baseXp, mobLevel, playerLevel) {
  const raw = baseXp * (1 + 0.1 * mobLevel);
  const diff = playerLevel - mobLevel;
  const penalty = diff > 10 ? 0.1 : diff > 5 ? 0.5 : 1.0;
  return Math.max(1, Math.floor(raw * penalty));
}

// Чистая функция: начислить опыт состоянию {level, xp}
// Возвращает { level, xp, levelsGained }
export function grantXp(state, amount) {
  let level = state.level;
  let xp = state.xp + Math.max(0, Math.floor(amount));
  let levelsGained = 0;

  while (xp >= getXpToNextLevel(level)) {
    xp -= getXpToNextLevel(level);
    level += 1;
    levelsGained += 1;
  }

  return { level, xp, levelsGained };
}

// Потеря XP при смерти: 10% от XP до следующего уровня
export function loseXpOnDeath(state) {
  const loss = Math.floor(getXpToNextLevel(state.level) * 0.1);
  return Math.max(0, state.xp - loss);
}

// ============ Уровни ============

// Повышение уровня одного уровня: прирост класса к атрибутам + 3 свободных очка
// Возвращает { attrs, attrPoints } — чистая функция
export function levelUp(attrs, classType, attrPoints) {
  const cls = getClass(classType);
  const next = { ...attrs };
  for (const [code, g] of Object.entries(cls?.growthPerLevel ?? {})) {
    next[code] = (next[code] ?? 0) + g;
  }
  return { attrs: next, attrPoints: attrPoints + 3 };
}

// ============ Начисление XP персонажу (БД) ============
// Возвращает { leveled, level, xp, xpToNext } или null, если персонажа нет

export function addXp(charId, amount) {
  const row = get(
    `SELECT id, class, level, xp, attrs, attr_points FROM characters WHERE id = ?`,
    charId
  );
  if (!row) return null;

  const next = grantXp(row, amount);

  if (next.levelsGained > 0) {
    const cls = getClass(row.class);
    let attrs;
    try { attrs = row.attrs ? JSON.parse(row.attrs) : { ...cls.baseAttributes }; }
    catch { attrs = { ...cls.baseAttributes }; }
    let attrPoints = row.attr_points ?? 0;

    for (let i = 0; i < next.levelsGained; i++) {
      const up = levelUp(attrs, row.class, attrPoints);
      attrs = up.attrs;
      attrPoints = up.attrPoints;
    }

    const d = calcAll(attrs);

    // Ресурс навыков при level-up: энергия (воин) или мана (маг) — День 13
    const isEnergy = cls?.resource === "energy";
    const resMax = isEnergy ? d.energyMax : d.mp;

    run(
      `UPDATE characters
       SET level = ?, xp = ?, attrs = ?, attr_points = ?,
           max_hp = ?, max_mp = ?, atk = ?, defense = ?, speed = ?,
           hp = ?, mp = ?, last_online = ?
       WHERE id = ?`,
      next.level, next.xp, JSON.stringify(attrs), attrPoints,
      d.hp, resMax, d.meleeDamage, d.defense, d.moveSpeed,
      d.hp, resMax, Date.now(), charId
    );

    logger.info(`Level up: ${row.id} → уровень ${next.level} (+${3 * next.levelsGained} очков)`);
  } else if (next.xp !== row.xp) {
    run(`UPDATE characters SET xp = ? WHERE id = ?`, next.xp, charId);
  }

  return {
    leveled: next.levelsGained > 0,
    level: next.level,
    xp: next.xp,
    xpToNext: getXpToNextLevel(next.level),
  };
}
