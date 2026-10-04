// SQLite: подключение, миграции, хелперы

import Database from "better-sqlite3";
import { readFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { CONFIG } from "./config.js";
import { logger } from "./log.js";
import { getClass } from "./content/classes.js";
import { attrsAtLevel } from "../shared/attributes.js";
import { calcAll } from "../shared/derivedStats.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Создаём папку data/, если её нет
const dataDir = dirname(CONFIG.DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Открываем БД
export const db = new Database(CONFIG.DB_PATH);

// Настройки производительности
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");

// ============ Миграции ============

export function runMigrations() {
  const schemaPath = join(__dirname, "schema.sql");
  const sql = readFileSync(schemaPath, "utf8");

  try {
    db.exec(sql);
    ensureColumns();
    backfillAttributes();
    logger.info("Database schema applied");
  } catch (err) {
    logger.error("Failed to apply schema", err.message);
    throw err;
  }
}

// Колонки, добавляемые в уже существующие таблицы (IF NOT EXISTS не работает для колонок)
function ensureColumns() {
  const cols = db.prepare(`PRAGMA table_info(characters)`).all().map((c) => c.name);

  if (!cols.includes("attrs")) {
    db.exec(`ALTER TABLE characters ADD COLUMN attrs TEXT`);
    logger.info("Migration: characters.attrs added");
  }
  if (!cols.includes("attr_points")) {
    db.exec(`ALTER TABLE characters ADD COLUMN attr_points INTEGER DEFAULT 0`);
    logger.info("Migration: characters.attr_points added");
  }
}

// Backfill: персонажи без attrs получают характеристики класса + рост по уровню,
// вторичные статы пересчитываются (День 9)
function backfillAttributes() {
  const rows = db
    .prepare(`SELECT id, class, level, hp, mp FROM characters WHERE attrs IS NULL OR attrs = ''`)
    .all();
  if (rows.length === 0) return;

  const stmt = db.prepare(
    `UPDATE characters
     SET attrs = ?, max_hp = ?, max_mp = ?, atk = ?, defense = ?, speed = ?,
         hp = ?, mp = ?
     WHERE id = ?`
  );

  const apply = db.transaction((list) => {
    for (const row of list) {
      const cls = getClass(row.class);
      if (!cls?.baseAttributes) continue;

      const attrs = attrsAtLevel(cls.baseAttributes, cls.growthPerLevel, row.level);
      const d = calcAll(attrs);

      stmt.run(
        JSON.stringify(attrs),
        d.hp, d.mp, d.meleeDamage, d.defense, d.moveSpeed,
        Math.min(row.hp, d.hp),
        Math.min(row.mp, d.mp),
        row.id
      );
    }
  });
  apply(rows);

  logger.info(`Backfilled attrs for ${rows.length} character(s)`);
}

// ============ Хелперы ============

export function tx(fn) {
  return db.transaction(fn);
}

export function get(sql, ...params) {
  return db.prepare(sql).get(...params);
}

export function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

export function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

// ============ Бэкап ============

export function backup() {
  const backupDir = join(dirname(CONFIG.DB_PATH), "backups");
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupDir, `game-${stamp}.db`);

  try {
    copyFileSync(CONFIG.DB_PATH, backupPath);
    logger.info(`Backup created: ${backupPath}`);
    return backupPath;
  } catch (err) {
    logger.error("Backup failed", err.message);
    throw err;
  }
}

// ============ Закрытие ============

export function closeDb() {
  db.close();
  logger.info("Database closed");
}