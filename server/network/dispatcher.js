// Роутинг сообщений в handlers

import { logger } from "../log.js";
import {
  handleRegister,
  handleLogin,
  handleResume,
  handleLogout,
} from "../api/authHandlers.js";
import {
  handleGetCharacters,
  handleCreateCharacter,
  handleDeleteCharacter,
  handleSelectCharacter,
} from "../api/characterHandlers.js";
import {
  handleEnterWorld,
  handleMoveTo,
  handleStopMove,
  handleRespawn,
} from "../api/worldHandlers.js";
import { handleAttack, handleStopAttack } from "../api/combatHandlers.js";
import {
  handleGetInventory,
  handleUseItem,
  handleGetHotbar,
  handleSetHotbarSlot,
  handleClearHotbarSlot,
} from "../api/inventoryHandlers.js";
import { handleGetSkills, handleUseSkill } from "../api/skillHandlers.js";
import { getSession, updateActivity } from "./sessions.js";

const PUBLIC = new Set(["register", "login", "resume", "pong", "hello"]);

const ROUTES = {
  register: handleRegister,
  login: handleLogin,
  resume: handleResume,
  logout: handleLogout,

  getCharacters: handleGetCharacters,
  createCharacter: handleCreateCharacter,
  deleteCharacter: handleDeleteCharacter,
  selectCharacter: handleSelectCharacter,

  enterWorld: handleEnterWorld,
  moveTo: handleMoveTo,
  stopMove: handleStopMove,
  respawn: handleRespawn,

  attack: handleAttack,
  stopAttack: handleStopAttack,

  // Навыки 1-4 (День 12)
  getSkills: handleGetSkills,
  useSkill: handleUseSkill,

  // Инвентарь и хотбар (День 12)
  getInventory: handleGetInventory,
  useItem: handleUseItem,
  getHotbar: handleGetHotbar,
  setHotbarSlot: handleSetHotbarSlot,
  clearHotbarSlot: handleClearHotbarSlot,
};

export function dispatch(ws, msg) {
  if (!msg || typeof msg.type !== "string") {
    return logger.warn(`Bad message from #${ws.clientId}`);
  }

  const { type } = msg;
  if (type === "pong") return;

  if (type === "hello") {
    ws.send(JSON.stringify({ type: "helloAck", at: Date.now() }));
    return;
  }

  const handler = ROUTES[type];
  if (!handler) {
    logger.warn(`No handler for "${type}" from #${ws.clientId}`);
    return ws.send(JSON.stringify({ type: "error", message: `Unknown: ${type}` }));
  }

  if (!PUBLIC.has(type) && !getSession(ws)) {
    logger.warn(`Unauthorized "${type}" from #${ws.clientId}`);
    return ws.send(JSON.stringify({ type: "error", message: "Не авторизован" }));
  }

  // Обновляем lastActivity
  updateActivity(ws);

  try {
    handler(ws, msg);
  } catch (err) {
    logger.error(`Handler "${type}" failed`, err.stack);
    try {
      ws.send(JSON.stringify({ type: "error", message: "Внутренняя ошибка" }));
    } catch {}
  }
}