// Тесты Дня 13: радиусы атаки по классам, энергия, Маг, навыки мага,
//               замедление, предметы (Старый меч), tooltip-данные

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  inAttackRange,
  inAttackRangeFor,
  cellsInRange,
  applySlow,
  speedMultiplier,
} from "../../server/world/combat.js";
import {
  calcEnergyMax,
  calcEnergyRegen,
  calcAll,
} from "../../shared/derivedStats.js";
import { CLASSES, getClass } from "../../server/content/classes.js";
import { SKILLS } from "../../server/content/skills.js";
import { WEAPONS } from "../../server/content/items/weapons.js";
import { getItem } from "../../server/content/items/index.js";

// ============ Задача 1: радиус атаки 8 клеток (диагональ) ============

test("inAttackRangeFor range=1: диагональ РАЗРЕШЕНА (8 направлений)", () => {
  const a = { x: 10, y: 10 };
  assert.equal(inAttackRangeFor(a, { x: 9, y: 9 }, 1), true, "диагональ вверх-влево");
  assert.equal(inAttackRangeFor(a, { x: 11, y: 9 }, 1), true, "диагональ вверх-вправо");
  assert.equal(inAttackRangeFor(a, { x: 9, y: 11 }, 1), true, "диагональ вниз-влево");
  assert.equal(inAttackRangeFor(a, { x: 11, y: 11 }, 1), true, "диагональ вниз-вправо");
});

test("inAttackRangeFor range=1: та же клетка и 2+ клетки — нельзя", () => {
  const a = { x: 10, y: 10 };
  assert.equal(inAttackRangeFor(a, { x: 10, y: 10 }, 1), false, "та же клетка");
  assert.equal(inAttackRangeFor(a, { x: 12, y: 10 }, 1), false, "через клетку по прямой");
  assert.equal(inAttackRangeFor(a, { x: 10, y: 12 }, 1), false, "через клетку по вертикали");
});

test("inAttackRangeFor range>1: манхэттен (дальний бой мага)", () => {
  const a = { x: 10, y: 10 };
  assert.equal(inAttackRangeFor(a, { x: 13, y: 10 }, 1), false, "воин: 3 клетки — далеко");
  assert.equal(inAttackRangeFor(a, { x: 13, y: 10 }, 3), true, "маг: 3 клетки — достаёт");
  assert.equal(inAttackRangeFor(a, { x: 14, y: 10 }, 3), false, "маг: 4 клетки — далеко");
  // Диагональ на дальнем радиусе НЕ входит (манхэттен, а не Чебышёв)
  assert.equal(inAttackRangeFor(a, { x: 12, y: 12 }, 3), false, "диагональ 2+2 = 4 > 3");
  assert.equal(inAttackRangeFor(a, { x: 11, y: 11 }, 3), true, "диагональ 1+1 = 2 ≤ 3");
});

test("inAttackRange — алиас ближнего боя (range = 1)", () => {
  assert.equal(inAttackRange({ x: 10, y: 10 }, { x: 11, y: 11 }), true);
  assert.equal(inAttackRange({ x: 10, y: 10 }, { x: 12, y: 10 }), false);
});

