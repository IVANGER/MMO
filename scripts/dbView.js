// Показать содержимое БД
// Запуск: node scripts/dbView.js

import { db, all, get } from "../server/db.js";

const tables = all(
  `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
).map(t => t.name);

console.log(`\n📊 Таблиц: ${tables.length}\n`);

for (const t of tables) {
  const count = get(`SELECT COUNT(*) as c FROM ${t}`).c;
  console.log(`  ${t.padEnd(25)} ${count} строк`);
}

console.log("\n📌 Последние 5 юзеров:");
console.table(all(`SELECT id, nickname, created_at FROM users ORDER BY created_at DESC LIMIT 5`));