// Обработчики инвентаря и хотбара (День 12):
//   getInventory, useItem (зелья), getHotbar, setHotbarSlot, clearHotbarSlot

import { getSession } from "../network/sessions.js";
import { getLoadedLocation } from "../world/loadManager.js";
import { get, all, run } from "../db.js";
import { getItem } from "../content/items/index.js";
import { logger } from "../log.js";

function reply(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

// ============ Отправка состояния ============

function sendInventory(ws, characterId) {
  const items = all(
    `SELECT id, type, rarity, slot, level, equipped FROM items WHERE owner_id = ?`,
    characterId
  );

  reply(ws, {
    type: "inventory",
    items: items.map((it) => toClientItem(it)),
  });
}

// Предмет для клиента: шаблон + данные для tooltip (День 13)
function toClientItem(it) {
  const tmpl = getItem(it.type);
  return {
    id: it.id,
    type: it.type,
    name: tmpl?.name ?? it.type,
    icon: tmpl?.icon ?? "❓",
    description: tmpl?.description ?? "",
    rarity: tmpl?.rarity ?? it.rarity,
    slot: tmpl?.slot ?? it.slot,
    level: it.level,
    equipped: it.equipped === 1,
    // Для tooltip
    tier: tmpl?.tier ?? 1,
    bonuses: tmpl?.bonuses ?? null,
    effect: tmpl?.effect ?? null,
    cooldown: tmpl?.cooldown ?? 0,
    requires: tmpl?.requires ?? null,
    price: tmpl?.price ?? 0,
    stackable: tmpl?.stackable === true,
    maxStack: tmpl?.maxStack ?? 1,
  };
}

function sendHotbar(ws, characterId) {
  const rows = all(
    `SELECT slot_index, item_id FROM hotbar WHERE character_id = ? ORDER BY slot_index`,
    characterId
  );

  reply(ws, {
    type: "hotbar",
    slots: rows.map((r) => ({ index: r.slot_index, itemId: r.item_id })),
  });
}

// ============ Получить инвентарь ============

export function handleGetInventory(ws) {
  const session = getSession(ws);
  if (!session || !session.characterId) return;

  sendInventory(ws, session.characterId);
}

// ============ Использовать предмет (зелье) ============

export function handleUseItem(ws, msg) {
  const session = getSession(ws);
  if (!session || !session.characterId) return;

  const loc = getLoadedLocation(session.locationId);
  if (!loc) return;

  const entity = loc.entities.get(session.characterId);
  if (!entity || entity.dead) return;

  const itemId = msg.itemId;
  if (typeof itemId !== "string") {
    return reply(ws, { type: "error", message: "Неверный предмет" });
  }

  const item = get(
    `SELECT * FROM items WHERE id = ? AND owner_id = ?`,
    itemId, session.characterId
  );
  if (!item) {
    return reply(ws, { type: "error", message: "Предмет не найден" });
  }

  const tmpl = getItem(item.type);
  if (!tmpl) {
    return reply(ws, { type: "error", message: "Неизвестный предмет" });
  }

  if (tmpl.slot !== "consumable") {
    return reply(ws, { type: "error", message: "Это нельзя использовать" });
  }

  // Кулдаун расходников (общий на все зелья — День 12)
  const now = Date.now();
  if (entity.itemCooldownUntil && now < entity.itemCooldownUntil) {
    const left = Math.ceil((entity.itemCooldownUntil - now) / 1000);
    return reply(ws, { type: "itemCooldown", left });
  }

  // Эффект
  let healed = 0;
  if (tmpl.effect?.type === "heal") {
    const before = entity.hp;
    entity.hp = Math.min(entity.maxHp, entity.hp + tmpl.effect.hp);
    healed = entity.hp - before;
    logger.info(
      `Player ${entity.name} used ${tmpl.name}: +${healed} HP ` +
      `(${entity.hp}/${entity.maxHp})`
    );
  }

  // Кулдаун
  entity.itemCooldownUntil = now + (tmpl.cooldown ?? 0) * 1000;

  // Тратим 1 шт. (слоты хотбара очистятся сами — ON DELETE SET NULL)
  run(`DELETE FROM items WHERE id = ?`, itemId);

  reply(ws, {
    type: "itemUsed",
    itemId,
    hp: entity.hp,
    maxHp: entity.maxHp,
    healed,
    cooldown: tmpl.cooldown ?? 0,
    cooldownUntil: entity.itemCooldownUntil,
  });

  // Инвентарь и хотбар изменились — присылаем актуальные
  sendInventory(ws, session.characterId);
  sendHotbar(ws, session.characterId);
}

// ============ Экипировка (День 13) ============
// Бонусы применяются к runtime-сущности: atk/defense = база + бонусы надетого.
// Слот определяется полем slot предмета («weapon», «armor»...).

export function handleEquipItem(ws, msg) {
  const session = getSession(ws);
  if (!session || !session.characterId) return;

  const itemId = msg.itemId;
  if (typeof itemId !== "string") {
    return reply(ws, { type: "error", message: "Неверный предмет" });
  }

  const item = get(
    `SELECT * FROM items WHERE id = ? AND owner_id = ?`,
    itemId, session.characterId
  );
  if (!item) return reply(ws, { type: "error", message: "Предмет не найден" });

  const tmpl = getItem(item.type);
  if (!tmpl) return reply(ws, { type: "error", message: "Неизвестный предмет" });
  if (tmpl.slot === "consumable") {
    return reply(ws, { type: "error", message: "Расходник нельзя надеть" });
  }

  const char = get(
    `SELECT level FROM characters WHERE id = ?`,
    session.characterId
  );
  const needLevel = tmpl.requires?.level ?? 1;
  if (char && (char.level ?? 1) < needLevel) {
    return reply(ws, {
      type: "error",
      message: `Нужен ${needLevel} уровень`,
    });
  }

  // Снимаем предыдущий предмет этого же слота
  run(
    `UPDATE items SET equipped = 0 WHERE owner_id = ? AND slot = ? AND equipped = 1`,
    session.characterId, item.slot
  );
  run(`UPDATE items SET equipped = 1 WHERE id = ?`, itemId);

  const applied = applyEquipmentBonuses(session);
  reply(ws, {
    type: "itemEquipped",
    itemId,
    slot: item.slot,
    name: tmpl.name,
    atk: applied.atk,
    defense: applied.defense,
  });

  sendInventory(ws, session.characterId);
  logger.info(`${item.type} equipped by ${session.characterId}`);
}

export function handleUnequipItem(ws, msg) {
  const session = getSession(ws);
  if (!session || !session.characterId) return;

  const item = get(
    `SELECT id FROM items WHERE id = ? AND owner_id = ?`,
    msg.itemId, session.characterId
  );
  if (!item) return reply(ws, { type: "error", message: "Предмет не найден" });

  run(`UPDATE items SET equipped = 0 WHERE id = ?`, item.id);

  const applied = applyEquipmentBonuses(session);
  reply(ws, {
    type: "itemEquipped",
    itemId: item.id,
    atk: applied.atk,
    defense: applied.defense,
  });

  sendInventory(ws, session.characterId);
}

// Пересчёт бонусов надетого в runtime-сущность игрока.
// Возвращает итоговые atk/defense.
export function applyEquipmentBonuses(session) {
  const loc = getLoadedLocation(session.locationId);
  const entity = loc?.entities.get(session.characterId);
  if (!entity) return { atk: 0, defense: 0 };

  const rows = all(
    `SELECT type FROM items WHERE owner_id = ? AND equipped = 1`,
    session.characterId
  );

  let atkBonus = 0;
  let defBonus = 0;
  for (const r of rows) {
    const bonuses = getItem(r.type)?.bonuses;
    if (!bonuses) continue;
    atkBonus += bonuses.atk ?? 0;
    defBonus += bonuses.defense ?? 0;
  }

  entity.equippedBonuses = { atk: atkBonus, defense: defBonus };
  entity.atk = (entity.baseAtk ?? entity.atk ?? 1) + atkBonus;
  entity.defense = (entity.baseDefense ?? entity.defense ?? 0) + defBonus;

  return { atk: entity.atk, defense: entity.defense };
}

// ============ Хотбар ============

export function handleGetHotbar(ws) {
  const session = getSession(ws);
  if (!session || !session.characterId) return;

  sendHotbar(ws, session.characterId);
}

export function handleSetHotbarSlot(ws, msg) {
  const session = getSession(ws);
  if (!session || !session.characterId) return;

  const { slotIndex, itemId } = msg;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 3) {
    return reply(ws, { type: "error", message: "Неверный слот" });
  }
  if (typeof itemId !== "string") {
    return reply(ws, { type: "error", message: "Неверный предмет" });
  }

  const item = get(
    `SELECT id FROM items WHERE id = ? AND owner_id = ?`,
    itemId, session.characterId
  );
  if (!item) {
    return reply(ws, { type: "error", message: "Предмет не найден" });
  }

  run(
    `INSERT OR REPLACE INTO hotbar (character_id, slot_index, item_id)
     VALUES (?, ?, ?)`,
    session.characterId, slotIndex, itemId
  );

  reply(ws, { type: "hotbarUpdate", index: slotIndex, itemId });
  logger.debug(`Hotbar: ${session.characterId} slot ${slotIndex} ← ${itemId}`);
}

export function handleClearHotbarSlot(ws, msg) {
  const session = getSession(ws);
  if (!session || !session.characterId) return;

  const { slotIndex } = msg;
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 3) {
    return reply(ws, { type: "error", message: "Неверный слот" });
  }

  run(
    `DELETE FROM hotbar WHERE character_id = ? AND slot_index = ?`,
    session.characterId, slotIndex
  );

  reply(ws, { type: "hotbarUpdate", index: slotIndex, itemId: null });
}