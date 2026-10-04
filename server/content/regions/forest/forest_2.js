// Локация «Густой лес» (forest_2)
// Размер 25×20
// Река ВНИЗУ (y=17-19, x=0-15) и рукав ВВЕРХ (x=13-15, y=8-16) — рукав заканчивается тупиком
// у дороги. Река обрывается там же, где кончается рукав (x=15) — до восточного края не идёт.
// Дорога y=7 — вход с запада (из forest_1), идёт вглубь леса и кончается на краю рукава (x=15)
// Густой лес: деревья и камни — ОБЪЕКТЫ

import { tree, rock } from "../../objects/nature.js";

const ASCII_MAP = [
  "TTTTTTTTTTTTTTTTTTTTTTTTT",  // y=0  стена леса
  "T.......................T",  // y=1
  "T.......................T",  // y=2
  "T.......................T",  // y=3
  "T.......................T",  // y=4
  "T.......................T",  // y=5
  "T.......................T",  // y=6
  "RRRRRRRRRRRRRRRR........T",  // y=7  дорога с запада → кончается на краю рукава (x=15)
  "T............~~~........T",  // y=8  рукав реки вверх (тупик у дороги)
  "T............~~~........T",  // y=9
  "T............~~~........T",  // y=10
  "T............~~~........T",  // y=11
  "T............~~~........T",  // y=12
  "T............~~~........T",  // y=13
  "T............~~~........T",  // y=14
  "T............~~~........T",  // y=15
  "T............~~~........T",  // y=16
  "~~~~~~~~~~~~~~~~........T",  // y=17 река внизу (x=0-15, обрыв на конце рукава)
  "~~~~~~~~~~~~~~~~........T",  // y=18 река
  "~~~~~~~~~~~~~~~~........T",  // y=19 река
];

// Соответствие символов → ID тайлов
const CHAR_TO_TILE = {
  ".": "grass",
  ",": "dirt",
  "~": "water",
  "T": "dense_forest",
  "#": "wall",
  "H": "house",
  "R": "road",
  "S": "stone",
};

function parseMap(ascii) {
  const height = ascii.length;
  const width = ascii[0].length;

  const tiles = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const ch = ascii[y][x];
      const tileId = CHAR_TO_TILE[ch] ?? "grass";
      row.push(tileId);
    }
    tiles.push(row);
  }

  return { width, height, tiles };
}

const parsed = parseMap(ASCII_MAP);

// ============ Объекты: густой лес ============

const OBJECTS = [
  // Деревья
  tree(2, 4),
  tree(5, 3),
  tree(9, 4),
  tree(17, 3),
  tree(21, 4),
  tree(4, 6),
  tree(8, 6),
  tree(18, 6),
  tree(3, 9),
  tree(7, 9),
  tree(20, 9),
  tree(2, 11),
  tree(6, 11),
  tree(11, 11),
  tree(16, 11),
  tree(4, 13),
  tree(9, 13),
  tree(19, 13),
  tree(3, 15),
  tree(8, 15),
  tree(11, 15),
  tree(18, 15),
  tree(6, 16),
  tree(12, 16),
  tree(17, 17),

  // Камни
  rock(10, 3),
  rock(19, 5),
  rock(5, 9),
  rock(22, 9),
  rock(17, 13),
  rock(20, 17),
];

// ============ Спавны мобов (6 штук) ============

const SPAWNS = [
  { type: "goblin", x: 8, y: 10, respawnSec: 30 },
  { type: "goblin", x: 18, y: 10, respawnSec: 30 },
  { type: "goblin", x: 12, y: 14, respawnSec: 30 },
  { type: "wolf", x: 5, y: 12, respawnSec: 40 },
  { type: "wolf", x: 20, y: 14, respawnSec: 40 },
  { type: "orc", x: 17, y: 12, respawnSec: 60 },
];

export const FOREST_2 = {
  id: "forest_2",
  regionId: "region_forest",
  name: "Густой лес",
  type: "wilderness",

  // Позиция в сетке региона (восточнее forest_1)
  gridX: 1,
  gridY: 0,

  // Связи с другими локациями
  connections: { west: "forest_1" },

  // Размеры и карта
  width: parsed.width,
  height: parsed.height,
  tiles: parsed.tiles,

  // Точка спавна (на дороге у западного края)
  spawnPoint: { x: 4, y: 7 },

  // Объекты
  objects: OBJECTS,

  // Спавны мобов
  spawns: SPAWNS,

  // Безопасная зона?
  isSafe: false,
};