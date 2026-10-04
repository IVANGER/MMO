// Боссы
// Полноценный босс — День 20. Пока: шаблон + валидация,
// чтобы контент-пайплайн (validateContent) был цельным.

export const BOSSES = {
  forest_guardian: {
    type: "forest_guardian",
    name: "Хранитель леса",
    icon: "🌳",
    isBoss: true,
    color: "#065f46",

    hp: 300,
    maxHp: 300,
    atk: 18,
    defense: 8,
    speed: 2.0,

    aggressive: true,
    aggroRange: 6,

    wanderRadius: 0,     // босс стоит на месте
    leashRange: 12,
    attackRange: 1.5,

    xp: 200,
    respawnSec: 600,

    size: 3,
    sprite: null,        // /assets/mobs/boss_forest_guardian.png
  },
};

export function getBoss(type) {
  return BOSSES[type] ?? null;
}

export function getAllBosses() {
  return Object.values(BOSSES);
}

export function validateBosses() {
  const errors = [];

  for (const [key, boss] of Object.entries(BOSSES)) {
    if (boss.type !== key) errors.push(`${key}: type «${boss.type}» не совпадает с ключом`);
    if (!boss.name) errors.push(`${key}: нет name`);
    if (!(boss.maxHp > 0)) errors.push(`${key}: maxHp должен быть > 0`);
    if (!(boss.speed > 0)) errors.push(`${key}: speed должен быть > 0`);
    if (!boss.isBoss) errors.push(`${key}: нет флага isBoss`);
  }

  if (errors.length > 0) {
    throw new Error(`Boss validation failed: ${errors.join("; ")}`);
  }

  return Object.keys(BOSSES).length;
}
