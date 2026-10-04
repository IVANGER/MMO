// BFS поиск пути — используется и сервером, и клиентом

import { isWalkable } from "./tiles.js";
import { getBlockedCells } from "./objects.js";

// 4 направления (без диагоналей — как в Tibia/Warspear)
const DIRS_4 = [
  { dx: 0, dy: -1 },  // вверх
  { dx: 1, dy: 0 },   // вправо
  { dx: 0, dy: 1 },   // вниз
  { dx: -1, dy: 0 },  // влево
];

// 8 направлений (с диагоналями) — пока не используем, но оставим
const DIRS_8 = [
  ...DIRS_4,
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: 1, dy: 1 },
  { dx: -1, dy: 1 },
];

/**
 * Проходима ли клетка с учётом тайла И объектов (деревья, камни)?
 * @param {object} location — { width, height, tiles, objects }
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function isCellWalkable(location, x, y) {
  if (!isInside({ x, y }, location.width, location.height)) return false;
  if (!isWalkable(location.tiles[y][x])) return false;
  return !getBlockedCells(location).has(key(x, y));
}

/**
 * BFS от start до goal.
 * @param {object} location — { width, height, tiles, objects }
 * @param {object} start — { x, y } (целые)
 * @param {object} goal — { x, y } (целые)
 * @param {object} options — { occupied: Set<"x,y"> } — клетки, куда нельзя (другие сущности)
 * @returns {Array<{x, y}>|null} — путь без стартовой точки, или null если путь не найден
 */
export function findPath(location, start, goal, options = {}) {
  const { width, height } = location;
  const occupied = options.occupied ?? new Set();

  // 1. Проверки
  if (!isCellWalkable(location, goal.x, goal.y)) return null;

  const startKey = key(start.x, start.y);
  const goalKey = key(goal.x, goal.y);
  if (startKey === goalKey) return [];  // уже на месте

  // 2. BFS
  const queue = [start];
  const cameFrom = new Map();
  cameFrom.set(startKey, null);

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.x === goal.x && current.y === goal.y) {
      return reconstructPath(cameFrom, start, goal);
    }

    for (const dir of DIRS_4) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;

      if (!isInside({ x: nx, y: ny }, width, height)) continue;
      if (!isCellWalkable(location, nx, ny)) continue;

      const nKey = key(nx, ny);
      if (cameFrom.has(nKey)) continue;

      // Занятые клетки — не идём (кроме цели)
      if (occupied.has(nKey) && nKey !== goalKey) continue;

      cameFrom.set(nKey, current);
      queue.push({ x: nx, y: ny });
    }
  }

  return null;  // путь не найден
}

/**
 * Получить доступные клетки в радиусе (для подсветки ходов) — на будущее
 */
export function getReachable(location, start, radius, options = {}) {
  const { width, height } = location;
  const occupied = options.occupied ?? new Set();

  const visited = new Set();
  const queue = [{ x: start.x, y: start.y, dist: 0 }];
  visited.add(key(start.x, start.y));

  const result = [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.dist > 0) {
      result.push({ x: current.x, y: current.y, dist: current.dist });
    }

    if (current.dist >= radius) continue;

    for (const dir of DIRS_4) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;

      if (!isInside({ x: nx, y: ny }, width, height)) continue;
      if (!isCellWalkable(location, nx, ny)) continue;

      const nKey = key(nx, ny);
      if (visited.has(nKey)) continue;
      if (occupied.has(nKey)) continue;

      visited.add(nKey);
      queue.push({ x: nx, y: ny, dist: current.dist + 1 });
    }
  }

  return result;
}

// ============ helpers ============

function key(x, y) {
  return `${x},${y}`;
}

function isInside(pos, width, height) {
  return pos.x >= 0 && pos.x < width && pos.y >= 0 && pos.y < height;
}

function reconstructPath(cameFrom, start, goal) {
  const path = [];
  let current = { x: goal.x, y: goal.y };

  while (current && !(current.x === start.x && current.y === start.y)) {
    path.unshift({ x: current.x, y: current.y });
    current = cameFrom.get(key(current.x, current.y));
  }

  return path;  // без стартовой точки
}