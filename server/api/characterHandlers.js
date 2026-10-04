// Обработчики персонажей

import {
  getCharacters,
  createCharacter,
  deleteCharacter,
  getCharacter,
  MAX_CHARACTER_SLOTS,
} from "../character/create.js";
import { getSession } from "../network/sessions.js";
import { getAllClasses } from "../content/classes.js";
import { logger } from "../log.js";

function reply(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function err(ws, message) {
  reply(ws, { type: "error", message, action: "character" });
}

// ============ Список персонажей ============

export function handleGetCharacters(ws) {
  const session = getSession(ws);
  if (!session) return err(ws, "Не авторизован");

  const slots = getCharacters(session.user.id);

  reply(ws, {
    type: "characters",
    slots,
    maxSlots: MAX_CHARACTER_SLOTS,
    classes: getAllClasses().map(c => ({
      type: c.type,
      name: c.name,
      icon: c.icon,
      description: c.description,
      baseStats: c.baseStats,
    })),
  });
}

// ============ Создание ============

export function handleCreateCharacter(ws, msg) {
  const session = getSession(ws);
  if (!session) return err(ws, "Не авторизован");

  const { slot, name, class: classType } = msg;

  const result = createCharacter(session.user.id, slot, name, classType);
  if (result.error) return err(ws, result.error);

  logger.info(`Created character "${result.character.name}" for ${session.user.nickname}`);

  reply(ws, {
    type: "characterCreated",
    character: result.character,
  });

  // И сразу отдаём обновлённый список слотов
  handleGetCharacters(ws);
}

// ============ Удаление ============

export function handleDeleteCharacter(ws, msg) {
  const session = getSession(ws);
  if (!session) return err(ws, "Не авторизован");

  const result = deleteCharacter(session.user.id, msg.characterId);
  if (result.error) return err(ws, result.error);

  reply(ws, {
    type: "characterDeleted",
    characterId: msg.characterId,
  });

  handleGetCharacters(ws);
}

// ============ Выбор (вход в мир — пока заглушка) ============

export function handleSelectCharacter(ws, msg) {
  const session = getSession(ws);
  if (!session) return err(ws, "Не авторизован");

  const character = getCharacter(session.user.id, msg.characterId);
  if (!character) return err(ws, "Персонаж не найден");

  session.characterId = character.id;

  reply(ws, {
    type: "characterSelected",
    character,
  });

  logger.info(`Selected character "${character.name}" by ${session.user.nickname}`);
}