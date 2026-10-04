// Навыки персонажей
// День 13: финальный баланс + класс Мага.
//   type: "damage"   — урон по цели (требует цель-монстр)
//   type: "movement" — рывок: подойти вплотную и ударить
//   type: "buff"     — бафф на себя (defense / atk)
//   type: "blink"    — телепорт с кастом (мага)
//
// Поля: cooldown (сек), mpCost (энергия или мана — по ресурсу класса),
//       range (клетки), damageMultiplier, duration, buff, slow

// ================= Воин =================

export const SKILLS = {
  slash: {
    id: "slash",
    name: "Сильный удар",
    description: "Мощный удар по цели. +50% урона.",
    icon: "🗡️",
    cooldown: 8,         // сек
    mpCost: 5,           // энергия
    range: 1,            // соседняя клетка (8 направлений)
    type: "damage",
    damageMultiplier: 1.5,
    critMultiplier: 2,   // крит ×2
  },

  charge: {
    id: "charge",
    name: "Рывок",
    description: "Быстро переместиться к цели и ударить.",
    icon: "💨",
    cooldown: 12,
    mpCost: 10,
    range: 3,            // День 13: было 5
    type: "movement",
    damageMultiplier: 1.2,
  },

  iron_skin: {
    id: "iron_skin",
    name: "Железная кожа",
    description: "+50% защиты на 15 секунд.",
    icon: "🛡️",
    cooldown: 45,         // День 13: было 15
    mpCost: 8,
    range: 0,
    type: "buff",
    duration: 15,        // День 13: было 5
    buff: { defense: 0.5 },
  },

  battle_cry: {
    id: "battle_cry",
    name: "Боевой клич",
    description: "+30% атаки на 15 секунд.",
    icon: "📢",
    cooldown: 40,         // День 13: было 20
    mpCost: 12,
    range: 0,
    type: "buff",
    duration: 15,        // День 13: было 6
    buff: { atk: 0.3 },
  },

  // ================= Маг =================

  arcane_bolt: {
    id: "arcane_bolt",
    name: "Магический снаряд",
    description: "Мощный магический удар по цели. ×2 от атаки.",
    icon: "✨",
    cooldown: 8,
    mpCost: 12,           // мана
    range: 4,
    type: "damage",
    damageMultiplier: 2.0,
    critMultiplier: 2,
  },

  frost_nova: {
    id: "frost_nova",
    name: "Ледяная вспышка",
    description: "Урон по цели + замедление.",
    icon: "❄️",
    cooldown: 8,
    mpCost: 15,
    range: 4,
    type: "damage",
    damageMultiplier: 1.5,
    slow: { mult: 0.5, duration: 3 },   // скорость цели ×0.5 на 3 сек
  },

  teleport: {
    id: "teleport",
    name: "Телепорт",
    description: "Телепорт в точку, где курсор (не дальше 5 клеток). Каст 2 секунды.",
    icon: "✨",
    cooldown: 10,
    mpCost: 10,
    range: 5,
    type: "blink",
    castTime: 2,          // сек — не мгновенно
  },

  arcane_shield: {
    id: "arcane_shield",
    name: "Магический щит",
    description: "+50% защиты на 15 секунд.",
    icon: "🛡️",
    cooldown: 15,
    mpCost: 12,
    range: 0,
    type: "buff",
    duration: 15,
    buff: { defense: 0.5 },
  },
};

export function getSkill(id) {
  return SKILLS[id] ?? null;
}