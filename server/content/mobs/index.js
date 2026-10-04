// Сборка всех мобов + валидация спавнов локаций

// Сборка всех мобов (обычные + боссы) + валидация спавнов локаций

import { MONSTERS, getMonster, getAllMonsters } from "./monsters.js";
import { BOSSES, getBoss, getAllBosses, validateBosses } from "./bosses.js";
import { logger } from "../../log.js";

export const MOBS = { ...MONSTERS, ...BOSSES };

export { getMonster, getAllMonsters, getBoss, getAllBosses, validateBosses };

export function getMob(type) {
  return MOBS[type] ?? null;
}

/**
 * Валидация спавнов всех локаций.
 * @param {Record<string, object>} locations
 * @returns {number} всего спавнов
 */
export function validateMobs(locations) {
  const errors = [];
  let total = 0;

  for (const loc of Object.values(locations)) {
    for (const spawn of loc.spawns ?? []) {
      total++;
      const where = `${loc.id} (${spawn.x},${spawn.y})`;

      const tmpl = getMob(spawn.type);
      if (!tmpl) {
        errors.push(`${where}: неизвестный моб "${spawn.type}"`);
        continue;
      }

      if (!Number.isInteger(spawn.x) || !Number.isInteger(spawn.y)) {
        errors.push(`${where}: координаты спавна должны быть целыми`);
        continue;
      }

      if (spawn.x < 0 || spawn.x >= loc.width || spawn.y < 0 || spawn.y >= loc.height) {
        errors.push(`${where}: спавн "${spawn.type}" за пределами карты`);
      }
    }
  }

  if (errors.length > 0) {
    logger.error("Mob spawn validation failed:");
    for (const e of errors) logger.error("  " + e);
    throw new Error(`Mob spawn validation failed: ${errors.length} ошибок`);
  }

  logger.info(`Mobs validated: ${total} спавнов`);
  return total;
}