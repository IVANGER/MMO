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
  WORLD_ENTERED: "worldEntered",
  AUTO_ENTER_WORLD: "autoEnterWorld",
  RESPAWNED: "respawned",
  ONLINE_CHANGE: "onlineChange",

  // Бой
  ATTACK: "attack",
  STOP_ATTACK: "stopAttack",

  // Навыки — слоты 1-4 (День 12)
  USE_SKILL: "useSkill",
  GET_SKILLS: "getSkills",
  SKILL_USED: "skillUsed",
  SKILL_COOLDOWN: "skillCooldown",
  ATTACK_STARTED: "attackStarted",
  ATTACK_CLEARED: "attackCleared",
  XP_GAINED: "xpGained",

  PLAYER_HIT: "playerHit",
  YOU_DIED: "youDied",

  // Сущности
  ENTITY_JOINED: "entityJoined",
  ENTITY_LEFT: "entityLeft",
  ENTITY_MOVED: "entityMoved",

  // Персонаж (запросы клиента)
  CREATE_CHARACTER_MSG: "createCharacter",
  CHARACTERS: "characters",
  CHARACTER_CREATED: "characterCreated",
  CHARACTER_SELECTED: "characterSelected",
  CHARACTER_DELETED: "characterDeleted",

  // Путь
  STOPPED: "stopped",

  // Кик
  AFK_KICK: "afkKick",

  // Лут
  OPEN_LOOT_BAG: "openLootBag",
  TAKE_LOOT_ITEM: "takeLootItem",
  TAKE_ALL_LOOT: "takeAllLoot",
  CLOSE_LOOT_BAG: "closeLootBag",
  DISCARD_LOOT_BAG: "discardLootBag",

  // Инвентарь и хотбар (День 12)
  EQUIP_ITEM: "equipItem",
  UNEQUIP_ITEM: "unequipItem",
  USE_ITEM: "useItem",
  DROP_ITEM: "dropItem",
  GET_INVENTORY: "getInventory",
  GET_HOTBAR: "getHotbar",
  SET_HOTBAR_SLOT: "setHotbarSlot",
  CLEAR_HOTBAR_SLOT: "clearHotbarSlot",

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
  ITEM_USED: "itemUsed",
  ITEM_COOLDOWN: "itemCooldown",
  SKILLS: "skills",
  HOTBAR: "hotbar",
  HOTBAR_UPDATE: "hotbarUpdate",
  CHAT: "chat",
};

export const SCENES = {
  LOGIN: "login",
  CHARACTER: "character",
  WORLD: "world",
};
