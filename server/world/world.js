// Мир: реестр активных локаций, тик-цикл

import { CONFIG } from "../config.js";
import { logger } from "../log.js";
import {
  getLoadedLocation,
  getLoadedCount,
  getLoadedIds,
} from "./loadManager.js";
import { updateMovements } from "./movement.js";
import { updateMobs } from "./mobAI.js";
import { updatePlayerCombat, updateMobCombat } from "./combat.js";
import { checkTransitions } from "./transition.js";
import { isVisibleEntity } from "./entities.js";
import { getAllSessions } from "../network/sessions.js";
import * as entityStore from "./entityStore.js";

let tickCount = 0;
let lastTick = Date.now();

// Сохранение позиций раз в 5 секунд
const SAVE_INTERVAL_TICKS = Math.round(5000 / CONFIG.TICK_MS);  // 25 тиков при 200мс

export function startTick() {
  setInterval(() => {
    tick();
  }, CONFIG.TICK_MS);

  logger.info(`World tick started (${CONFIG.TICK_MS}ms, ${1000 / CONFIG.TICK_MS} tps)`);
}

function tick() {
  tickCount++;
  const now = Date.now();
  const dt = Math.min(0.5, (now - lastTick) / 1000);
  lastTick = now;

  for (const locId of getLoadedIds()) {
    const loc = getLoadedLocation(locId);
    if (!loc) continue;

    // 1. ИИ мобов (ставит пути: wander / chase / return, респавн)
    const mobChanged = updateMobs(loc, dt);

    // 1.5. Автоатака игроков по целям (День 10): урон, кулдаун, опыт
    const playerCombatChanged = updatePlayerCombat(loc, now);

    // 1.6. Автоатака мобов по игрокам (День 11): урон, кулдаун, смерть игрока
    const mobCombatChanged = updateMobCombat(loc, now);

    // 2. Движение всех сущностей (игроки + мобы)
    const moved = updateMovements(loc, dt);

    // 3. Переходы между локациями
    checkTransitions(loc);

    // 4. Broadcast изменений
    const changed = mergeChanged(moved, mobChanged, playerCombatChanged, mobCombatChanged);
    if (changed.length > 0) {
      broadcastLocationUpdate(loc, changed);
    }
  }

  // Каждые 5 секунд — сохраняем позиции игроков
  if (tickCount % SAVE_INTERVAL_TICKS === 0) {
    for (const locId of [...getLoadedIds()]) {
      const loc = getLoadedLocation(locId);
      if (loc) savePlayerPositions(loc);
    }
  }

  // Раз в 60 секунд — выгружаем пустые локации (сохраняя мобов).
  // Делается в loadManager.startAutoUnload() — здесь не дублируем.
  if (tickCount % Math.round(5000 / CONFIG.TICK_MS) === 0) {
    logger.debug(`Tick #${tickCount}, locations: ${getLoadedCount()}`);
  }
}

// ============ Слияние изменений (без дублей) ============

function mergeChanged(moved, mobChanged, ...combatArrays) {
  const map = new Map();
  for (const e of moved) map.set(e.id, e);
  for (const e of mobChanged) map.set(e.id, e);
  for (const arr of combatArrays) {
    for (const e of arr) map.set(e.id, e);
  }
  return [...map.values()].filter(isVisibleEntity);
}

// ============ Сохранение позиций ============

function savePlayerPositions(loc) {
  for (const entity of loc.entities.values()) {
    if (entity.type !== "player") continue;

    try {
      entityStore.updatePosition(entity.id, entity.x, entity.y);
      if (entity.hp !== undefined && entity.mp !== undefined) {
        entityStore.updateStats(entity.id, entity.hp, entity.mp);
      }
    } catch (err) {
      logger.error(`Failed to save position for ${entity.id}`, err.message);
    }
  }
}

// ============ Broadcast ============

function broadcastLocationUpdate(loc, changedEntities) {
  const payload = {
    type: "entityMoved",
    entities: changedEntities.map((e) => serializeMove(e)),
  };

  const data = JSON.stringify(payload);

  for (const s of getAllSessions()) {
    if (s.locationId !== loc.id) continue;
    if (s.ws.readyState === s.ws.OPEN) s.ws.send(data);
  }
}

// Игрок — только позиция и состояние; моб — ещё HP и агро (для полоски)
function serializeMove(e) {
  const base = {
    id: e.id,
    x: Number(e.x.toFixed(3)),
    y: Number(e.y.toFixed(3)),
    state: e.state,
  };

  if (e.type === "mob") {
    base.type = "mob";
    base.hp = e.hp;
    base.maxHp = e.maxHp;
    base.aggro = e.aggro === true;
  }

  return base;
}

export function getTickCount() {
  return tickCount;
}