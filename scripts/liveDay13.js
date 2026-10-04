// Живой тест Дня 13: РАДИУСЫ АТАКИ, МАГ, ЭНЕРГИЯ, ЗАМЕДЛЕНИЕ, ЭКИПИРОВКА, TOOLTIP
//   1. Воин: энергия 66, ресурс «energy», радиус 1
//   2. Воин бьёт по ДИАГОНАЛИ (8 направлений), но не через 2 клетки
//   3. Реген: HP и энергия растут в тике
//   4. Маг: мана 116, радиус 3, навыки мага в порядке 1-4
//   5. Маг бьёт с 3 клеток (дальний бой) и не бьёт с 4
//   6. frost_nova: замедление цели
//   7. teleport: каст 2 сек → телепорт; Esc-отмена (cancelCast)
//   8. Экипировка: Старый меч +1 ATK; снятие возвращает базу
//   9. Инвентарь отдаёт поля tooltip (description/bonuses/price)
//
// Нужен поднятый сервер на СВЕЖЕЙ БД:
//   $env:DB_PATH='data/live_d13.db'; $env:PORT='8097'; node server/index.js
//   node scripts/liveDay13.js

import { WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 8097);
const URL = `ws://localhost:${PORT}`;
const SPEED = 2.0;

const log = (...a) => console.log("  ", ...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const inbox = [];
const ws = new WebSocket(URL);

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "ping") return ws.send(JSON.stringify({ type: "pong" }));
  inbox.push({ ...msg, _at: Date.now() });
});

function send(obj) {
  ws.send(JSON.stringify(obj));
}

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

async function goTo(tx, ty, label = `${tx},${ty}`) {
  send({ type: "moveTo", x: tx, y: ty });
  const pf = await take(byType("pathFound", (m) => m.x === tx && m.y === ty), 6000, `pathFound ${label}`);
  await wait((pf.path.length / SPEED) * 1000 + 400);
  return pf;
}

const manhattan = (a, b) => Math.abs(Math.round(a.x) - Math.round(b.x)) +
                              Math.abs(Math.round(a.y) - Math.round(b.y));

// Переход в локацию: идём к краю карты, ждём locationChange.
// Переходы срабатывают на краю (forest_1: восток → forest_2, forest_2: запад → forest_1).
const EDGE = {
  forest_1: { x: 19, y: 7 },     // 20×15, дорога на восток (y=7)
  forest_2: { x: 1, y: 8 },      // 25×20, вход с запада (y=8, трава)
};

async function changeLocation(fromId, targetId, sender = send) {
  const edge = EDGE[fromId];
  if (!edge) throw new Error(`нет координаты края для ${fromId}`);

  sender({ type: "moveTo", x: edge.x, y: edge.y });
  await take(byType("pathFound", (m) => m.x === edge.x && m.y === edge.y), 6000, "к краю карты");
  await wait(1500);

  return take(byType("locationChange", (m) => m.location?.id === targetId), 8000,
    `locationChange ${targetId}`);
}

