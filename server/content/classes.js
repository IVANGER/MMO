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

    // Ресурс для навыков: "energy" — энергия (Воин), "mana" — мана (Маг)
    resource: "energy",

    // Дальность автоатаки в клетках (День 13). 1 = ближний бой (8 направлений)
    attackRange: 1,

    // Навыки, доступные классу
    skills: ["slash", "charge", "iron_skin", "battle_cry"],

    // Стартовое оружие
    startingWeapon: "rusty_sword",
  },

  mage: {
    type: "mage",
    name: "Маг",
    description: "Дальний бой. Мощные заклинания, но мало HP.",
    icon: "🔮",

    // Базовые статы на 1 уровне (вторичные — считаются из baseAttributes)
    baseStats: {
      max_hp: 100,
      max_mp: 128,
      atk: 24,
      defense: 9,
    },

    // 10 базовых характеристик на 1 уровне (День 13)
    baseAttributes: {
      STR: 3, AGI: 5, VIT: 5, INT: 10, SPI: 8,
      PER: 6, CHA: 5, LUK: 4, DEX: 5, RES: 4,
    },

    // Прирост за уровень: INT/SPI — основа мага
    growthPerLevel: {
      STR: 0, AGI: 1, VIT: 1, INT: 3, SPI: 2,
      PER: 1, CHA: 0, LUK: 1, DEX: 1, RES: 0,
    },

    resource: "mana",
    attackRange: 3,   // ← дальний бой (День 13)

    skills: ["arcane_bolt", "frost_nova", "teleport", "arcane_shield"],
    startingWeapon: "apprentice_staff",
  },

  // Заготовки для будущих классов
  // archer: { ... },
};

export function getClass(type) {
  return CLASSES[type] ?? null;
}

export function getAllClasses() {
  return Object.values(CLASSES);
}