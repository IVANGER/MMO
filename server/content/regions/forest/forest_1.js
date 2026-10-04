// Локация «Опушка леса» (forest_1)
// Размер 20×15
// Река внизу (y=12-14), дорога по y=7 от спавна до восточного края (переход в forest_2)
// Деревья и камни внутри — ОБЪЕКТЫ (блокируют проход), стены по краю — тайл dense_forest (чаща)

import { tree, rock } from "../../objects/nature.js";

const ASCII_MAP = [
  "TTTTTTTTTTTTTTTTTTTT",  // y=0  стена
  "T..................T",  // y=1
  "T..................T",  // y=2
  "T..................T",  // y=3
  "T..................T",  // y=4
  "T........HH........T",  // y=5  H — дом
  "T........HH........T",  // y=6
  "T..RRRRRRRRRRRRRRRRR",  // y=7  R — дорога (спавн → восточный край, переход)
  "T..................T",  // y=8
  "T..................T",  // y=9
  "T..................T",  // y=10
  "T..................T",  // y=11
  "~~~~~~~~~~~~~~~~~~~~",  // y=12 река
  "~~~~~~~~~~~~~~~~~~~~",  // y=13 река
  "~~~~~~~~~~~~~~~~~~~~",  // y=14 река
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

// ============ Объекты (деревья и камни внутри карты) ============

const OBJECTS = [
  // Деревья
  tree(3, 2),
  tree(12, 2),
  tree(16, 2),
  tree(6, 4),
  tree(10, 9),
  tree(15, 9),
  tree(3, 11),
  tree(12, 11),
  tree(16, 11),

  // Камни (булыжники)
  rock(4, 4),
  rock(15, 4),
  rock(17, 5),
  rock(3, 9),
  rock(13, 9),
  rock(8, 11),
];

export const FOREST_1 = {
  id: "forest_1",
  regionId: "region_forest",
  name: "Опушка леса",
  type: "wilderness",

  // Позиция в сетке региона
  gridX: 0,
  gridY: 0,

  // Связи с другими локациями
  connections: { east: "forest_2" },

  // Размеры и карта
  width: parsed.width,
  height: parsed.height,
  tiles: parsed.tiles,

  // Точка спавна игроков (левее центра — чтобы дорога была длиннее)
  spawnPoint: { x: 5, y: 7 },

  // Объекты
  objects: OBJECTS,

  // Спавны мобов (в forest_1 пока пусто)
  spawns: [],

  // Безопасная зона?
  isSafe: false,
};