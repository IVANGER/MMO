// Оружие (День 13: первые реальные шаблоны)
// bonuses применяются к статам сущности при экипировке (см. inventoryHandlers)
// requires — минимальный уровень персонажа
export const WEAPONS = {
  // ============ Мечи (Воин) ============

  rusty_sword: {
    type: "rusty_sword",
    name: "Ржавый меч",
    icon: "🗡️",
    description: "Ржавый, но ещё режет. Стартовое оружие воина.",
    slot: "weapon",
    rarity: "common",
    tier: 1,
    bonuses: { atk: 0 },
    requires: { level: 1 },
    price: 5,
  },

  old_sword: {
    type: "old_sword",
    name: "Старый меч",
    icon: "⚔️",
    description: "Потрёпанный временем меч.",
    slot: "weapon",
    rarity: "common",
    tier: 1,
    bonuses: { atk: 1 },        // +1 ATK
    requires: { level: 1 },
    price: 10,
  },

  // ============ Посохи (Маг) ============

  apprentice_staff: {
    type: "apprentice_staff",
    name: "Посох ученика",
    icon: "🪄",
    description: "Простой деревянный посох. Стартовое оружие мага.",
    slot: "weapon",
    rarity: "common",
    tier: 1,
    bonuses: { atk: 0 },
    requires: { level: 1 },
    price: 5,
  },
};
