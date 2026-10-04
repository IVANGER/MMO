// Навыки персонажей

export const SKILLS = {
  slash: {
    id: "slash",
    name: "Удар",
    description: "Мощный удар по цели. +50% урона.",
    icon: "🗡️",
    cooldown: 3,        // сек
    mpCost: 5,
    range: 1,
    type: "damage",
    damageMultiplier: 1.5,
  },

  charge: {
    id: "charge",
    name: "Рывок",
    description: "Быстро переместиться к цели и ударить.",
    icon: "💨",
    cooldown: 8,
    mpCost: 10,
    range: 5,
    type: "movement",
    damageMultiplier: 1.2,
  },

  iron_skin: {
    id: "iron_skin",
    name: "Железная кожа",
    description: "+50% защиты на 5 секунд.",
    icon: "🛡️",
    cooldown: 15,
    mpCost: 8,
    range: 0,
    type: "buff",
    duration: 5,
    buff: { defense: 0.5 },
  },

  battle_cry: {
    id: "battle_cry",
    name: "Боевой клич",
    description: "+30% атаки на 6 секунд.",
    icon: "📢",
    cooldown: 20,
    mpCost: 12,
    range: 0,
    type: "buff",
    duration: 6,
    buff: { atk: 0.3 },
  },
};

export function getSkill(id) {
  return SKILLS[id] ?? null;
}