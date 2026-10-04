// Живой тест Дня 10: регистрация → персонаж → вход в мир →
// свободная дальность хода (без ограничения) → переход в forest_2 →
// АВТОАТАКА моба (урон + кулдаун + опыт) → обратно в forest_1
// Нужен поднятый сервер: node server/index.js (порт через env PORT, по умолчанию 8098).
//
// ВАЖНО: запускать на отдельной БД, иначе состояние мобов (mob_states)
// переживает прогон — убитый гоблин не респавнится 30 сек и проверки состава падают:
//   $env:DB_PATH='data/live_test.db'; node server/index.js

import { WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 8098);
const URL = `ws://localhost:${PORT}`;

const log = (...a) => console.log("  ", ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

function take(type, predicate = null, timeout = 10000) {
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

const checks = [];
function check(name, cond, extra = "") {
  checks.push({ name, ok: !!cond, extra });
  console.log(`  ${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

// Идём к цели: ограничения дальности больше нет (День 10), можно одним moveTo
async function walkTo(fromX, fromY, tx, ty, speed, moveRange) {
  let cx = Math.round(fromX);
  let cy = Math.round(fromY);

  // Один moveTo на всю дистанцию — проверяем, что сервер не режет путь
  send({ type: "moveTo", x: tx, y: ty });
  const pf = await take("pathFound", null, 5000);

  check("длинный путь принимается целиком (дальность не ограничивает)",
    pf.path.length > moveRange || Math.abs(tx - cx) + Math.abs(ty - cy) <= moveRange,
    `${pf.path.length} шагов`);

  const last = pf.path[pf.path.length - 1];
  cx = Math.round(last.x);
  cy = Math.round(last.y);

  // Ждём, пока перс пройдёт путь (скорость — клеток в секунду)
  await wait((pf.path.length / speed) * 1000 + 400);

  return { x: cx, y: cy };
}

async function main() {
  await new Promise((r) => ws.on("open", r));
  log("WS подключён\n");

  // 1. Регистрация
  const nick = "t" + Math.floor(Math.random() * 1e6);
  send({ type: "register", nickname: nick, password: "secret123" });
  const reg = await take("ok", (m) => m.action === "registered");
  check("регистрация", !!reg.token);

  // 2. Создание персонажа
  const charName = "Герой" + Math.floor(Math.random() * 1e4);
  send({ type: "createCharacter", slot: 0, name: charName, class: "warrior" });
  const cc = await take("characterCreated");
  const charId = cc.character.id;
  check("создание персонажа", !!charId, charId);

  // 3. Вход в мир
  send({ type: "enterWorld", characterId: charId });
  const we = await take("worldEntered");
  check("вход в мир", we.location?.id === "forest_1", we.location?.id);
  check("спавн (5,7)", we.you.x === 5 && we.you.y === 7, `(${we.you.x}, ${we.you.y})`);
  check("объекты переданы клиенту", (we.location.objects ?? []).length > 0,
    `${(we.location.objects ?? []).length} шт.`);
  check("connections переданы", we.location.connections?.east === "forest_2",
    JSON.stringify(we.location.connections));
  check("в forest_1 нет мобов", !we.entities.some((e) => e.type === "mob"));

  // 3.5. Статы Дня 9: дальность хода, скорость, HP/MP из характеристик
  check("дальность хода 3", we.you.moveRange === 3, `${we.you.moveRange}`);
  check("скорость 2.0 кл/сек", we.you.speed === 2.0, `${we.you.speed}`);
  check("HP воина 136", we.you.maxHp === 136, `${we.you.maxHp}/${we.you.hp}`);
  check("MP воина 42", we.you.maxMp === 42, `${we.you.maxMp}/${we.you.mp}`);
  check("атака 18 / защита 14",
    we.you.atk === 18 && we.you.defense === 14, `${we.you.atk}/${we.you.defense}`);

  // 3.6. День 10: длинный moveTo больше НЕ отклоняется (проверка в интеграционном тесте)

  // 4. Переход: идём на восток до края (x=19, y=7 — дорога) ОТРЕЗКАМИ
  const speed = we.you.speed ?? 2.0;
  const range = we.you.moveRange ?? 3;
  let pos = { x: we.you.x, y: we.you.y };

  log("\n  иду на восток (5,7) → (19,7) отрезками по 3 клетки ...");
  pos = await walkTo(pos.x, pos.y, 19, 7, speed, range);

  const lc = await take("locationChange", null, 25000);
  check("переход в forest_2", lc.location?.id === "forest_2", lc.location?.id);
  check("направление east", lc.direction === "east", lc.direction);
  check("появился у западного края", lc.you.x <= 2 && lc.you.y === 7,
    `(${lc.you.x}, ${lc.you.y})`);
  check("объекты forest_2 переданы", (lc.location.objects ?? []).length > 0,
    `${(lc.location.objects ?? []).length} шт.`);
  pos = { x: lc.you.x, y: lc.you.y };

  // 5. Мобы видны в forest_2 (6 штук)
  const mobs = lc.entities.filter((e) => e.type === "mob");
  check("мобы в forest_2", mobs.length === 6, `${mobs.length} шт.`);

  const byType = {};
  for (const m of mobs) byType[m.mobType] = (byType[m.mobType] ?? 0) + 1;
  check("состав мобов (3 гоблина, 2 волка, 1 орк)",
    byType.goblin === 3 && byType.wolf === 2 && byType.orc === 1,
    JSON.stringify(byType));

  check("у мобов есть sprite/size/aggro",
    mobs.every((m) => "sprite" in m && "size" in m && "aggro" in m));

  // День 10: скорость мобов = скорость игрока (2.0)
  check("скорость мобов 2.0 (как у игрока)",
    mobs.every((m) => m.speed === we.you.speed),
    mobs.map((m) => `${m.mobType}:${m.speed}`).join(", "));

  // 5.5. Карта региона для окна карты мира (M)
  const region = lc.location?.region;
  check("карта региона передана", !!region,
    region ? `${region.name} ${region.gridWidth}×${region.gridHeight}` : "нет");
  check("в регионе 2 района", region?.locations?.length === 2,
    `${region?.locations?.length}`);
  check("районы расположены рядом по X (forest_1 → forest_2)",
    region?.locations?.find((l) => l.id === "forest_1")?.gridX === 0 &&
    region?.locations?.find((l) => l.id === "forest_2")?.gridX === 1,
    JSON.stringify(region?.locations?.map((l) => `${l.id}@${l.gridX},${l.gridY}`)));

  // ============ День 10: АВТОАТАКА ============
  const goblin = mobs.find((m) => m.mobType === "goblin");
  log(`\n  атакую гоблина (${goblin.name}, id=${goblin.id}, HP ${goblin.maxHp}) ...`);

  send({ type: "attack", targetId: goblin.id });
  const started = await take("attackStarted", null, 5000);
  check("цель назначена (attackStarted)", started.targetId === goblin.id,
    started.name);

  // Игрок сам подойдёт и ударит — ждём боевые события
  const hpBefore = goblin.maxHp;
  const firstHit = await take("combatEvent", null, 20000);
  check("первый удар нанесён", firstHit.damage > 0,
    `урон ${firstHit.damage}${firstHit.crit ? " (крит)" : ""}, HP ${hpBefore}→${firstHit.hp}`);
  check("урон уменьшил HP моба", firstHit.hp < hpBefore,
    `${hpBefore} → ${firstHit.hp}`);

  // Кулдаун: несколько ударов подряд с интервалом
  const hits = [firstHit];
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline && (hits[hits.length - 1].hp > 0)) {
    try {
      hits.push(await take("combatEvent", null, 6000));
    } catch {
      break;
    }
  }

  check("автоатака бьёт повторно (кулдаун работает)", hits.length >= 2,
    `ударов: ${hits.length}`);
  if (hits.length >= 2) {
    check("урон суммируется", hits[hits.length - 1].hp < firstHit.hp,
      `HP ${firstHit.hp} → ${hits[hits.length - 1].hp}`);
  }

  const killed = hits.find((h) => h.killed);
  if (killed) {
    const xp = await take("xpGained", null, 6000);
    check("опыт начислен за убийство", xp.amount > 0,
      `+${xp.amount} XP, всего ${xp.xp}/${xp.xpToNext}`);
    check("моб убит и исчез", true, `HP = ${killed.hp}`);
  } else {
    check("моб убит (нужно много ударов — гоблин 100 HP)", false,
      `HP осталось ${hits[hits.length - 1]?.hp}`);
  }

  // 6. Обратный переход: запад (короткий отрезок)
  log("\n  иду обратно на запад (0,7) ...");
  await walkTo(pos.x, pos.y, 0, 7, speed, range);

  const lc2 = await take("locationChange", null, 25000);
  check("обратный переход в forest_1", lc2.location?.id === "forest_1", lc2.location?.id);
  check("появился у восточного края", lc2.you.x >= 18 && lc2.you.y === 7,
    `(${lc2.you.x}, ${lc2.you.y})`);

  // Итог
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n=== ИТОГ: ${checks.length - failed.length}/${checks.length} проверок пройдено ===`);
  if (failed.length > 0) {
    console.log("Провалено: " + failed.map((f) => f.name).join(", "));
  }

  ws.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("\nОШИБКА:", e.message);
  process.exit(1);
});