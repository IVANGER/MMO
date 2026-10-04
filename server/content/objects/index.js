// Сборка объектов мира + валидация при загрузке
// Объекты стоят НА тайле, блокируют проход и рисуются с сортировкой по y

import { isWalkable } from "../../../shared/tiles.js";
import { NATURE_OBJECTS, getObjectType, isBlockingObject } from "./nature.js";
import { logger } from "../../log.js";

export const OBJECTS = NATURE_OBJECTS;

/**
 * Валидация объектов одной локации.
 * @param {object} location
 * @returns {string[]} список ошибок
 */
export function validateLocationObjects(location) {
  const errors = [];
  const objects = location.objects ?? [];

  if (objects.length === 0) return errors;

  const seen = new Set();

  for (const obj of objects) {
    const where = `${location.id} (${obj.x},${obj.y})`;

    // 1. Известный тип
    if (!getObjectType(obj.type)) {
      errors.push(`${where}: неизвестный тип объекта "${obj.type}"`);
      continue;
    }

    // 2. Целые координаты внутри карты
    if (!Number.isInteger(obj.x) || !Number.isInteger(obj.y)) {
      errors.push(`${where}: координаты должны быть целыми`);
      continue;
    }
    if (obj.x < 0 || obj.x >= location.width || obj.y < 0 || obj.y >= location.height) {
      errors.push(`${where}: объект за пределами карты`);
      continue;
    }

    // 3. Не на непроходимом тайле (вода, стена, дерево-тайл, дом)
    if (!isWalkable(location.tiles[obj.y][obj.x])) {
      errors.push(`${where}: объект "${obj.type}" стоит на непроходимом тайле "${location.tiles[obj.y][obj.x]}"`);
    }

    // 4. Два объекта на одной клетке
    const key = `${obj.x},${obj.y}`;
    if (seen.has(key)) {
      errors.push(`${where}: несколько объектов на одной клетке`);
    }
    seen.add(key);
  }

  // 5. Спавн не занят объектом
  const sp = location.spawnPoint;
  if (sp && seen.has(`${sp.x},${sp.y}`)) {
    errors.push(`${location.id}: точка спавна (${sp.x},${sp.y}) занята объектом`);
  }

  return errors;
}

/**
 * Проверить объекты во всех локациях. Бросает, если есть ошибки.
 * @param {Record<string, object>} locations
 */
export function validateObjects(locations) {
  const errors = [];

  for (const loc of Object.values(locations)) {
    errors.push(...validateLocationObjects(loc));
  }

  if (errors.length > 0) {
    logger.error("Object validation failed:");
    for (const e of errors) logger.error("  " + e);
    throw new Error(`Object validation failed: ${errors.length} ошибок`);
  }

  const total = Object.values(locations).reduce((n, l) => n + (l.objects?.length ?? 0), 0);
  const blocking = Object.values(locations).reduce(
    (n, l) => n + (l.objects ?? []).filter(isBlockingObject).length,
    0
  );

  logger.info(`Objects validated: ${total} объектов (${blocking} блокируют проход)`);
  return total;
}