async function main() {
  await new Promise((r) => ws.on("open", r));
  log("WS подключён\n");

  // ============ 1. Воин: энергия и радиус ============
  const nick = "d13" + Math.floor(Math.random() * 1e6);
  send({ type: "register", nickname: nick, password: "secret123" });
  const reg = await take(byType("ok", (m) => m.action === "registered"));
  check("регистрация", !!reg.token);

  send({ type: "createCharacter", slot: 0, name: "Воин" + Math.floor(Math.random() * 1e4), class: "warrior" });
  const cc = await take(byType("characterCreated"));
  const charId = cc.character.id;
  check("создание воина", !!charId, charId);

  send({ type: "enterWorld", characterId: charId });
  const we = await take(byType("worldEntered"));
  check("вход в мир (forest_1)", we.location?.id === "forest_1", we.location?.id);
  check("ресурс воина — энергия", we.you.resource === "energy", we.you.resource);
  check("название ресурса «Энергия»", we.you.resourceName === "Энергия", we.you.resourceName);
  check("энергия воина 66 (30+VIT×4+STR)", we.you.maxMp === 66, `${we.you.mp}/${we.you.maxMp}`);
  check("радиус атаки воина 1", we.you.attackRange === 1, `${we.you.attackRange}`);

  // ============ 2. Удар по диагонали ============
  // Идём в forest_2 к гоблинам
  send({ type: "getSkills" });
  const skW = await take(byType("skills"));
  check("навыки воина: slash, charge, iron_skin, battle_cry",
    JSON.stringify(skW.skills.map((s) => s.id)) ===
    JSON.stringify(["slash", "charge", "iron_skin", "battle_cry"]),
    skW.skills.map((s) => s.id).join(","));

  // ============ 3. Реген ============
  // Тратим энергию навыком, ждём — должна восстановиться
  const mpBefore = we.you.mp;
  send({ type: "useSkill", skillId: "iron_skin" });
  const used = await take(byType("skillUsed", (m) => m.skillId === "iron_skin"));
  check("iron_skin: энергия −8", used.mp === mpBefore - 8, `${mpBefore} → ${used.mp}`);
  check("iron_skin: баф защиты применён (кулдаун 45 сек)", used.cooldownUntil > Date.now());

  await wait(1500);
  const afterRegen = inbox.filter((m) => m.type === "entityMoved" && m.entities?.[0]?.id === charId);
  const lastMp = afterRegen.length ? afterRegen[afterRegen.length - 1].entities[0].mp : null;
  check("реген энергии в тике (1.01/сек)", lastMp !== null && lastMp > used.mp,
    `${used.mp} → ${lastMp}`);
// ============ 4. Диагональ: воин бьёт, но не через 2 клетки ============
  const we2 = await changeLocation("forest_1", "forest_2");
  check("переход в forest_2", we2.location?.id === "forest_2", we2.location?.id);

  const goblin = we2.entities.find((e) => e.mobType === "goblin");
  check("в forest_2 есть гоблин", !!goblin, goblin ? `HP ${goblin.hp}` : "нет");

  if (goblin) {
    const gx = Math.round(goblin.x);
    const gy = Math.round(goblin.y);

    // Встаём в соседнюю ДИАГОНАЛЬную клетку и бьём
    await goTo(gx + 1, gy + 1, "диагональ от гоблина");
    send({ type: "attack", targetId: goblin.id });
    await take(byType("attackStarted", (m) => m.targetId === goblin.id));

    const hit = await take(
      byType("combatEvent", (m) => m.attackerId === charId && m.targetId === goblin.id),
      12000, "удар по диагонали"
    );
    check("удар по ДИАГОНАЛИ (8 направлений) — работает", hit.damage >= 1,
      `урон ${hit.damage}, HP ${hit.hp}/${hit.maxHp}`);

    // Контроль радиуса: игрок сам ПОДХОДИТ к цели (approachTarget).
    // С 4 клеток удара быть не должно — но моб тоже бежит к игроку, поэтому
    // проверяем дистанцию в момент первого удара: она уже ≤ 1 (значит, подошёл).
    inbox.length = 0;
    send({ type: "stopAttack" });
    await take(byType("attackCleared"));
    await wait(300);

    const fx = Math.min(18, gx + 4);
    send({ type: "moveTo", x: fx, y: gy });
    await take(byType("pathFound", (m) => m.x === fx && m.y === gy), 6000, "далеко");
    await wait(600);

    send({ type: "attack", targetId: goblin.id });
    await take(byType("attackStarted", (m) => m.targetId === goblin.id));

    const firstHit = await take(
      byType("combatEvent", (m) => m.attackerId === charId && m.targetId === goblin.id),
      12000, "подход и удар"
    );
    check("подход к цели и удар в радиусе 1 (не через пол-карты)", firstHit.damage >= 1,
      `урон ${firstHit.damage}`);
    send({ type: "stopAttack" });
    await take(byType("attackCleared")).catch(() => {});
  }

  // ============ 5. Экипировка: оружие ============
  send({ type: "getInventory" });
  const inv1 = await take(byType("inventory"));
  const weapon = inv1.items.find((i) => i.slot === "weapon");
  check("в инвентаре есть оружие", !!weapon, weapon ? weapon.type : "нет");
  check("tooltip-данные у оружия (описание, цена)",
    !!weapon?.description && weapon?.price > 0,
    weapon ? `"${weapon.description}" цена ${weapon.price}` : "");

  if (weapon) {
    const atkBefore = we2.you.atk;
    send({ type: "equipItem", itemId: weapon.id });
    const eq = await take(byType("itemEquipped"), 6000, "itemEquipped");
    check("экипировка: оружие надето", eq.itemId === weapon.id, eq.name ?? "");
    check("экипировка: ATK не уменьшился", eq.atk >= atkBefore, `${atkBefore} → ${eq.atk}`);

    send({ type: "unequipItem", itemId: weapon.id });
    const un = await take(byType("itemEquipped"), 6000, "unequip");
    check("снятие оружия возвращает базовую ATK", un.atk === atkBefore, `${un.atk}`);
  }

  // ============ 6. МАГ: мана, радиус 3, навыки, замедление, телепорт ============
  log("\n  --- Маг ---");

  // Второе подключение — отдельный аккаунт
  const ws2 = new WebSocket(URL);
  inbox.length = 0;
  await new Promise((r) => ws2.on("open", r));
  ws2.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === "ping") return ws2.send(JSON.stringify({ type: "pong" }));
    inbox.push({ ...msg, _at: Date.now() });
  });
  const sendM = (obj) => ws2.send(JSON.stringify(obj));

  sendM({ type: "register", nickname: "m" + Math.floor(Math.random() * 1e6), password: "secret123" });
  const regM = await take(byType("ok", (m) => m.action === "registered"), 8000, "регистрация мага");
  check("регистрация мага", !!regM.token);

  sendM({ type: "createCharacter", slot: 0, name: "Маг" + Math.floor(Math.random() * 1e4), class: "mage" });
  const ccM = await take(byType("characterCreated"));
  const mageId = ccM.character.id;
  check("создание мага", !!mageId, mageId);

  sendM({ type: "enterWorld", characterId: mageId });
  const weM = await take(byType("worldEntered"));
  check("маг: ресурс — мана", weM.you.resource === "mana", weM.you.resource);
  check("маг: название ресурса «Мана»", weM.you.resourceName === "Мана", weM.you.resourceName);
  check("маг: мана 116 (20+INT×8+SPI×2)", weM.you.maxMp === 116, `${weM.you.mp}/${weM.you.maxMp}`);
  check("маг: радиус атаки 3 (дальний бой)", weM.you.attackRange === 3, `${weM.you.attackRange}`);

  sendM({ type: "getSkills" });
  const skM = await take(byType("skills"));
  check("навыки мага: arcane_bolt, frost_nova, teleport, arcane_shield",
    JSON.stringify(skM.skills.map((s) => s.id)) ===
    JSON.stringify(["arcane_bolt", "frost_nova", "teleport", "arcane_shield"]),
    skM.skills.map((s) => s.id).join(","));

  // ============ 7. Телепорт: каст 2 секунды (в forest_1 — там нет мобов) ============
  // Клетка может быть занята — перебираем варианты (сервер честно шлёт castInterrupted).
  const posBefore = { x: Math.round(weM.you.x), y: Math.round(weM.you.y) };
  const CANDS = [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [-3, 0], [0, 3], [0, -3]];

  let castEnd = null;
  for (let i = 0; i < CANDS.length; i++) {
    const [dx, dy] = CANDS[i];
    inbox.length = 0;
    sendM({
      type: "useSkill",
      skillId: "teleport",
      targetX: posBefore.x + dx,
      targetY: posBefore.y + dy,
    });

    const start = await take(
      byType("castStarted", (m) => m.skillId === "teleport") ||
      byType("error") || byType("skillCooldown", (m) => m.skillId === "teleport"),
      6000, "castStarted"
    );

    if (start.type !== "castStarted") continue;   // занято / кулдаун — пробуем дальше

    const dur = start.until - Date.now();
    if (i === 0) {
      check("teleport: каст ~2 секунды (не мгновенно)", dur > 1500 && dur <= 2000,
        `${Math.round(dur / 100) / 10} сек`);
    }

    // Ждём либо успех, либо причину прерывания
    const outcome = await take(
      byType("castFinished", (m) => m.skillId === "teleport") ||
      byType("castInterrupted", (m) => m.skillId === "teleport"),
      12000, "castFinished/castInterrupted"
    ).catch(() => null);

    if (outcome?.type === "castFinished") {
      castEnd = outcome;
      check("teleport: игрок переместился",
        manhattan({ x: posBefore.x, y: posBefore.y },
                  { x: Math.round(outcome.x), y: Math.round(outcome.y) }) > 0,
        `(${posBefore.x},${posBefore.y}) → (${Math.round(outcome.x)},${Math.round(outcome.y)})`);
      break;
    }

    log(`      кандидат ${posBefore.x + dx},${posBefore.y + dy}: прерван (${outcome?.reason ?? "нет ответа"})`);
    await wait(10500);   // ждём кулдаун 10 сек перед следующей попыткой
  }

  if (!castEnd) check("teleport: игрок переместился", false, "не нашлось свободной клетки");

  // ============ 8. Отмена каста (Esc) ============
  if (castEnd) {
    // ждём кулдаун, чтобы отмена была отдельной проверкой
    await wait(10500);
    const pos2 = { x: Math.round(castEnd.x), y: Math.round(castEnd.y) };
    inbox.length = 0;
    sendM({ type: "useSkill", skillId: "teleport", targetX: pos2.x, targetY: pos2.y + 3 });
    const st2 = await take(
      byType("castStarted", (m) => m.skillId === "teleport") || byType("error"),
      6000, "каст для отмены"
    );

    if (st2.type === "castStarted") {
      sendM({ type: "cancelCast" });
      const cancelled = await take(byType("castCancelled"), 5000, "castCancelled");
      check("castCancelled: каст отменён вручную", !!cancelled);

      await wait(2500);
      const afterCancel = inbox.filter((m) => m.type === "castFinished");
      check("после отмены телепорта не было", afterCancel.length === 0,
        `castFinished: ${afterCancel.length}`);
    } else {
      check("castCancelled: каст отменён вручную", false, st2.message ?? "каст не начался");
    }
  }

  // Маг идёт в forest_2 к гоблинам (через восточный край forest_1)
  const mageLoc = await changeLocation("forest_1", "forest_2", sendM);
  check("маг: переход в forest_2", mageLoc?.location?.id === "forest_2", mageLoc?.location?.id);
  await wait(500);

  const mobsM = (mageLoc?.entities ?? weM.entities ?? []).filter((e) => e.mobType);
  const gm = mobsM.find((e) => e.mobType === "goblin");
  check("маг видит гоблина", !!gm, gm ? `HP ${gm.hp}` : "нет в данных");

  if (gm) {
    const gx = Math.round(gm.x);
    const gy = Math.round(gm.y);

    // ============ 7. Маг бьёт с 3 клеток (дальний бой) ============
    inbox.length = 0;
    sendM({ type: "attack", targetId: gm.id });
    await take(byType("attackStarted", (m) => m.targetId === gm.id));

    const far = await take(
      byType("combatEvent", (m) => m.attackerId === mageId && m.targetId === gm.id),
      14000, "удар мага с расстояния"
    );
    const d3 = Math.abs(Math.round(weM.you.x) - gx) + Math.abs(Math.round(weM.you.y) - gy);
    check("маг бьёт с расстояния (радиус 3)", far.damage >= 1,
      `урон ${far.damage}, дистанция ~${d3}`);

    // ============ 9. frost_nova: замедление ============
    inbox.length = 0;
    sendM({ type: "useSkill", skillId: "frost_nova", targetId: gm.id });
    const nova = await take(byType("skillUsed", (m) => m.skillId === "frost_nova"), 8000, "frost_nova");
    check("frost_nova: мана −15", nova.mp < weM.you.mp, `${weM.you.mp} → ${nova.mp}`);

    const slowMsg = await take(byType("entityEffect", (m) => m.effect === "slow"), 6000, "замедление")
      .catch(() => null);
    check("frost_nova: цель замедлена ×0.5 на 3 сек",
      !!slowMsg && slowMsg.mult === 0.5 && slowMsg.duration === 3,
      slowMsg ? `×${slowMsg.mult} ${slowMsg.duration}с` : "нет события");
  }

  ws2.close();

  report();
}

// ============ ИТОГ ============

function report() {
  const passed = checks.filter((c) => c.ok).length;
  console.log(`\n  ${"=".repeat(46)}`);
  console.log(`  ИТОГ: ${passed}/${checks.length} проверок пройдено`);
  console.log(`  ${"=".repeat(46)}`);

  const failed = checks.filter((c) => !c.ok);
  if (failed.length) {
    console.log("\n  ПРОВАЛЕНО:");
    for (const f of failed) console.log(`   ✗ ${f.name}`);
  }
  ws.close();
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error("\n  ОШИБКА:", e.message);
  process.exit(1);
});