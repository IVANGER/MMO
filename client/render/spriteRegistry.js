// Карта spriteKey → путь к PNG-файлу
// Тайлы: client/assets/tiles/*.png, объекты: client/assets/objects/*.png
// Нет файла (404) → рендер откатывается на цветной квадрат

export const TILE_SPRITES = {
  grass: "/assets/tiles/grass.png",
  water: "/assets/tiles/water.png",
  road: "/assets/tiles/road.png",
  stone_road: "/assets/tiles/stone_road.png",
  stone: "/assets/tiles/stone.png",
};

export const OBJECT_SPRITES = {
  tree: "/assets/objects/tree.png",
  rock: "/assets/objects/rock.png",
};

export function spritePath(key) {
  if (!key) return null;
  return TILE_SPRITES[key] ?? OBJECT_SPRITES[key] ?? null;
}

export function allSpriteKeys() {
  return [...Object.keys(TILE_SPRITES), ...Object.keys(OBJECT_SPRITES)];
}