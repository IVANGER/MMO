// Создание персонажа и работа со слотами

import { get, all, run, tx } from "../db.js";
import { newCharId, newItemId } from "../ids.js";
import { getClass } from "../content/classes.js";
import { validateCharacterName } from "../validate.js";
import { logger } from "../log.js";
import { calcAll, calcMoveRange } from "../../shared/derivedStats.js";
import { getXpToNextLevel } from "./leveling.js";

export const MAX_CHARACTER_SLOTS = 6;

// ============ Список персонажей (по слотам) ============

export function getCharacters(userId) {
  const rows = all(
    `SELECT * FROM characters WHERE user_id = ? ORDER BY slot ASC`,
    userId
  );

  const bySlot = Array.from({ length: MAX_CHARACTER_SLOTS }, () => null);
  for (const row of rows) {
    bySlot[row.slot] = formatCharacter(row);
  }
  return bySlot;
}

// ============ Создание ============

export function createCharacter(userId, slot, name, classType) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_CHARACTER_SLOTS) {
    return { error: `Слот должен быть 0-${MAX_CHARACTER_SLOTS - 1}` };
  }

  const nameErr = validateCharacterName(name);
  if (nameErr) return { error: nameErr };

  const cls = getClass(classType);
  if (!cls) return { error: "Неизвестный класс" };

  const existing = get(
    `SELECT id FROM characters WHERE user_id = ? AND slot = ?`,
    userId, slot
  );
  if (existing) return { error: "Слот уже занят" };

  const nameTaken = get(
    `SELECT id FROM characters WHERE LOWER(name) = LOWER(?)`,
    name.trim()
  );
  if (nameTaken) return { error: "Имя уже занято" };

  const now = Date.now();
  const charId = newCharId();

  // Характеристики 1 уровня → вторичные параметры (День 9)
  const attrs = { ...cls.baseAttributes };
  const d = calcAll(attrs);

  // Ресурс навыков: энергия (воин) или мана (маг) — День 13.
  // У воина вместо маны тратится энергия: выше потолок, но и реген быстрее.
  const isEnergy = cls.resource === "energy";
  const resMax = isEnergy ? d.energyMax : d.mp;

  const create = tx(() => {
    run(
      `INSERT INTO characters (
        id, user_id, slot, name, class, level, xp,
        hp, max_hp, mp, max_mp, atk, defense, speed,
        attrs, attr_points, gold, created_at, last_online
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      charId, userId, slot, name.trim(), classType, 1, 0,
      d.hp, d.hp,
      resMax, resMax,          // mp/max_mp — это ресурс навыков (энергия или мана)
      d.meleeDamage, d.defense, d.moveSpeed,
      JSON.stringify(attrs), 0,
      0, now, now
    );

    if (cls.startingWeapon) {
      const itemId = newItemId();
      run(
        `INSERT INTO items (id, owner_id, type, rarity, slot, level, equipped, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        itemId, charId, cls.startingWeapon, "common", "weapon", 1, 1, now
      );
    }

    for (const skillId of cls.skills) {
      run(
        `INSERT INTO character_skills (character_id, skill_id, level, cooldown_until)
         VALUES (?, ?, ?, ?)`,
        charId, skillId, 1, 0
      );
    }
  });

  create();

  logger.info(`Character created: ${name} (${classType}) for user ${userId}`);

  const row = get(`SELECT * FROM characters WHERE id = ?`, charId);
  return { character: formatCharacter(row) };
}

// ============ Удаление ============

export function deleteCharacter(userId, charId) {
  const row = get(
    `SELECT id, name FROM characters WHERE id = ? AND user_id = ?`,
    charId, userId
  );
  if (!row) return { error: "Персонаж не найден" };

  run(`DELETE FROM characters WHERE id = ?`, charId);
  logger.info(`Character deleted: ${row.name} (${charId})`);
  return { ok: true };
}

// ============ Получить одного ============

export function getCharacter(userId, charId) {
  const row = get(
    `SELECT * FROM characters WHERE id = ? AND user_id = ?`,
    charId, userId
  );
  return row ? formatCharacter(row) : null;
}

// ============ Форматирование для клиента ============

function formatCharacter(row) {
  const cls = getClass(row.class);

  // Характеристики: из БД, иначе — база класса (старые персонажи без attrs)
  let attrs = null;
  if (row.attrs) {
    try { attrs = JSON.parse(row.attrs); } catch { attrs = null; }
  }
  if (!attrs && cls?.baseAttributes) attrs = { ...cls.baseAttributes };

  // Боевые параметры из характеристик (скорость атаки, крит) — День 10
  const derived = attrs ? calcAll(attrs) : null;

  // Ресурс навыков: энергия (воин) или мана (маг) — День 13
  const isEnergy = cls?.resource === "energy";
  const resMax = derived ? (isEnergy ? derived.energyMax : derived.mp) : row.max_mp;
  const resRegen = derived
    ? (isEnergy ? derived.energyRegen : derived.mpRegen)
    : 0.3;

  return {
    id: row.id,
    slot: row.slot,
    name: row.name,
    class: row.class,
    className: cls?.name ?? row.class,
    classIcon: cls?.icon ?? "❓",
    level: row.level,
    xp: row.xp,
    xpToNext: getXpToNextLevel(row.level ?? 1),
    hp: row.hp,
    maxHp: row.max_hp,
    mp: row.mp,
    maxMp: resMax,             // потолок ресурса (энергия/мана) — День 13
    resource: cls?.resource ?? "mana",
    resourceName: isEnergy ? "Энергия" : "Мана",
    hpRegen: derived?.hpRegen ?? 0.5,
    resourceRegen: resRegen,
    attackRange: cls?.attackRange ?? 1,   // радиус автоатаки — День 13
    atk: row.atk,
    defense: row.defense,
    speed: row.speed,
    moveRange: attrs ? calcMoveRange(attrs) : 3, // дальность хода, клеток
    attrs,
    attrPoints: row.attr_points ?? 0,
    attackSpeed: derived?.attackSpeed ?? 1.0,
    critChance: derived?.critChance ?? 0.05,
    gold: row.gold,
    locationId: row.location_id,
    x: row.x,
    y: row.y,
    createdAt: row.created_at,
    lastOnline: row.last_online,
  };
}