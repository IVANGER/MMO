// Природные объекты локаций: деревья и камни
// Типы объектов живут в shared/objects.js — они нужны и клиенту (отрисовка, поиск пути)

import { OBJECT_TYPES, getObjectType, isBlockingObject } from "../../../shared/objects.js";

export const NATURE_OBJECTS = {
  tree: OBJECT_TYPES.tree,
  rock: OBJECT_TYPES.rock,
};

export { getObjectType, isBlockingObject };

// ============ Конструкторы для карт локаций ============

export const tree = (x, y) => ({
  type: "tree",
  x,
  y,
  walkable: false,
  sprite: "tree",
});

export const rock = (x, y) => ({
  type: "rock",
  x,
  y,
  walkable: false,
  sprite: "rock",
});