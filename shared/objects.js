// Объекты мира — стоят НА тайле, блокируют проход, рисуются поверх тайла
// Общий код для сервера и клиента (как shared/tiles.js)

export const OBJECT_TYPES = {
  tree: {
    type: "tree",
    name: "Дерево",
    walkable: false,
    // Спрайт выходит за тайл: 32×64, якорь — низ-центр
    spriteW: 32,
    spriteH: 64,
    anchor: "bottom-center",
    color: "#166534",
    accent: "#78350f",
  },
  rock: {
    type: "rock",
    name: "Камень",
    walkable: false,
    spriteW: 32,
    spriteH: 32,
    anchor: "bottom-center",
    color: "#9ca3af",
    accent: "#4b5563",
  },
};

const EMPTY_SET = new Set();

export function getObjectType(type) {
  return OBJECT_TYPES[type] ?? null;
}

// Блокирует ли объект проход? (по самому объекту, иначе — по типу)
export function isBlockingObject(object) {
  if (!object) return false;
  const tmpl = getObjectType(object.type);
  const walkable = object.walkable ?? tmpl?.walkable ?? true;
  return walkable === false;
}

// Занята ли клетка объектом?
export function hasBlockingObject(location, x, y) {
  const objects = location?.objects;
  if (!objects || objects.length === 0) return false;

  for (const o of objects) {
    if (o.x === x && o.y === y && isBlockingObject(o)) return true;
  }
  return false;
}

// Множество занятых клеток "x,y" — с кэшем по ссылке на массив объектов
const blockedCache = new WeakMap();

export function getBlockedCells(location) {
  const objects = location?.objects;
  if (!objects || objects.length === 0) return EMPTY_SET;

  const cached = blockedCache.get(objects);
  if (cached) return cached;

  const set = new Set();
  for (const o of objects) {
    if (isBlockingObject(o)) set.add(`${o.x},${o.y}`);
  }

  blockedCache.set(objects, set);
  return set;
}
