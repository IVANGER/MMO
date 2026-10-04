// Сборка всего контента: локации, объекты, мобы + валидация при загрузке

import { validateRegions, REGIONS, LOCATIONS } from "./regions/index.js";
import { validateObjects } from "./objects/index.js";
import { validateMobs } from "./mobs/index.js";
import { logger } from "../log.js";

/**
 * Полная проверка контента. Бросает исключение при ошибках.
 */
export function validateContent() {
  validateRegions();
  validateObjects(LOCATIONS);
  validateMobs(LOCATIONS);

  logger.info(
    `Content validated: ${Object.keys(REGIONS).length} регион(ов), ` +
    `${Object.keys(LOCATIONS).length} локация(й)`
  );
}

export { REGIONS, LOCATIONS };
