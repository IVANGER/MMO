// Протокол WebSocket: типы сообщений клиент ↔ сервер

export const MSG = {
  // Auth
  REGISTER: "register",
  LOGIN: "login",
  LOGOUT: "logout",

  // Персонаж
  CREATE_CHARACTER: "createCharacter",
  GET_CHARACTER: "getCharacter",

  // Мир
  ENTER_WORLD: "enterWorld",
  MOVE_TO: "moveTo",
  STOP_MOVE: "stopMove",
  CHANGE_LOCATION: "changeLocation",

  // Бой
  ATTACK: "attack",
  USE_SKILL: "useSkill",

  // Лут
  OPEN_LOOT_BAG: "openLootBag",
  TAKE_LOOT_ITEM: "takeLootItem",
  TAKE_ALL_LOOT: "takeAllLoot",
  CLOSE_LOOT_BAG: "closeLootBag",
  DISCARD_LOOT_BAG: "discardLootBag",

  // Инвентарь
  EQUIP_ITEM: "equipItem",
  UNEQUIP_ITEM: "unequipItem",
  USE_ITEM: "useItem",
  DROP_ITEM: "dropItem",

  // Города
  BUY_ITEM: "buyItem",
  SELL_ITEM: "sellItem",

  // Сервер → клиент
  OK: "ok",
  ERROR: "error",
  AUTH_OK: "authOk",
  CHARACTER: "character",
  WORLD_STATE: "worldState",
  WORLD_UPDATE: "worldUpdate",
  PATH_FOUND: "pathFound",
  PATH_NOT_FOUND: "pathNotFound",
  LOCATION_CHANGE: "locationChange",
  COMBAT_EVENT: "combatEvent",
  ENTITY_DIED: "entityDied",
  ENTITY_SPAWNED: "entitySpawned",
  ENTITY_DESPAWNED: "entityDespawned",
  LOOT_BAG_SPAWNED: "lootBagSpawned",
  LOOT_BAG_OPENED: "lootBagOpened",
  LOOT_BAG_UPDATED: "lootBagUpdated",
  LOOT_BAG_EMPTIED: "lootBagEmptied",
  LOOT_BAG_DESPAWNED: "lootBagDespawned",
  LOOT_ITEM_TAKEN: "lootItemTaken",
  GOLD_GAINED: "goldGained",
  INVENTORY: "inventory",
  CHAT: "chat",
};

export const SCENES = {
  LOGIN: "login",
  CHARACTER: "character",
  WORLD: "world",
};
