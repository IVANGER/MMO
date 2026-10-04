// Классы персонажей

export const CLASSES = {
  warrior: {
    type: "warrior",
    name: "Воин",
    description: "Крепкий боец ближнего боя. Много HP, хороший урон.",
    icon: "⚔️",

    // Базовые статы на 1 уровне (вторичные — считаются из baseAttributes через calcAll)
    baseStats: {
      max_hp: 136,
      max_mp: 42,
      atk: 18,
      defense: 14,
    },

    // 10 базовых характеристик на 1 уровне (День 9)
    baseAttributes: {
      STR: 8, AGI: 5, VIT: 7, INT: 2, SPI: 3,
      PER: 5, CHA: 4, LUK: 4, DEX: 6, RES: 7,
    },

    // Автоматический прирост характеристик за уровень (День 9)
    growthPerLevel: {
      STR: 2, AGI: 1, VIT: 2, INT: 0, SPI: 1,
      PER: 1, CHA: 0, LUK: 1, DEX: 1, RES: 2,
    },

    // Навыки, доступные классу
    skills: ["slash", "charge", "iron_skin", "battle_cry"],

    // Стартовое оружие
    startingWeapon: "rusty_sword",
  },

  // Заготовки для будущих классов
  // mage: { ... },
  // archer: { ... },
};

export function getClass(type) {
  return CLASSES[type] ?? null;
}

export function getAllClasses() {
  return Object.values(CLASSES);
}