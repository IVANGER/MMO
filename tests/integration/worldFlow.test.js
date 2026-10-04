// Интеграционный тест Дня 10: реальный сервер —
// вход в мир, статы из характеристик, свободная дальность хода,
// данные окна персонажа (B) и карта региона (M).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { unlinkSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");
const PORT = 8109;
const DB_PATH = join(ROOT, "data", "test_world.db");

let server = null;
let ws = null;
const inbox = [];

function send(obj) {
  ws.send(JSON.stringify(obj));
}

function take(type, predicate = null, timeout = 8000) {
  return new Promise((resolveTake, reject) => {
    const started = Date.now();
    const tick = () => {
      const i = inbox.findIndex((m) => m.type === type && (!predicate || predicate(m)));
      if (i >= 0) return resolveTake(inbox.splice(i, 1)[0]);
      if (Date.now() - started > timeout) {
        return reject(new Error(`timeout: "${type}" (в очереди: ${inbox.map((m) => m.type).join(", ") || "пусто"})`));
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

function connectOnce() {
  return new Promise((resolveConn, rejectConn) => {
    const sock = new WebSocket(`ws://localhost:${PORT}`);
    const timer = setTimeout(() => {
      sock.terminate();
      rejectConn(new Error("connect timeout"));
    }, 1000);
    sock.on("open", () => {
      clearTimeout(timer);
      sock.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") return sock.send(JSON.stringify({ type: "pong" }));
        inbox.push(msg);
      });
      resolveConn(sock);
    });
    sock.on("error", (e) => {
      clearTimeout(timer);
      rejectConn(e);
    });
  });
}

async function connectWithRetry(retries = 50) {
  for (let i = 0; i < retries; i++) {
    try { return await connectOnce(); } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error("сервер не поднялся");
}

before(async () => {
  // Чистая тестовая БД
  for (const f of [DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) {
    try { if (existsSync(f)) unlinkSync(f); } catch {}
  }

  server = spawn(process.execPath, ["server/index.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), DB_PATH, LOG_LEVEL: "error" },
    stdio: "ignore",
  });

  ws = await connectWithRetry();
});

after(() => {
  try { ws?.close(); } catch {}
  try { server?.kill(); } catch {}
  // Даём процессу освободить БД и удаляем тестовые файлы
  const t0 = Date.now();
  const waitRelease = setInterval(() => {
    const dead = server?.exitCode !== null && server?.exitCode !== undefined;
    if (dead || Date.now() - t0 > 2000) {
      clearInterval(waitRelease);
      for (const f of [DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) {
        try { if (existsSync(f)) unlinkSync(f); } catch {}
      }
    }
  }, 100);
});

let you = null;            // результат worldEntered
let locationInfo = null;   // данные локации из worldEntered

test("регистрация → персонаж → вход в мир", async () => {
  const nick = "it" + Math.floor(Math.random() * 1e6);
  send({ type: "register", nickname: nick, password: "secret123" });
  const reg = await take("ok", (m) => m.action === "registered");
  assert.ok(reg.token, "токен выдан");

  send({
    type: "createCharacter",
    slot: 0,
    name: "Интегр" + Math.floor(Math.random() * 1e4),
    class: "warrior",
  });
  const cc = await take("characterCreated");
  assert.ok(cc.character.id, "персонаж создан");

  send({ type: "enterWorld", characterId: cc.character.id });
  const we = await take("worldEntered");
  you = we.you;
  locationInfo = we.location;

  assert.equal(we.location.id, "forest_1");
  assert.equal(you.x, 5);
  assert.equal(you.y, 7);
});

test("статы персонажа из характеристик (День 9 + День 13)", () => {
  assert.equal(you.maxHp, 136, "HP воина 136");
  // День 13: у воина ресурс — ЭНЕРГИЯ (30 + VIT×4 + STR = 30+28+8 = 66), не мана
  assert.equal(you.maxMp, 66, "энергия воина 66");
  assert.equal(you.resource, "energy", "ресурс воина — энергия");
  assert.equal(you.resourceName, "Энергия");
  assert.equal(you.attackRange, 1, "радиус атаки воина 1");
  assert.equal(you.atk, 18, "атака 18");
  assert.equal(you.defense, 14, "защита 14");
  assert.equal(you.speed, 2.0, "скорость 2.0 кл/сек");
  assert.equal(you.moveRange, 3, "дальность хода 3");
});

test("moveTo дальше moveRange → pathFound (дальность НЕ ограничивает)", async () => {
  // День 10: ограничение дальности хода убрано — идём куда угодно
  send({ type: "moveTo", x: 14, y: 7 });
  const pf = await take("pathFound", null, 5000);
  assert.ok(pf.path.length > 3, `путь длиннее дальности (${pf.path.length} шагов)`);
  assert.equal(pf.x, 14);
  assert.equal(pf.y, 7);
});

test("moveTo в пределах дальности → pathFound", async () => {
  send({ type: "moveTo", x: 7, y: 7 });
  const pf = await take("pathFound");
  assert.ok(pf.path.length > 0, "путь не пуст");
});

// ============ День 10: данные персонажа для окна B / полосы опыта ============

test("you содержит XP, характеристики и имя класса (окно персонажа)", () => {
  assert.equal(you.level, 1);
  assert.equal(you.xp, 0, "XP = 0 на 1 уровне");
  assert.equal(you.xpToNext, 100, "до 2 уровня 100 XP");
  assert.ok(you.attrs, "характеристики переданы");
  assert.equal(you.attrs.STR, 8, "STR воина");
  assert.equal(you.attrs.AGI, 5, "AGI воина");
  assert.equal(you.attrPoints, 0, "свободных очков 0");
  assert.ok(you.className, "имя класса передано");
});

test("локация содержит карту региона (окно карты мира, M)", () => {
  const region = locationInfo.region;
  assert.ok(region, "карта региона передана");
  assert.equal(region.id, "region_forest");
  assert.equal(region.gridWidth, 3);
  assert.equal(region.gridHeight, 3);
  assert.equal(region.locations.length, 2, "2 района");

  const f1 = region.locations.find((l) => l.id === "forest_1");
  const f2 = region.locations.find((l) => l.id === "forest_2");

  // Правильное взаимное расположение: forest_1 западнее forest_2
  assert.equal(f1.gridX, 0);
  assert.equal(f1.gridY, 0);
  assert.equal(f2.gridX, 1);
  assert.equal(f2.gridY, 0);
  assert.equal(f2.connections.west, "forest_1", "связь forest_2 → forest_1");
  assert.equal(f1.connections.east, "forest_2", "связь forest_1 → forest_2");
});

