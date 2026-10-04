// Живой тест ИИ мобов: вход в forest_2 → наблюдение за entityMoved и агро
// Нужен поднятый сервер: node scripts/liveMobs.js
// Порт задаётся через env PORT (по умолчанию 8098)

import { WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 8098);
const URL = `ws://localhost:${PORT}`;

const inbox = [];
const ws = new WebSocket(URL);

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "ping") return ws.send(JSON.stringify({ type: "pong" }));
  inbox.push(msg);
});

function send(obj) {
  ws.send(JSON.stringify(obj));
}

function take(type, predicate = null, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const i = inbox.findIndex((m) => m.type === type && (!predicate || predicate(m)));
      if (i >= 0) return resolve(inbox.splice(i, 1)[0]);
      if (Date.now() - started > timeout) {
        return reject(new Error(`timeout: "${type}" (в очереди: ${inbox.map((m) => m.type).join(", ") || "пусто"})`));
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function main() {
  await new Promise((r) => ws.on("open", r));

  const nick = "m" + Math.floor(Math.random() * 1e6);
  send({ type: "register", nickname: nick, password: "secret123" });
  await take("ok", (m) => m.action === "registered");

  send({ type: "createCharacter", slot: 0, name: "Моб" + Math.floor(Math.random() * 1e4), class: "warrior" });
  const cc = await take("characterCreated");

  send({ type: "enterWorld", characterId: cc.character.id });
  await take("worldEntered");

  // Переходим в forest_2
  send({ type: "moveTo", x: 19, y: 7 });
  const lc = await take("locationChange", null, 25000);
  console.log("В forest_2, мобов:", lc.entities.filter((e) => e.type === "mob").length);

  const mobIds = new Set(lc.entities.filter((e) => e.type === "mob").map((e) => e.id));
  const seen = new Map();   // mobId → кол-во обновлений
  const aggro = new Set();

  // Слушаем 12 секунд
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    await new Promise((r) => setTimeout(r, 200));
    const idx = inbox.findIndex((m) => m.type === "entityMoved");
    if (idx < 0) continue;

    const msg = inbox.splice(idx, 1)[0];
    for (const u of msg.entities) {
      if (!mobIds.has(u.id)) continue;
      seen.set(u.id, (seen.get(u.id) ?? 0) + 1);
      if (u.aggro) aggro.add(u.id);
    }
  }

  const moving = [...seen.entries()].filter(([, n]) => n > 3);
  console.log(`\nМобов получали апдейты: ${seen.size}/${mobIds.size}`);
  console.log(`Из них двигались (>3 апдейтов): ${moving.length}`);
  console.log(`В агро: ${aggro.size}`);

  const ok = seen.size > 0 && moving.length > 0;
  console.log(`\n=== ИТОГ: ${ok ? "ИИ мобов работает" : "МОБЫ НЕ ДВИГАЮТСЯ"} ===`);

  // ============ Фаза 2: агро и преследование ============
  // Гоблин спавнится в (8,10) с агро 4 → подходим к клетке (8,11) рядом с ним
  console.log("\nИду к гоблину (8,11) — проверяю агро ...");
  inbox.length = 0;
  send({ type: "moveTo", x: 8, y: 11 });

  await new Promise((r) => setTimeout(r, 400));
  const badPath = inbox.find((m) => m.type === "pathNotFound");
  if (badPath) console.log(`  (путь не найден: ${badPath.x},${badPath.y})`);
  const okPath = inbox.find((m) => m.type === "pathFound");
  if (okPath) console.log(`  путь найден: ${okPath.path.length} шагов`);
  inbox.length = 0;

  let aggroMob = null;
  let chased = false;
  const t1 = Date.now();
  while (Date.now() - t1 < 20000) {
    await new Promise((r) => setTimeout(r, 150));
    const idx = inbox.findIndex((m) => m.type === "entityMoved");
    if (idx < 0) continue;

    const msg = inbox.splice(idx, 1)[0];
    for (const u of msg.entities) {
      if (!mobIds.has(u.id)) continue;
      if (u.aggro) aggroMob = u;
    }
    if (aggroMob) chased = true;
  }

  if (aggroMob) {
    console.log(`Агро получено! HP моба: ${aggroMob.hp}/${aggroMob.maxHp}, aggro=${aggroMob.aggro}`);
    console.log("Клиент получил hp/maxHp/aggro → нарисует красную полоску");
  } else {
    console.log("Агро НЕ получено за 20 секунд");
  }

  console.log(`\n=== ФИНАЛ: ${ok && !!aggroMob ? "ВСЁ РАБОТАЕТ" : "ЕСТЬ ПРОБЛЕМЫ"} ===`);

  ws.close();
  process.exit(ok && aggroMob ? 0 : 1);
}

main().catch((e) => {
  console.error("ОШИБКА:", e.message);
  process.exit(1);
});