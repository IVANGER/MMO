// Тесты BFS-поиска пути (тайлы + объекты)

import { test } from "node:test";
import assert from "node:assert/strict";

import { findPath, isCellWalkable } from "../../shared/pathfinding.js";
import { LOCATIONS } from "../../server/content/regions/index.js";

// Прямоугольная комната без препятствий
function room(width = 5, height = 5, objects = []) {
  return {
    width,
    height,
    tiles: Array.from({ length: height }, () => Array.from({ length: width }, () => "grass")),
    objects,
  };
}

test("прямой путь по открытой карте", () => {
  const loc = room();
  const path = findPath(loc, { x: 0, y: 0 }, { x: 3, y: 0 });
  assert.ok(path);
  assert.equal(path.length, 3);
  assert.deepEqual(path.at(-1), { x: 3, y: 0 });
});

test("путь не включает стартовую клетку", () => {
  const loc = room();
  const path = findPath(loc, { x: 1, y: 1 }, { x: 4, y: 1 });
  assert.ok(!path.some((p) => p.x === 1 && p.y === 1));
});

test("старт = цель → пустой путь", () => {
  const loc = room();
  assert.deepEqual(findPath(loc, { x: 2, y: 2 }, { x: 2, y: 2 }), []);
});

test("цель непроходима — путь не найден", () => {
  const loc = room();
  loc.tiles[0][4] = "water";
  assert.equal(findPath(loc, { x: 0, y: 0 }, { x: 4, y: 0 }), null);
});

test("цель за пределами карты — путь не найден", () => {
  const loc = room();
  assert.equal(findPath(loc, { x: 0, y: 0 }, { x: 9, y: 9 }), null);
});

test("обход препятствия (стены)", () => {
  const loc = room();
  // Стена по x=2, кроме клетки y=4 — единственный проход
  for (let y = 0; y < 4; y++) loc.tiles[y][2] = "wall";

  const path = findPath(loc, { x: 0, y: 0 }, { x: 4, y: 0 });
  assert.ok(path);
  assert.deepEqual(path.at(-1), { x: 4, y: 0 });
});

test("объект блокирует клетку для пути", () => {
  const loc = room(3, 3, [{ type: "tree", x: 1, y: 1, walkable: false }]);

  assert.equal(isCellWalkable(loc, 1, 1), false);

  // Обходной путь существует (вокруг дерева)
  const path = findPath(loc, { x: 1, y: 0 }, { x: 1, y: 2 });
  assert.ok(path);
  assert.ok(path.length >= 4);   // не по прямой
});

test("объект в качестве цели — путь не найден", () => {
  const loc = room(3, 3, [{ type: "rock", x: 2, y: 2, walkable: false }]);
  assert.equal(findPath(loc, { x: 0, y: 0 }, { x: 2, y: 2 }), null);
});

test("occupied-клетки обходятся", () => {
  const loc = room();
  const occupied = new Set(["1,0", "2,0"]);
  const path = findPath(loc, { x: 0, y: 0 }, { x: 3, y: 0 }, { occupied });
  assert.ok(path);
  assert.ok(!path.some((p) => occupied.has(`${p.x},${p.y}`)));
});

test("занятая цель всё равно достижима", () => {
  const loc = room();
  const occupied = new Set(["3,0"]);
  const path = findPath(loc, { x: 0, y: 0 }, { x: 3, y: 0 }, { occupied });
  assert.ok(path);
  assert.deepEqual(path.at(-1), { x: 3, y: 0 });
});

test("нет пути (полностью перекрыто) — null", () => {
  const loc = room();
  // Вертикальная стена без проходов
  for (let y = 0; y < loc.height; y++) loc.tiles[y][2] = "wall";
  assert.equal(findPath(loc, { x: 0, y: 0 }, { x: 4, y: 4 }), null);
});

test("все локации контента проходимы от спавна (smoke)", () => {
  for (const loc of Object.values(LOCATIONS)) {
    assert.ok(findPath(loc, loc.spawnPoint, loc.spawnPoint) !== null ||
      isCellWalkable(loc, loc.spawnPoint.x, loc.spawnPoint.y),
      `${loc.id}: спавн должен быть проходим`);
  }
});
