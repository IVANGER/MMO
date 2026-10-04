// Загрузка/выгрузка локаций (только активные в памяти)

import { getLocation } from "../content/regions/index.js";
import { ensureMobsSpawned, saveMobStates } from "./spawn.js";
import { logger } from "../log.js";

// Активные локации: locationId → { data, entities, players, loadedAt }
const loaded = new Map();

// ============ Получить локацию (загрузить, если нет) ============

export function getLoadedLocation(locationId) {
  if (loaded.has(locationId)) return loaded.get(locationId);

  const data = getLocation(locationId);
  if (!data) return null;

  const runtime = {
    id: locationId,
    data,                    // статические данные (тайлы, объекты)
    entities: new Map(),     // entityId → entity (игроки, мобы, NPC)
    players: new Set(),      // userId
    loadedAt: Date.now(),
  };

  loaded.set(locationId, runtime);
  logger.info(`Location loaded: ${locationId} (${data.name})`);

  // Спавн мобов при загрузке локации
  ensureMobsSpawned(runtime);

  return runtime;
}

// ============ Выгрузить ============

export function unloadLocation(locationId, force = false) {
  const runtime = loaded.get(locationId);
  if (!runtime) return false;

  // Не выгружаем, если есть игроки
  if (!force && runtime.players.size > 0) return false;

  // Сохраняем состояние мобов в БД
  saveMobStates(runtime);

  loaded.delete(locationId);
  logger.info(`Location unloaded: ${locationId}`);
  return true;
}

// ============ Авто-выгрузка пустых (раз в 60 сек) ============

export function startAutoUnload() {
  setInterval(() => {
    for (const id of [...loaded.keys()]) {
      unloadLocation(id);
    }
  }, 60_000);
}

// ============ Инфо ============

export function getLoadedCount() {
  return loaded.size;
}

export function getLoadedIds() {
  return [...loaded.keys()];
}