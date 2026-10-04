// Живой тест Дня 11: МОБЫ АТАКУЮТ ИГРОКОВ
//   1. Вход в мир → переход в forest_2
//   2. Убийство гоблина (+XP) — и замер КУЛДАУНА моба по меткам playerHit
//   3. Пассивный ВОЛК после удара (provoked) — бьёт в ответ
//   4. Агрессивный ОРК бьёт: урон = max(1, atk − defense)
//   5. Смерть игрока → entityLeft + youDied
//   6. Респавн → forest_1, HP = 1, минус 10% XP
//
// Нужен поднятый сервер. Запускать на СВЕЖЕЙ БД (иначе мобы/персонажи живут между прогонами):
//   $env:DB_PATH='data/live_d11.db'; $env:PORT='8098'; node server/index.js
//   node scripts/liveMobCombat.js

import { WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 8098);
const URL = `ws://localhost:${PORT}`;
const SPEED = 2.0;   // скорость воина, клеток/сек

const log = (...a) => console.log("  ", ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const inbox = [];
const ws = new WebSocket(URL);

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "ping") return ws.send(JSON.stringify({ type: "pong" }));
  inbox.push({ ...msg, _at: Date.now() });   // _at — момент получения (для проверки «после смерти»)
});

function send(obj) {
  ws.send(JSON.stringify(obj));
}

