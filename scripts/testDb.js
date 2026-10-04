// Проверка БД: создать → найти → изменить → удалить
// Запуск: node scripts/testDb.js

import { db, runMigrations, get, all, run } from "../server/db.js";
import { newUserId, newToken } from "../server/ids.js";
import { createRng, randomInt } from "../server/rng.js";

console.log("=== ТЕСТ БД ===\n");

// 1. Миграции
runMigrations();

// 2. Создаём пользователя
const userId = newUserId();
const nickname = "TestHero_" + Math.floor(Math.random() * 10000);

run(
  `INSERT INTO users (id, nickname, nickname_lower, password_hash, created_at)
   VALUES (?, ?, ?, ?, ?)`,
  userId, nickname, nickname.toLowerCase(), "fake_hash", Date.now()
);
console.log(`✅ Создан пользователь: ${nickname} (${userId})`);

// 3. Находим по ID
const found = get(`SELECT * FROM users WHERE id = ?`, userId);
console.log(`✅ Найден по ID:`, found.nickname);
console.log(`   nickname_lower: ${found.nickname_lower}`);

// 4. Обновляем
run(`UPDATE users SET last_seen = ? WHERE id = ?`, Date.now(), userId);
const updated = get(`SELECT last_seen FROM users WHERE id = ?`, userId);
console.log(`✅ Обновлён last_seen: ${updated.last_seen}`);

// 5. Создаём токен
const token = newToken();
run(
  `INSERT INTO tokens (token, user_id, created_at, expires_at)
   VALUES (?, ?, ?, ?)`,
  token, userId, Date.now(), Date.now() + 30 * 24 * 60 * 60 * 1000
);
console.log(`✅ Создан токен: ${token.slice(0, 12)}...`);

// 6. Считаем пользователей
const count = get(`SELECT COUNT(*) as c FROM users`).c;
console.log(`✅ Всего пользователей в БД: ${count}`);

// 7. Проверяем RNG
const rng = createRng(42);
console.log(`✅ RNG(42): ${rng().toFixed(4)}, ${rng().toFixed(4)}, ${rng().toFixed(4)}`);
console.log(`✅ randomInt(1,100): ${randomInt(rng, 1, 100)}`);

// 8. Удаляем (CASCADE удалит токен)
run(`DELETE FROM users WHERE id = ?`, userId);
const afterDelete = get(`SELECT * FROM users WHERE id = ?`, userId);
const tokenAfter = get(`SELECT * FROM tokens WHERE token = ?`, token);
console.log(`✅ Удалён: ${afterDelete ? "НЕТ" : "да"}`);
console.log(`✅ Токен удалён каскадом: ${tokenAfter ? "НЕТ" : "да"}`);

// 9. Список всех таблиц
const tables = all(
  `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
).map(t => t.name);
console.log(`\n📋 Таблиц в БД: ${tables.length}`);
console.log(tables.join(", "));

console.log("\n=== ГОТОВО ===");