test("cellsInRange: 8 соседей при range=1, крест при range=3", () => {
  const eight = cellsInRange(10, 10, 1);
  assert.equal(eight.length, 8, "8 соседей");
  assert.ok(eight.some((c) => c.x === 9 && c.y === 9), "диагональ есть");
  assert.ok(eight.every((c) => !(c.x === 10 && c.y === 10)), "клетка цели исключена");

  const far = cellsInRange(0, 0, 3);
  assert.ok(far.length > 8, "радиус 3 больше 8 клеток");
  assert.ok(far.every((c) => Math.abs(c.x) + Math.abs(c.y) <= 3), "только манхэттен ≤ 3");
// ============ Задача 4: энергия и мана ============

test("энергия воина: 66 от VIT/STR, реген 1.01/сек", () => {
  const a = CLASSES.warrior.baseAttributes;   // VIT 7, STR 8
  assert.equal(calcEnergyMax(a), 66);          // 30 + 7×4 + 8 = 66
  assert.equal(Math.round(calcEnergyRegen(a) * 100) / 100, 1.01); // 0.5+0.35+0.16
});

test("энергия растёт от VIT и STR", () => {
  assert.equal(calcEnergyMax({ VIT: 10, STR: 0 }), 70);
  assert.equal(calcEnergyMax({ VIT: 0, STR: 10 }), 40);
  assert.ok(calcEnergyRegen({ VIT: 10, STR: 10 }) > calcEnergyRegen({ VIT: 5, STR: 5 }));
});

test("calcAll отдаёт энергию (18 параметров)", () => {
  const d = calcAll(CLASSES.warrior.baseAttributes);
  assert.equal(Object.keys(d).length, 18);
  assert.equal(d.energyMax, 66);
  assert.ok(d.energyRegen > 0);
  const m = calcAll(CLASSES.mage.baseAttributes);
  assert.equal(m.mp, 116);          // 20 + INT×8 + SPI×2 = 20+80+16
  assert.ok(m.energyMax > 0, "энергия считается для всех");
});

// ============ Задача 3: навыки — финальные значения ============

test("навыки воина: финальный баланс Дня 13", () => {
  assert.equal(SKILLS.slash.name, "Сильный удар");
  assert.equal(SKILLS.slash.cooldown, 8);
  assert.equal(SKILLS.slash.mpCost, 5);
  assert.equal(SKILLS.slash.range, 1);
  assert.equal(SKILLS.slash.damageMultiplier, 1.5);
  assert.equal(SKILLS.slash.critMultiplier, 2);

  assert.equal(SKILLS.charge.cooldown, 12);
  assert.equal(SKILLS.charge.mpCost, 10);
  assert.equal(SKILLS.charge.range, 3);

  assert.equal(SKILLS.iron_skin.cooldown, 45);
  assert.equal(SKILLS.iron_skin.mpCost, 8);
  assert.equal(SKILLS.iron_skin.duration, 15);
  assert.equal(SKILLS.iron_skin.buff.defense, 0.5);

  assert.equal(SKILLS.battle_cry.cooldown, 40);
  assert.equal(SKILLS.battle_cry.mpCost, 12);
  assert.equal(SKILLS.battle_cry.duration, 15);
  assert.equal(SKILLS.battle_cry.buff.atk, 0.3);
});

test("навыки мага: снаряд, ледяная вспышка, телепорт, щит", () => {
  assert.equal(SKILLS.arcane_bolt.name, "Магический снаряд");
  assert.equal(SKILLS.arcane_bolt.type, "damage");
  assert.equal(SKILLS.arcane_bolt.mpCost, 12);
  assert.equal(SKILLS.arcane_bolt.range, 4);
  assert.equal(SKILLS.arcane_bolt.damageMultiplier, 2.0);

  assert.equal(SKILLS.frost_nova.type, "damage");
  assert.equal(SKILLS.frost_nova.mpCost, 15);
  assert.equal(SKILLS.frost_nova.range, 4);
  assert.equal(SKILLS.frost_nova.damageMultiplier, 1.5);
  assert.deepEqual(SKILLS.frost_nova.slow, { mult: 0.5, duration: 3 });

  assert.equal(SKILLS.teleport.type, "blink");
  assert.equal(SKILLS.teleport.mpCost, 10);
  assert.equal(SKILLS.teleport.range, 5);
  assert.equal(SKILLS.teleport.castTime, 2, "каст 2 секунды, не мгновенно");

  assert.equal(SKILLS.arcane_shield.type, "buff");
  assert.equal(SKILLS.arcane_shield.cooldown, 15);
  assert.equal(SKILLS.arcane_shield.mpCost, 12);
  assert.equal(SKILLS.arcane_shield.duration, 15);
  assert.equal(SKILLS.arcane_shield.buff.defense, 0.5);
});

test("навыки мага принадлежат классу и валидны", () => {
  const mage = getClass("mage");
  assert.deepEqual(mage.skills, [
    "arcane_bolt", "frost_nova", "teleport", "arcane_shield",
  ]);
  for (const id of mage.skills) {
    assert.ok(SKILLS[id], `${id} определён`);
    assert.ok(SKILLS[id].icon, `${id}: есть иконка`);
    assert.ok(SKILLS[id].cooldown > 0, `${id}: кулдаун`);
    assert.ok(SKILLS[id].mpCost > 0, `${id}: цена ресурса`);
  }
});

test("все 8 навыков существуют, ключи не конфликтуют", () => {
  assert.equal(Object.keys(SKILLS).length, 8);
  const ids = Object.values(SKILLS).map((s) => s.id);
  assert.equal(new Set(ids).size, 8, "id уникальны");
});

// ============ Замедление (frost_nova) ============

test("замедление: скорость падает вдвое и восстанавливается", () => {
  const mob = { speed: 2.0 };
  assert.equal(speedMultiplier(mob, 1000), 1, "изначально без замедления");

  applySlow(mob, 0.5, 3000, 1000);          // until = 4000
  assert.equal(speedMultiplier(mob, 1000), 0.5);
  assert.equal(speedMultiplier(mob, 3999), 0.5, "до истечения");
  assert.equal(speedMultiplier(mob, 4000), 1, "после истечения — снова 1");
});

test("замедление: сильное не перебивается слабым", () => {
  const mob = {};
  applySlow(mob, 0.25, 5000, 1000);
  applySlow(mob, 0.5, 1000, 2000);          // слабое — игнорируем
  assert.equal(speedMultiplier(mob, 2000), 0.25);
});

// ============ Задача 5: предметы ============

test("Старый меч: +1 ATK, 1 уровень, цена 10", () => {
  const s = WEAPONS.old_sword;
  assert.ok(s, "old_sword есть");
  assert.equal(s.name, "Старый меч");
  assert.equal(s.icon, "⚔️");
  assert.equal(s.slot, "weapon");
  assert.equal(s.rarity, "common");
  assert.equal(s.bonuses.atk, 1);
  assert.equal(s.requires.level, 1);
  assert.equal(s.price, 10);
});

test("стартовое оружие обоих классов описано в шаблонах", () => {
  assert.ok(getItem(CLASSES.warrior.startingWeapon), "rusty_sword описан");
  assert.ok(getItem(CLASSES.mage.startingWeapon), "apprentice_staff описан");
});

test("предметы отдают поля для tooltip (описание, бонусы, цена)", () => {
  const sword = getItem("old_sword");
  assert.ok(sword.description.length > 0, "есть описание");
  assert.ok(sword.bonuses, "есть бонусы");
  assert.ok(sword.requires, "есть требования");
  assert.ok(sword.price > 0, "есть цена");

  const potion = getItem("health_potion");
  assert.ok(potion.description, "у зелья есть описание");
  assert.equal(potion.effect.type, "heal");
});
  assert.ok(far.some((c) => c.x === 3 && c.y === 0), "клетка на 3 вправо есть");
  assert.ok(!far.some((c) => c.x === 2 && c.y === 2), "диагональ 2+2 не входит");
});

// ============ Задача 2: радиус автоатаки у каждого класса ============

test("классы: у каждого свой радиус атаки и ресурс", () => {
  assert.equal(CLASSES.warrior.attackRange, 1, "воин — ближний бой");
  assert.equal(CLASSES.warrior.resource, "energy");
  assert.equal(CLASSES.mage.attackRange, 3, "маг — дальний бой");
  assert.equal(CLASSES.mage.resource, "mana");
});

test("маг доступен для создания персонажа", () => {
  const mage = getClass("mage");
  assert.ok(mage, "класс mage существует");
  assert.equal(mage.name, "Маг");
  assert.equal(mage.icon, "🔮");
  assert.equal(mage.startingWeapon, "apprentice_staff");
  assert.equal(mage.skills.length, 4, "4 навыка");
});