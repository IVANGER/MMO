// Живой тест Дня 12: НАВЫКИ, ЗЕЛЬЯ, ХОТБАР, РАДИУС АТАКИ
//   1. Вход → навыки 1-4 (порядок) → стартовый набор: 5 зелий
//   2. Переход в forest_2 → атака через пол-карты НЕ бьёт (inAttackRange)
//   3. Автоатака с соседней клетки → combatEvent; моб бьёт в ответ (playerHit)
//   4. Зелье: +HP ≤50, кулдаун 10 сек (повторное → itemCooldown)
//   5. Навыки: charge (рывок + удар), slash (кулдаун), баффы; мана падает
//   6. Хотбар: set/get/clear, неверные слоты → error, использование из хотбара
//   7. Убийство моба → xpGained; logout/login → зелья НЕ выдаются повторно
//
// Нужен поднятый сервер. Запускать на СВЕЖЕЙ БД:
//   $env:DB_PATH='data/live_d12.db'; $env:PORT='8099'; node server/index.js
//   node scripts/liveDay12.js

import { WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 8099);
const URL = `ws://localhost:${PORT}`;
const SPEED = 2.0;   // скорость воина, клеток/сек

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
  await wait((pf.path.length / SPEED) * 1000 + 500);
  return pf;
}

const potionsOf = (inv) => inv.items.filter((i) => i.type === "health_potion");

