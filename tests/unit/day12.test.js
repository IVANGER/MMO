// Тесты Дня 12: радиус атаки (только соседние клетки), зелья, навыки, баффы

import { test } from "node:test";
import assert from "node:assert/strict";

import { inAttackRange, addBuff, buffedStat } from "../../server/world/combat.js";
import { CONSUMABLES } from "../../server/content/items/consumables.js";
import { ITEMS, getItem } from "../../server/content/items/index.js";
import { WEAPONS } from "../../server/content/items/weapons.js";
import { ARMOR } from "../../server/content/items/armor.js";
import { SKILLS } from "../../server/content/skills.js";
import { getClass } from "../../server/content/classes.js";

// ============ Радиус атаки (День 13: 8 направлений, диагональ разрешена) ============

test("inAttackRange: соседи по стороне и по диагонали — можно бить", () => {
  assert.equal(inAttackRange({ x: 10, y: 10 }, { x: 11, y: 10 }), true, "справа");
  assert.equal(inAttackRange({ x: 10, y: 10 }, { x: 9, y: 10 }), true, "слева");
  assert.equal(inAttackRange({ x: 10, y: 10 }, { x: 10, y: 11 }), true, "снизу");
  assert.equal(inAttackRange({ x: 10, y: 10 }, { x: 10, y: 9 }), true, "сверху");
  // День 13: диагональ разрешена
  assert.equal(inAttackRange({ x: 10, y: 10 }, { x: 9, y: 9 }), true, "диагональ вверх-влево");
  assert.equal(inAttackRange({ x: 10, y: 10 }, { x: 11, y: 11 }), true, "диагональ вниз-вправо");
});

test("inAttackRange: та же клетка / 2+ клетки — нельзя", () => {
  assert.equal(inAttackRange({ x: 10, y: 10 }, { x: 10, y: 10 }), false, "та же клетка");
  assert.equal(inAttackRange({ x: 10, y: 10 }, { x: 12, y: 10 }), false, "через клетку");
  assert.equal(inAttackRange({ x: 10, y: 10 }, { x: 8, y: 11 }), false, "через 2 клетки");
});

test("inAttackRange: дробные координаты округляются до клетки", () => {
  assert.equal(inAttackRange({ x: 10.4, y: 9.6 }, { x: 11, y: 10 }), true, "(10.4,9.6)→(10,10), сосед справа");
  assert.equal(inAttackRange({ x: 10.4, y: 9.6 }, { x: 11, y: 11 }), true, "диагональ после округления");
});

// ============ Зелья (День 12) ============

test("зелье здоровья: heal 50, кулдаун 10 сек, стопка 99", () => {
  const p = CONSUMABLES.health_potion;
  assert.ok(p, "health_potion существует");
  assert.equal(p.type, "health_potion");
  assert.equal(p.name, "Зелье здоровья");
  assert.equal(p.slot, "consumable");
  assert.equal(p.effect.type, "heal");
  assert.equal(p.effect.hp, 50);
  assert.equal(p.cooldown, 10);
  assert.equal(p.stackable, true);
  assert.equal(p.maxStack, 99);
  assert.ok(p.icon, "есть иконка");
});

test("ITEMS собирает оружие, броню и расходники; getItem находит зелье", () => {
  assert.equal(typeof WEAPONS, "object");
  assert.equal(typeof ARMOR, "object");
  assert.equal(ITEMS.health_potion, CONSUMABLES.health_potion);
  assert.equal(getItem("health_potion").name, "Зелье здоровья");
  assert.equal(getItem("no_such_item"), null);
});

// ============ Навыки (День 12): слоты 1-4 ============

test("навыки воина: ровно 4 и в порядке слотов 1-4", () => {
  const cls = getClass("warrior");
  assert.deepEqual(cls.skills, ["slash", "charge", "iron_skin", "battle_cry"]);
  for (const id of cls.skills) {
    assert.ok(SKILLS[id], `навык ${id} определён`);
    assert.ok(SKILLS[id].cooldown > 0, `${id}: кулдаун > 0`);
    assert.ok(SKILLS[id].mpCost > 0, `${id}: цена маны > 0`);
    assert.ok(SKILLS[id].icon, `${id}: есть иконка`);
  }
});

test("навыки: типы эффектов и финальные значения Дня 13", () => {
  assert.equal(SKILLS.slash.type, "damage");
  assert.equal(SKILLS.slash.damageMultiplier, 1.5);
  assert.equal(SKILLS.slash.cooldown, 8);
  assert.equal(SKILLS.slash.mpCost, 5);
  assert.equal(SKILLS.charge.type, "movement");
  assert.equal(SKILLS.charge.range, 3);        // День 13: было 5
  assert.equal(SKILLS.charge.cooldown, 12);
  assert.equal(SKILLS.iron_skin.type, "buff");
  assert.equal(SKILLS.iron_skin.duration, 15); // День 13: было 5
  assert.equal(SKILLS.iron_skin.cooldown, 45); // День 13: было 15
  assert.equal(SKILLS.iron_skin.buff.defense, 0.5);
  assert.equal(SKILLS.battle_cry.type, "buff");
  assert.equal(SKILLS.battle_cry.duration, 15); // День 13: было 6
  assert.equal(SKILLS.battle_cry.cooldown, 40); // День 13: было 20
  assert.equal(SKILLS.battle_cry.buff.atk, 0.3);
});

// ============ Баффы навыков (combat.addBuff / buffedStat) ============

test("баффы: множитель действует, пока не истёк", () => {
  const e = { atk: 10 };
  addBuff(e, "atk", 1.3, 6000, 1000);          // until = 7000
  assert.equal(buffedStat(e, "atk", 10, 1000), 13);
  assert.equal(buffedStat(e, "atk", 10, 6999), 13);
  assert.equal(buffedStat(e, "atk", 10, 7000), 10, "истёк — снова база");
  assert.equal(buffedStat(e, "defense", 14, 2000), 14, "другой стат не тронут");
});

test("баффы: повторный бафф того же стата заменяет старый", () => {
  const e = { atk: 10 };
  addBuff(e, "atk", 1.3, 6000, 1000);
  addBuff(e, "atk", 1.5, 4000, 2000);          // until = 6000
  assert.equal(e.buffs.length, 1);
  assert.equal(buffedStat(e, "atk", 10, 3000), 15);
});
