// Обработчики боя: attack (автоатака по цели), stopAttack
// День 10: игрок кликает по мобу — сервер держит цель и бьёт сам.

import { getSession } from "../network/sessions.js";
import { getLoadedLocation } from "../world/loadManager.js";
import { clearTarget } from "../world/combat.js";
import { logger } from "../log.js";

function reply(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

/**
 * Клик по мобу: назначаем цель и сразу бьём, если игрок уже вплотную.
 * Если далеко — тик-цикл доведёт игрока до цели сам (updatePlayerCombat).
 */
export function handleAttack(ws, msg) {
  const session = getSession(ws);
  if (!session || !session.locationId) return;

  const loc = getLoadedLocation(session.locationId);
  if (!loc) return;

  const entity = loc.entities.get(session.characterId);
  if (!entity || entity.type !== "player" || entity.dead) return;

  const targetId = msg.targetId ?? msg.mobId;
  const mob = targetId ? loc.entities.get(targetId) : null;

  // Клик по пустому месту / не по мобу — снимаем цель
  if (!mob || mob.type !== "mob" || mob.aiState === "dead") {
    clearTarget(entity);
    reply(ws, { type: "attackCleared" });
    return;
  }

  entity.targetId = mob.id;
  logger.debug(`Player ${entity.name} targets ${mob.name}`);

  // Ответ клиенту: за кем бьём (для подсветки цели)
  reply(ws, { type: "attackStarted", targetId: mob.id, name: mob.name });
}

/** Явная отмена атаки (Esc / клик по земле) */
export function handleStopAttack(ws) {
  const session = getSession(ws);
  if (!session || !session.locationId) return;

  const loc = getLoadedLocation(session.locationId);
  if (!loc) return;

  const entity = loc.entities.get(session.characterId);
  if (!entity) return;

  clearTarget(entity);
  reply(ws, { type: "attackCleared" });
}
