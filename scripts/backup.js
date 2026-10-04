// Ручной бэкап БД
// Запуск: npm run backup

import { backup, closeDb } from "../server/db.js";

try {
  const path = backup();
  console.log(`✅ Бэкап создан: ${path}`);
} catch (err) {
  console.error(`❌ Ошибка: ${err.message}`);
  process.exit(1);
} finally {
  closeDb();
}