async function main() {
  await new Promise((r) => ws.on("open", r));
  log("WS подключён\n");

  // ============ 1. Регистрация / персонаж / вход ============
  const nick = "d12" + Math.floor(Math.random() * 1e6);
  const pass = "secret123";
  send({ type: "register", nickname: nick, password: pass });
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

  // ============ 2. Навыки: порядок слотов 1-4 ============
  send({ type: "getSkills" });
  const sk = await take(byType("skills"));
  const ids = sk.skills.map((s) => s.id);
  check("навыков ровно 4", ids.length === 4, ids.join(","));
  check("порядок слотов 1-4 = slash, charge, iron_skin, battle_cry",
    JSON.stringify(ids) === JSON.stringify(["slash", "charge", "iron_skin", "battle_cry"]), ids.join(","));
  check("у каждого навыка иконка и кулдаун",
    sk.skills.every((s) => s.icon && s.cooldown > 0));

  // ============ 3. Стартовый набор: 5 зелий ============
  send({ type: "getInventory" });
  let inv = await take(byType("inventory"));
  let potions = potionsOf(inv);
  check("стартовый набор: 5 зелий при первом входе", potions.length === 5, `${potions.length} шт`);
  check("зелье — «Зелье здоровья» с иконкой",
    potions[0]?.name === "Зелье здоровья" && !!potions[0]?.icon, `${potions[0]?.name} ${potions[0]?.icon}`);
  let potionsLeft = potions.length;

  // ============ 4. Переход в forest_2 ============
  log("\n  иду на восток (19,7) ...");
  await goTo(19, 7);
  const lc = await take(byType("locationChange", (m) => m.location?.id === "forest_2"), 8000, "locationChange forest_2");
  check("переход в forest_2", lc.location?.id === "forest_2", lc.location?.id);

  const mobs = (lc.entities ?? []).filter((e) => e.type === "mob");
  const goblins = mobs.filter((m) => m.mobType === "goblin");
  check("в forest_2 есть гоблины", goblins.length >= 3, `${goblins.length} шт`);

  // Дальний гоблин (18,10) — от спавна (4,7) далеко
  const far = goblins.find((g) => g.x === 18) ?? goblins[goblins.length - 1];
  // Ближайший к спавну гоблин (обычно (8,10)) — бьёмся с ним
  const near = goblins.reduce((best, g) => {
    const d = Math.abs(g.x - 4) + Math.abs(g.y - 7);
    return !best || d < best.d ? { g, d } : best;
  }, null)?.g;

  // ============ 5. Радиус атаки: через пол-карты — НЕ бьём ============
  log("\n  атакую дальнего гоблина — ударов через пол-карты быть не должно ...");
  send({ type: "attack", targetId: far.id });
  await take(byType("attackStarted", (m) => m.targetId === far.id), 5000, "attackStarted");
  await wait(1400);
  const early = inbox.filter((m) =>
    m.type === "combatEvent" && m.attackerId === charId && m.targetId === far.id);
  check("дальняя атака: ударов через пол-карты нет (inAttackRange)", early.length === 0,
    `combatEvent: ${early.length}`);
  send({ type: "stopAttack" });
  await take(byType("attackCleared"), 5000, "attackCleared");

  // ============ 6. Соседняя атака: сервер доводит до соседней клетки ============
  log(`\n  автоатака гоблина (${near.x},${near.y}) — подход сам ...`);
  send({ type: "attack", targetId: near.id });
  await take(byType("attackStarted", (m) => m.targetId === near.id), 5000, "attackStarted");

  const ce = await take(
    byType("combatEvent", (m) => m.attackerId === charId && m.targetId === near.id),
    15000, "combatEvent (автоатака)"
  );
  check("автоатака с соседней клетки: combatEvent", ce.damage >= 1, `урон ${ce.damage}`);
  check("урон моба уменьшился", ce.hp < ce.maxHp, `${ce.hp}/${ce.maxHp}`);

  // Моб provoked/агрессивен — бьёт в ответ
  const hit = await take(byType("playerHit", (m) => m.attackerId === near.id), 15000, "playerHit от гоблина");
  check("гоблин бьёт в ответ", hit.hp < hit.maxHp, `${hit.hp}/${hit.maxHp}`);

  send({ type: "stopAttack" });
  await take(byType("attackCleared"), 5000, "attackCleared (2)");

  // ============ 7. Зелье: +HP, кулдаун 10 сек ============
  log("\n  пью зелье ...");
  const pot1 = potions[1].id;
  const now0 = Date.now();
  send({ type: "useItem", itemId: potions[0].id });
  const used = await take(byType("itemUsed"), 5000, "itemUsed");
  potionsLeft--;
  check("зелье вылечило (healed > 0 и ≤ 50)", used.healed > 0 && used.healed <= 50, `+${used.healed} HP`);
  check("HP не выше максимума", used.hp <= used.maxHp, `${used.hp}/${used.maxHp}`);
  check("кулдаун зелья 10 сек", used.cooldown === 10 && used.cooldownUntil > now0,
    `cooldown=${used.cooldown}`);
  check("в ответ пришёл обновлённый инвентарь", inbox.some((m) => m.type === "inventory"));

  // Повторное зелье (второй шт.) — на кулдауне
  send({ type: "useItem", itemId: pot1 });
  const cd = await take(byType("itemCooldown"), 5000, "itemCooldown");
  check("повторное зелье на кулдауне (9-10 сек)", cd.left >= 9 && cd.left <= 10, `${cd.left} сек`);

  // ============ 8. Навыки ============
  log("\n  отхожу и рывком атакую гоблина ...");
  const awayX = Math.max(1, near.x - 4);   // влево от гоблина — гарантированно суша
  await goTo(awayX, near.y);

  const mpBefore = we.you.maxMp;   // первый замер после входа (мана полная)
  const mpLog = [];

  // charge — рывок вплотную + удар (range 5)
  send({ type: "useSkill", skillId: "charge", targetId: near.id });
  const charge = await take(byType("skillUsed", (m) => m.skillId === "charge"), 5000, "skillUsed charge");
  mpLog.push(charge.mp);
  check("charge: навык применён", charge.cooldownUntil > Date.now());
  check("charge: мана уменьшилась (−10)", charge.mp <= mpBefore - 10 + 3, `${mpBefore} → ${charge.mp}`);

  const chargeHit = await take(
    byType("combatEvent", (m) => m.attackerId === charId && m.targetId === near.id && m.skill === true),
    8000, "combatEvent от charge"
  );
  check("charge: удар прошёл (skill combatEvent)", chargeHit.damage >= 1, `урон ${chargeHit.damage}`);

  // slash — соседняя клетка (мы телепортировались вплотную)
  send({ type: "useSkill", skillId: "slash", targetId: near.id });
  const slash = await take(byType("skillUsed", (m) => m.skillId === "slash"), 5000, "skillUsed slash");
  check("slash: мана уменьшилась (−5)", slash.mp < charge.mp, `${charge.mp} → ${slash.mp}`);
  await take(
    byType("combatEvent", (m) => m.attackerId === charId && m.skill === true),
    5000, "combatEvent от slash"
  );

  // slash повторно — кулдаун 3 сек
  send({ type: "useSkill", skillId: "slash", targetId: near.id });
  const scd = await take(byType("skillCooldown"), 5000, "skillCooldown");
  check("slash на кулдауне (1-3 сек)", scd.left >= 1 && scd.left <= 3, `${scd.left} сек`);

  // Баффы
  send({ type: "useSkill", skillId: "iron_skin" });
  const iron = await take(byType("skillUsed", (m) => m.skillId === "iron_skin"), 5000, "skillUsed iron_skin");
  check("iron_skin: применён, мана −8", iron.mp < slash.mp, `mp=${iron.mp}`);

  send({ type: "useSkill", skillId: "battle_cry" });
  const cry = await take(byType("skillUsed", (m) => m.skillId === "battle_cry"), 5000, "skillUsed battle_cry");
  check("battle_cry: применён, мана −12", cry.mp < iron.mp, `mp=${cry.mp}`);

  // ============ 9. ХОТБАР ============
  log("\n  хотбар: ставлю зелье в слот 0 ...");
  send({ type: "setHotbarSlot", slotIndex: 0, itemId: pot1 });
  const hu = await take(byType("hotbarUpdate", (m) => m.index === 0), 5000, "hotbarUpdate");
  check("хотбар: слот 0 заполнен", hu.itemId === pot1, hu.itemId);

  drain("hotbar");   // убрать «хвостовой» hotbar от useItem (пришёл давно)
  send({ type: "getHotbar" });
  const hb = await take(byType("hotbar"));
  const slot0 = (hb.slots ?? []).find((s) => s.index === 0);
  check("getHotbar возвращает слот 0", slot0?.itemId === pot1, slot0?.itemId ?? "нет слота");

  send({ type: "setHotbarSlot", slotIndex: 99, itemId: pot1 });
  const err1 = await take(byType("error"), 5000, "error (слот 99)");
  check("неверный слот (99) → error", /слот/i.test(err1.message ?? ""), err1.message);

  send({ type: "setHotbarSlot", slotIndex: 1, itemId: "item_bogus123" });
  const err2 = await take(byType("error"), 5000, "error (чужой предмет)");
  check("чужой предмет → «Предмет не найден»", /не найден/i.test(err2.message ?? ""), err2.message);

  // Использование из хотбара (эквивалент клавиши 5) — ждём конца кулдауна
  const remain = used.cooldownUntil - Date.now() + 300;
  if (remain > 0) {
    log(`  жду кулдаун зелья ещё ${Math.ceil(remain / 1000)} сек ...`);
    await wait(remain);
  }

  drain("hotbar");
  drain("inventory");
  send({ type: "useItem", itemId: pot1 });
  const used2 = await take(byType("itemUsed"), 5000, "itemUsed (из хотбара)");
  potionsLeft--;
  check("зелье из хотбара использовано (кулдаун 10)", used2.cooldown === 10 && used2.hp <= used2.maxHp,
    `hp=${used2.hp}/${used2.maxHp}`);

  // Слот очистился сам (ON DELETE SET NULL) — пришёл свежий хотбар
  const hb2 = await take(byType("hotbar"), 5000, "hotbar после использования");
  const slot0b = (hb2.slots ?? []).find((s) => s.index === 0);
  check("слот хотбара очистился после использования", !slot0b || slot0b.itemId == null,
    String(slot0b?.itemId));

  send({ type: "clearHotbarSlot", slotIndex: 0 });
  const hc = await take(byType("hotbarUpdate", (m) => m.index === 0), 5000, "clearHotbarSlot");
  check("clearHotbarSlot → itemId: null", hc.itemId === null, String(hc.itemId));

  // ============ 10. Убийство гоблина → опыт ============
  log("\n  жду убийства гоблина (автоатака продолжается после charge) ...");
  const xp = await take(byType("xpGained"), 30000, "xpGained");
  check("гоблин убит, опыт получен", xp.amount > 0, `+${xp.amount} XP, ур. ${xp.level}`);

  // ============ 11. Повторный вход: набор выдаётся 1 раз ============
  log("\n  перелогиниваюсь — зелья не должны выдаваться повторно ...");
  send({ type: "logout" });
  await take(byType("ok", (m) => m.action === "loggedOut"), 5000, "loggedOut");

  send({ type: "login", nickname: nick, password: pass });
  await take(byType("ok", (m) => m.action === "loggedIn"), 5000, "loggedIn");

  send({ type: "enterWorld", characterId: charId });
  await take(byType("worldEntered"), 8000, "worldEntered (2)");

  drain("inventory");
  send({ type: "getInventory" });
  inv = await take(byType("inventory"));
  potions = potionsOf(inv);
  check("стартовый набор выдан только 1 раз на персонажа", potions.length === potionsLeft,
    `${potions.length} шт (израсходовано ${5 - potionsLeft})`);

  // ============ ИТОГ ============
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n=== ИТОГ: ${checks.length - failed.length}/${checks.length} проверок пройдено ===`);
  if (failed.length > 0) console.log("Провалено: " + failed.map((f) => f.name).join(", "));

  ws.close();
  process.exit(failed.length > 0 ? 1 : 0);
}

// Убрать накопившиеся сообщения типа type из очереди
function drain(type) {
  for (let i = inbox.length - 1; i >= 0; i--) {
    if (inbox[i].type === type) inbox.splice(i, 1);
  }
}

main().catch((e) => {
  console.error("\nОШИБКА:", e.message);
  console.error("Провалено: " + checks.filter((c) => !c.ok).map((c) => c.name).join(", "));
  process.exit(1);
});

