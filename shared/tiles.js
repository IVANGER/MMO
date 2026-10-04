// Общие типы тайлов — используются и сервером, и клиентом

export const TILES = {
  grass: {
    id: "grass",
    name: "Трава",
    walkable: true,
    speed: 1.0,
    color: "#4ade80",
  },
  dirt: {
    id: "dirt",
    name: "Земля",
    walkable: true,
    speed: 1.0,
    color: "#a16207",
  },
  road: {
    id: "road",
    name: "Дорога",
    walkable: true,
    speed: 1.3,
    color: "#d4a574",
  },
  stone_road: {
    id: "stone_road",
    name: "Каменная дорога",
    walkable: true,
    speed: 1.1,
    color: "#9ca3af",
  },
  sand: {
    id: "sand",
    name: "Песок",
    walkable: true,
    speed: 0.8,
    color: "#fde047",
  },
  water: {
    id: "water",
    name: "Вода",
    walkable: false,
    color: "#3b82f6",
  },
  wall: {
    id: "wall",
    name: "Стена",
    walkable: false,
    color: "#1f2937",
  },
  tree: {
    id: "tree",
    name: "Дерево",
    walkable: false,
    color: "#166534",
  },
  house: {
    id: "house",
    name: "Дом",
    walkable: false,
    color: "#78350f",
  },
  lava: {
    id: "lava",
    name: "Лава",
    walkable: true,
    speed: 1.0,
    damage: 5,
    color: "#dc2626",
  },
  stone: {
    id: "stone",
    name: "Камень",
    walkable: false,
    color: "#6b7280",
  },
};

export function getTile(id) {
  return TILES[id] ?? TILES.wall;
}

export function isWalkable(id) {
  return getTile(id).walkable === true;
}