// Ждём первое сообщение, для которого pred(msg) === true
function take(pred, timeout = 10000, label = "сообщение") {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const i = inbox.findIndex(pred);
      if (i >= 0) return resolve(inbox.splice(i, 1)[0]);
      if (Date.now() - started > timeout) {
        return reject(new Error(
          `timeout: ${label} (в очереди: ${inbox.map((m) => m.type).join(", ") || "пусто"})`
        ));
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}

const byType = (type, extra = null) => (m) => m.type === type && (!extra || extra(m));

const checks = [];
function check(name, cond, extra = "") {
  checks.push({ name, ok: !!cond });
  console.log(`  ${cond ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`);
}

// Идём в клетку одним moveTo и ждём, пока перс пройдёт путь
async function goTo(tx, ty, label = `${tx},${ty}`) {
  send({ type: "moveTo", x: tx, y: ty });
  const pf = await take(byType("pathFound", (m) => m.x === tx && m.y === ty), 6000, `pathFound ${label}`);
  await wait((pf.path.length / SPEED) * 1000 + 500);
  return pf;
}

async function main() {
  await new Promise((r) => ws.on("open", r));
  log("WS подключён\n");

  // ============ 1. Регистрация / персонаж / вход ============
  const nick = "d11" + Math.floor(Math.random() * 1e6);
  send({ type: "register", nickname: nick, password: "secret123" });
  const reg = await take(byType("ok", (m) => m.action === "registered"));
  check("регистрация", !!reg.token);

  send({ type: "createCharacter", slot: 0, name: "Герой" + Math.floor(Math.random() * 1e4), class: "warrior" });
  const cc = await take(byType("characterCreated"));
  const charId = cc.character.id;
  check("создание персонажа", !!charId, charId);

  send({ type: "enterWorld", characterId: charId });
  const we = await take(byType("worldEntered"));
  check("вход в мир (forest_1)", we.location?.id === "forest_1", we.location?.id);
  check("HP воина 136", we.you.maxHp === 136, `${we.you.hp}/${we.you.maxHp}`);

  // ============ 2. Переход в forest_2 ============
  log("\n  иду на восток (19,7) ...");
  await goTo(19, 7);
  const lc = await take(byType("locationChange"), 20000, "locationChange");
  check("переход в forest_2", lc.location?.id === "forest_2", lc.location?.id);
  check("появился на западном краю (1,7)", lc.you.x === 1 && lc.you.y === 7, `(${lc.you.x}, ${lc.you.y})`);

  const mobs = (lc.entities ?? []).filter((e) => e.type === "mob");
  const goblin = mobs.find((m) => m.mobType === "goblin");
  const wolf = mobs.find((m) => m.mobType === "wolf");
  const orc = mobs.find((m) => m.mobType === "orc");
  check("мобы в локации (гоблин/волк/орк)", !!goblin && !!wolf && !!orc,
    mobs.map((m) => m.mobType).join(", "));

  // ============ 3. Гоблин: бьём, убиваем, добываем XP ============
  //    Заодно замеряем КУЛДАУН моба: интервал между playerHit >= 1000мс (attackSpeed 1.0)
  log(`\n  атакую гоблина (${goblin.id}) — убиваю для XP и замера кулдауна ...`);
  await goTo(8, 9);
  send({ type: "attack", targetId: goblin.id });
  await take(byType("attackStarted"), 5000, "attackStarted");

  const goblinHitTimes = [];
  let goblinKilled = null;
  let xp = null;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline && !goblinKilled) {
    try {
      const m = await take(
        (msg) =>
          (msg.type === "playerHit" && msg.attackerId === goblin.id) ||
          (msg.type === "combatEvent" && msg.targetId === goblin.id && msg.killed),
        deadline - Date.now(),
        "бой с гоблином"
      );
      if (m.type === "playerHit") goblinHitTimes.push({ at: Date.now(), dmg: m.damage });
      else goblinKilled = m;
    } catch {
      break;
    }
  }
  check("гоблин бьёт игрока (playerHit)", goblinHitTimes.length > 0,
    `ударов по игроку: ${goblinHitTimes.length}`);
  check("гоблин убит", !!goblinKilled, goblinKilled ? `HP=${goblinKilled.hp}` : "не убит");

  if (goblinHitTimes.length >= 2) {
    const gaps = goblinHitTimes.slice(1).map((h, i) => h.at - goblinHitTimes[i].at);
    const minGap = Math.min(...gaps);
    check("кулдаун моба >= 900мс (не чаще 1 удара/сек)", minGap >= 900, `мин. интервал ${minGap}мс`);
  } else {
    check("кулдаун моба >= 900мс (не чаще 1 удара/сек)", false, "недостаточно ударов для замера");
  }

  if (goblinKilled) {
    xp = await take(byType("xpGained"), 6000, "xpGained");
    check("опыт за убийство", xp.amount > 0, `+${xp.amount} → ${xp.xp}/${xp.xpToNext}`);
  }

  // ============ 4. Пассивный ВОЛК: provoked → бьёт в ответ ============
  log(`\n  иду к волку и бью один раз (${wolf.id}) ...`);
  await goTo(5, 11);
  send({ type: "attack", targetId: wolf.id });
  await take(byType("attackStarted"), 5000, "attackStarted");

  // Волк пассивный: он ответит ТОЛЬКО после нашего удара (provoked)
  const wolfHit = await take(
    byType("playerHit", (m) => m.attackerId === wolf.id),
    20000,
    "playerHit от волка"
  );
  const wolfDmg = Math.max(1, 18 - 14);   // волк atk 18 − def воина 14
  check("пассивный волк бьёт в ответ (provoked)", wolfHit.damage >= 1,
    `урон ${wolfHit.damage}${wolfHit.crit ? " (крит)" : ""}`);
  check("урон волка = max(1, 18 − 14) = 4 (крит ×2)",
    wolfHit.damage === wolfDmg || (wolfHit.crit && wolfHit.damage === wolfDmg * 2),
    `${wolfHit.damage}`);
  check("HP игрока уменьшился", wolfHit.hp < wolfHit.maxHp && wolfHit.hp > 0,
    `${wolfHit.hp}/${wolfHit.maxHp}`);

  send({ type: "stopAttack" });
  await take(byType("attackCleared"), 5000, "attackCleared");
  const hpAfterWolf = wolfHit.hp;

  // ============ 5. ОРК (агрессивный): подходим, он бьёт первым ============
  log("\n  иду к орку (17,9) — он должен ударить первым ...");
  await goTo(17, 7);
  await goTo(17, 9);

  const orcHits = [];
  let orcFirst = null;
  const orcDeadline = Date.now() + 25000;
  while (Date.now() < orcDeadline && !orcFirst) {
    try {
      const m = await take(byType("playerHit", (msg) => msg.attackerId === orc.id),
        orcDeadline - Date.now(), "playerHit от орка");
      orcHits.push({ at: Date.now(), ...m });
      orcFirst = m;
    } catch {
      break;
    }
  }
  check("орк атакует первым (игрок не целился)", !!orcFirst,
    orcFirst ? `урон ${orcFirst.damage}` : "не ударил");
  if (orcFirst) {
    const orcDmg = Math.max(1, 30 - 14);   // орк atk 30 − def 14
    check("урон орка = max(1, 30 − 14) = 16 (крит ×2)",
      orcFirst.damage === orcDmg || (orcFirst.crit && orcFirst.damage === orcDmg * 2),
      `${orcFirst.damage}`);
    check("HP игрока продолжает падать", orcFirst.hp < hpAfterWolf,
      `${hpAfterWolf} → ${orcFirst.hp}`);
  }

  // ============ 6. СМЕРТЬ ============
  log("\n  стою без боя — жду смерти ...");
  const died = await take(byType("youDied"), 90000, "youDied");
  check("экран смерти (youDied)", !!died.killedBy, `убит: ${died.killedBy}`);

  const corpse = await take(byType("entityLeft", (m) => m.entityId === charId), 5000, "entityLeft");
  check("труп убран из локации (entityLeft)", corpse.entityId === charId, corpse.entityId);

  // Мобы теряют цель: playerHit, пришедшие ПОСЛЕ youDied, быть не должно
  await wait(1500);
  const stray = inbox.filter((m) => m.type === "playerHit" && m._at > died._at);
  check("после смерти мобы не бьют труп", stray.length === 0, `лишних playerHit: ${stray.length}`);

  // ============ 7. РЕСПАВН ============
  log("\n  возрождаюсь ...");
  send({ type: "respawn" });
  const rs = await take(byType("respawned"), 10000, "respawned");
  check("респавн в forest_1", rs.location?.id === "forest_1", rs.location?.id);
  check("HP = 1 после респавна", rs.you.hp === 1, `${rs.you.hp}/${rs.you.maxHp}`);
  check("позиция — стартовый спавн (5,7)", rs.you.x === 5 && rs.you.y === 7,
    `(${rs.you.x}, ${rs.you.y})`);

  if (xp) {
    const expected = Math.max(0, xp.xp - 10);   // 10% от xpToNext (ур. 1 → 100 → 10)
    check("потеря 10% XP при смерти", rs.you.xp === expected,
      `${xp.xp} → ${rs.you.xp} (ожидалось ${expected})`);
  }

  // ============ ИТОГ ============
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n=== ИТОГ: ${checks.length - failed.length}/${checks.length} проверок пройдено ===`);
  if (failed.length > 0) console.log("Провалено: " + failed.map((f) => f.name).join(", "));

  ws.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("\nОШИБКА:", e.message);
  console.error("Провалено: " + checks.filter((c) => !c.ok).map((c) => c.name).join(", "));
  process.exit(1);
});
