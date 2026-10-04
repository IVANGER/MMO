// Сборка регионов и локаций + валидация (размеры, связи, соседство по сетке, ворота)

import { FOREST_REGION, FOREST_LOCATIONS } from "./forest/index.js";
import { isWalkable } from "../../../shared/tiles.js";
import { getBlockedCells } from "../../../shared/objects.js";
import { logger } from "../../log.js";

// Все регионы по ID
export const REGIONS = {
  [FOREST_REGION.id]: FOREST_REGION,
};

// Все локации по ID
export const LOCATIONS = {
  ...FOREST_LOCATIONS,
};

const OPPOSITE = { north: "south", south: "north", east: "west", west: "east" };

// ============ Проходима ли клетка (тайл + объекты) ============

export function isLocationCellWalkable(loc, x, y) {
  if (x < 0 || y < 0 || x >= loc.width || y >= loc.height) return false;
  if (!isWalkable(loc.tiles[y][x])) return false;
  return !getBlockedCells(loc).has(`${x},${y}`);
}

// Есть ли на краю локации хотя бы одна проходимая клетка (ворота перехода)?
function hasEdgeGate(loc, dir) {
  switch (dir) {
    case "east":
      for (let y = 0; y < loc.height; y++) if (isLocationCellWalkable(loc, loc.width - 1, y)) return true;
      return false;
    case "west":
      for (let y = 0; y < loc.height; y++) if (isLocationCellWalkable(loc, 0, y)) return true;
      return false;
    case "north":
      for (let x = 0; x < loc.width; x++) if (isLocationCellWalkable(loc, x, 0)) return true;
      return false;
    case "south":
      for (let x = 0; x < loc.width; x++) if (isLocationCellWalkable(loc, x, loc.height - 1)) return true;
      return false;
    default:
      return false;
  }
}

// Соседство по сетке региона
function gridsAreAdjacent(loc, target, dir) {
  const dx = { east: 1, west: -1, north: 0, south: 0 }[dir] ?? 0;
  const dy = { east: 0, west: 0, north: -1, south: 1 }[dir] ?? 0;
  return target.gridX === loc.gridX + dx && target.gridY === loc.gridY + dy;
}

// ============ Валидация ============

export function validateRegions() {
  const errors = [];

  for (const [regionId, region] of Object.entries(REGIONS)) {
    for (const [locId, loc] of Object.entries(region.locations)) {
      // 1. ID совпадает с ключом?
      if (loc.id !== locId) {
        errors.push(`${locId}: id не совпадает с ключом (${loc.id})`);
      }

      // 2. Обязательные поля
      if (!loc.name || !loc.tiles) {
        errors.push(`${locId}: не хватает обязательных полей`);
        continue;
      }

      // 3. Размер тайлов совпадает
      if (loc.tiles.length !== loc.height) {
        errors.push(`${locId}: tiles.length (${loc.tiles.length}) ≠ height (${loc.height})`);
      }
      for (let y = 0; y < loc.tiles.length; y++) {
        if (loc.tiles[y].length !== loc.width) {
          errors.push(`${locId}: строка ${y} имеет ширину ${loc.tiles[y].length}, ожидалось ${loc.width}`);
        }
      }

      // 4. Регион совпадает
      if (loc.regionId && loc.regionId !== regionId) {
        errors.push(`${locId}: regionId "${loc.regionId}" ≠ "${regionId}"`);
      }

      // 5. Связи: существуют, взаимны, соседние по сетке, есть ворота на краю
      for (const [dir, targetId] of Object.entries(loc.connections ?? {})) {
        const target = LOCATIONS[targetId];
        if (!target) {
          errors.push(`${locId}: ${dir} → ${targetId} не существует`);
          continue;
        }

        const opp = OPPOSITE[dir];
        if (!opp) {
          errors.push(`${locId}: неизвестное направление связи "${dir}"`);
          continue;
        }

        if (target.connections?.[opp] !== locId) {
          errors.push(`${locId} → ${targetId} (${dir}), но нет обратной связи ${opp}`);
        }

        if (!gridsAreAdjacent(loc, target, dir)) {
          errors.push(
            `${locId}(${loc.gridX},${loc.gridY}) → ${targetId}(${target.gridX},${target.gridY}) ` +
            `не соседи по сетке для направления ${dir}`
          );
        }

        if (!hasEdgeGate(loc, dir)) {
          errors.push(`${locId}: переход ${dir} → ${targetId}, но на краю нет проходимой клетки (ворота)`);
        }
        if (!hasEdgeGate(target, opp)) {
          errors.push(`${targetId}: нет проходимой клетки на краю ${opp} (ворота из ${locId})`);
        }
      }

      // 6. Точка спавна: в границах и проходима
      if (loc.spawnPoint) {
        const { x, y } = loc.spawnPoint;
        if (y < 0 || y >= loc.height || x < 0 || x >= loc.width) {
          errors.push(`${locId}: spawnPoint (${x},${y}) за пределами карты`);
        } else if (!isLocationCellWalkable(loc, x, y)) {
          errors.push(`${locId}: spawnPoint (${x},${y}) непроходим`);
        }
      } else {
        errors.push(`${locId}: нет spawnPoint`);
      }
    }
  }

  if (errors.length > 0) {
    logger.error("Region validation failed:");
    for (const e of errors) logger.error("  " + e);
    throw new Error(`Region validation failed: ${errors.length} ошибок`);
  }

  logger.info(`Regions validated: ${Object.keys(REGIONS).length} регионов, ${Object.keys(LOCATIONS).length} локаций`);
}

// ============ Геттеры ============

export function getLocation(id) {
  return LOCATIONS[id] ?? null;
}

export function getRegion(id) {
  return REGIONS[id] ?? null;
}

export function getAllLocations() {
  return Object.values(LOCATIONS);
}

export function getAllRegions() {
  return Object.values(REGIONS);
}

export function getConnections(locationId) {
  return LOCATIONS[locationId]?.connections ?? {};
}

// ============ Карта региона для клиента (День 10, окно «Карта мира») ============
// Список районов региона с их положением в сетке — клиент рисует схему
// и помечает текущий район и соседей по связям.

export function getRegionMap(regionId) {
  const region = REGIONS[regionId];
  if (!region) return null;

  return {
    id: region.id,
    name: region.name,
    gridWidth: region.gridWidth,
    gridHeight: region.gridHeight,
    locations: Object.values(region.locations).map((loc) => ({
      id: loc.id,
      name: loc.name,
      gridX: loc.gridX,
      gridY: loc.gridY,
      connections: loc.connections ?? {},
      isSafe: loc.isSafe === true,
      width: loc.width,
      height: loc.height,
    })),
  };
}