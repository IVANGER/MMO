// Движение сущностей по пути
// День 13: учитываем замедление (frost_nova) — множитель скорости

import { logger } from "../log.js";
import { speedMultiplier } from "./combat.js";

/**
 * Обновляем всех движущихся сущностей в локации.
 * @param {object} loc — runtime локации
 * @param {number} dt — время с прошлого тика (сек)
 */
export function updateMovements(loc, dt) {
  const changed = [];

  for (const entity of loc.entities.values()) {
    // Мёртвые мобы не двигаются
    if (entity.type === "mob" && entity.aiState === "dead") continue;

    if (!entity.path || entity.path.length === 0) {
      if (entity.state === "moving") {
        entity.state = "idle";
        changed.push(entity);
      }
      continue;
    }

    // Сколько клеток мы должны пройти за dt (с учётом замедления — День 13)
    const now = Date.now();
    const moveDistance = entity.speed * dt * speedMultiplier(entity, now);

    let remaining = moveDistance;

    while (remaining > 0 && entity.path.length > 0) {
      const next = entity.path[0];

      // Текущая позиция — целые + прогресс
      const curX = entity.x;
      const curY = entity.y;

      // Расстояние до следующей клетки (по манхэттену)
      const dx = next.x - curX;
      const dy = next.y - curY;
      const dist = Math.abs(dx) + Math.abs(dy);

      if (dist <= remaining) {
        // Дошли до следующей клетки
        entity.x = next.x;
        entity.y = next.y;
        entity.path.shift();
        remaining -= dist;

        if (entity.path.length > 0) {
          entity.state = "moving";
        } else {
          entity.state = "idle";
          entity.justArrived = true;   // одноразовый флаг — для переходов между локациями
        }
      } else {
        // Двигаемся частично
        const step = remaining / dist;
        entity.x = curX + dx * step;
        entity.y = curY + dy * step;
        remaining = 0;
      }
    }

    changed.push(entity);
  }

  return changed;
}