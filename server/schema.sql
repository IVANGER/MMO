-- ============================================================
-- HERO CAMP — ПОЛНАЯ СХЕМА БД
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============================================================
-- АККАУНТЫ
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  nickname        TEXT NOT NULL,
  nickname_lower  TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  faction         TEXT,
  created_at      INTEGER NOT NULL,
  last_seen       INTEGER,
  is_banned       INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname_lower);

CREATE TABLE IF NOT EXISTS tokens (
  token       TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id);

CREATE TABLE IF NOT EXISTS profiles (
  user_id                 TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio                     TEXT,
  avatar                  TEXT,
  title                   TEXT,
  show_equipment          INTEGER DEFAULT 1,
  show_stats              INTEGER DEFAULT 1,
  show_online             INTEGER DEFAULT 1,
  allow_friend_requests   INTEGER DEFAULT 1,
  allow_challenges        INTEGER DEFAULT 1,
  updated_at              INTEGER NOT NULL
);

-- ============================================================
-- ПЕРСОНАЖИ
-- ============================================================

CREATE TABLE IF NOT EXISTS characters (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot            INTEGER NOT NULL,
  name            TEXT NOT NULL,
  class           TEXT NOT NULL,
  level           INTEGER DEFAULT 1,
  xp              INTEGER DEFAULT 0,

  hp              INTEGER NOT NULL,
  max_hp          INTEGER NOT NULL,
  mp              INTEGER NOT NULL,
  max_mp          INTEGER NOT NULL,
  atk             INTEGER NOT NULL,
  defense         INTEGER NOT NULL,
  speed           REAL NOT NULL,

  attrs           TEXT,               -- JSON: 10 базовых характеристик (День 9)
  attr_points     INTEGER DEFAULT 0,  -- свободные очки характеристик (День 9)

  gold            INTEGER DEFAULT 0,

  location_id     TEXT,
  x               REAL,
  y               REAL,

  created_at      INTEGER NOT NULL,
  last_online     INTEGER,

  UNIQUE(user_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_location ON characters(location_id);

CREATE TABLE IF NOT EXISTS character_skills (
  character_id    TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  skill_id        TEXT NOT NULL,
  level           INTEGER DEFAULT 1,
  cooldown_until  INTEGER DEFAULT 0,
  PRIMARY KEY (character_id, skill_id)
);

-- ============================================================
-- ПРЕДМЕТЫ
-- ============================================================

CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT REFERENCES characters(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  rarity      TEXT NOT NULL DEFAULT 'common',
  slot        TEXT NOT NULL,
  level       INTEGER DEFAULT 1,
  equipped    INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  data        TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);
CREATE INDEX IF NOT EXISTS idx_items_equipped ON items(owner_id, equipped);

-- ============================================================
-- ЖИВЫЕ СУЩНОСТИ В МИРЕ (тела игроков)
-- ============================================================

CREATE TABLE IF NOT EXISTS world_entities (
  id              TEXT PRIMARY KEY,
  location_id     TEXT NOT NULL,
  x               REAL NOT NULL,
  y               REAL NOT NULL,

  hp              INTEGER,
  max_hp          INTEGER,
  mp              INTEGER,
  max_mp          INTEGER,

  online          INTEGER DEFAULT 1,
  disconnect_at   INTEGER,

  dead            INTEGER DEFAULT 0,
  died_at         INTEGER,
  killed_by       TEXT,

  last_seen       INTEGER NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_entities_location ON world_entities(location_id);
CREATE INDEX IF NOT EXISTS idx_world_entities_online ON world_entities(online);
CREATE INDEX IF NOT EXISTS idx_world_entities_disconnect ON world_entities(disconnect_at);

-- ============================================================
-- МОБЫ
-- ============================================================

CREATE TABLE IF NOT EXISTS mob_states (
  id              TEXT PRIMARY KEY,
  location_id     TEXT NOT NULL,
  type            TEXT NOT NULL,
  x               REAL NOT NULL,
  y               REAL NOT NULL,
  hp              INTEGER NOT NULL,
  max_hp          INTEGER NOT NULL,
  level           INTEGER DEFAULT 1,
  state           TEXT DEFAULT 'idle',
  target_id       TEXT,
  damage_by       TEXT,
  killer_id       TEXT,
  effects         TEXT,
  respawn_at      INTEGER,
  data            TEXT
);

CREATE INDEX IF NOT EXISTS idx_mobs_location ON mob_states(location_id);
CREATE INDEX IF NOT EXISTS idx_mobs_state ON mob_states(location_id, state);

-- ============================================================
-- МИР: РЕГИОНЫ И ЛОКАЦИИ
-- ============================================================

CREATE TABLE IF NOT EXISTS regions (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  grid_width      INTEGER NOT NULL,
  grid_height     INTEGER NOT NULL,
  data            TEXT
);

CREATE TABLE IF NOT EXISTS locations (
  id              TEXT PRIMARY KEY,
  region_id       TEXT REFERENCES regions(id),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL,
  grid_x          INTEGER NOT NULL,
  grid_y          INTEGER NOT NULL,
  connections     TEXT,

  width           INTEGER NOT NULL,
  height          INTEGER NOT NULL,
  tiles           TEXT NOT NULL,
  objects         TEXT,
  spawns          TEXT,

  is_safe         INTEGER DEFAULT 0,
  faction         TEXT,
  owner_type      TEXT,
  owner_id        TEXT,
  updated_at      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_locations_region ON locations(region_id);

-- ============================================================
-- ОБЪЕКТЫ МИРА
-- ============================================================

CREATE TABLE IF NOT EXISTS world_objects (
  id              TEXT PRIMARY KEY,
  location_id     TEXT NOT NULL,
  type            TEXT NOT NULL,
  x               REAL NOT NULL,
  y               REAL NOT NULL,
  state           TEXT,
  data            TEXT
);

CREATE INDEX IF NOT EXISTS idx_objects_location ON world_objects(location_id);

-- ============================================================
-- NPC
-- ============================================================

CREATE TABLE IF NOT EXISTS npcs (
  id              TEXT PRIMARY KEY,
  location_id     TEXT NOT NULL,
  type            TEXT NOT NULL,
  name            TEXT,
  x               REAL NOT NULL,
  y               REAL NOT NULL,
  data            TEXT
);

CREATE INDEX IF NOT EXISTS idx_npcs_location ON npcs(location_id);

-- ============================================================
-- ЛУТ: МЕШОЧКИ
-- ============================================================

CREATE TABLE IF NOT EXISTS loot_bags (
  id              TEXT PRIMARY KEY,
  location_id     TEXT NOT NULL,
  owner_id        TEXT NOT NULL,
  x               REAL NOT NULL,
  y               REAL NOT NULL,
  items           TEXT NOT NULL,
  is_boss         INTEGER DEFAULT 0,
  expires_at      INTEGER NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bags_owner ON loot_bags(owner_id);
CREATE INDEX IF NOT EXISTS idx_bags_location ON loot_bags(location_id);
CREATE INDEX IF NOT EXISTS idx_bags_expires ON loot_bags(expires_at);

-- ============================================================
-- СОЦИАЛЬНОЕ
-- ============================================================

CREATE TABLE IF NOT EXISTS friends (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  accepted_at     INTEGER,
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id, status);

CREATE TABLE IF NOT EXISTS chat_messages (
  id              TEXT PRIMARY KEY,
  channel         TEXT NOT NULL,
  channel_id      TEXT,
  sender_id       TEXT,
  sender_name     TEXT,
  text            TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_channel
  ON chat_messages(channel, channel_id, created_at DESC);

CREATE TABLE IF NOT EXISTS guilds (
  id              TEXT PRIMARY KEY,
  name            TEXT UNIQUE NOT NULL,
  leader_id       TEXT REFERENCES users(id),
  faction         TEXT,
  created_at      INTEGER NOT NULL,
  data            TEXT
);

CREATE TABLE IF NOT EXISTS guild_members (
  guild_id        TEXT REFERENCES guilds(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  joined_at       INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- ============================================================
-- ДОСТИЖЕНИЯ
-- ============================================================

CREATE TABLE IF NOT EXISTS achievements (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  icon            TEXT,
  rarity          TEXT DEFAULT 'common',
  hidden          INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id  TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at     INTEGER NOT NULL,
  progress        INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, achievement_id)
);

-- ============================================================
-- PVP: ВЫЗОВЫ НА БОЙ
-- ============================================================

CREATE TABLE IF NOT EXISTS challenges (
  id              TEXT PRIMARY KEY,
  from_user       TEXT NOT NULL REFERENCES users(id),
  to_user         TEXT NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER,
  resolved_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_challenges_to ON challenges(to_user, status);

-- ============================================================
-- ЛОГ БОЯ
-- ============================================================

CREATE TABLE IF NOT EXISTS combat_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  attacker_id     TEXT,
  target_id       TEXT,
  damage          INTEGER,
  skill           TEXT,
  location_id     TEXT,
  x               REAL,
  y               REAL,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_combat_log_time ON combat_log(created_at DESC);

-- ============================================================
-- РЕЙТИНГИ
-- ============================================================

CREATE TABLE IF NOT EXISTS ratings (
  user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating          INTEGER DEFAULT 1000,
  wins            INTEGER DEFAULT 0,
  losses          INTEGER DEFAULT 0,
  updated_at      INTEGER NOT NULL
);