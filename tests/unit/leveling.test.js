// Тесты Дня 9: опыт, уровни, потеря XP при смерти (чистые функции)

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getXpToNextLevel, calcKillXp, grantXp, loseXpOnDeath, levelUp,
} from "../../server/character/leveling.js";
import { getClass } from "../../server/content/classes.js";

// ============ XP до следующего уровня ============

test("getXpToNextLevel(1) === 100", () => {
  assert.equal(getXpToNextLevel(1), 100);
});

test("getXpToNextLevel растёт: формула floor(100 × lvl^1.5)", () => {
  assert.equal(getXpToNextLevel(2), Math.floor(100 * Math.pow(2, 1.5)));
  assert.equal(getXpToNextLevel(5), 1118);
  assert.equal(getXpToNextLevel(10), 3162);
  assert.equal(getXpToNextLevel(20), 8944);
  // Монотонный рост
  for (let l = 1; l < 30; l++) {
    assert.ok(getXpToNextLevel(l + 1) > getXpToNextLevel(l), `ур. ${l}`);
  }
});

// ============ Начисление XP и повышение уровня ============

test("grantXp: без уровня, если опыта мало", () => {
  const r = grantXp({ level: 1, xp: 0 }, 50);
  assert.deepEqual(r, { level: 1, xp: 50, levelsGained: 0 });
});

test("grantXp: ровно 100 XP на 1 уровне → 2 уровень, остаток 0", () => {
  const r = grantXp({ level: 1, xp: 0 }, 100);
  assert.equal(r.level, 2);
  assert.equal(r.xp, 0);
  assert.equal(r.levelsGained, 1);
});

test("grantXp: двойной уровень за один раз", () => {
  // 100 (1→2) + 282 (2→3) = 382
  const r = grantXp({ level: 1, xp: 0 }, 382);
  assert.equal(r.level, 3);
  assert.equal(r.xp, 0);
  assert.equal(r.levelsGained, 2);
});

test("grantXp: отрицательный опыт игнорируется", () => {
  const r = grantXp({ level: 1, xp: 10 }, -50);
  assert.deepEqual(r, { level: 1, xp: 10, levelsGained: 0 });
});

test("гоблин (11 XP с учётом 1.1 множителя) → 10 штук до 2 уровня", () => {
  let s = { level: 1, xp: 0 };
  let kills = 0;
  while (s.level < 2 && kills < 20) {
    s = grantXp(s, calcKillXp(10, 1, 1));
    kills++;
  }
  assert.equal(s.level, 2);
  assert.equal(kills, 10); // 10 × 11 = 110 ≥ 100
});

// ============ Опыт за убийство ============

test("calcKillXp: гоблин lvl1 даёт 11 XP", () => {
  assert.equal(calcKillXp(10, 1, 1), 11); // 10 × (1 + 0.1) × 1.0
});

test("calcKillXp: levelPenalty на разнице уровней", () => {
  assert.equal(calcKillXp(10, 1, 7), 5);   // diff 6 → ×0.5 → floor(11×0.5)
  assert.equal(calcKillXp(10, 1, 12), 1);  // diff 11 → ×0.1 → floor(1.1)
  assert.equal(calcKillXp(10, 1, 2), 11);  // diff 1 → без штрафа
});

// ============ Потеря XP при смерти ============

test("loseXpOnDeath: теряем 10% XP до следующего уровня", () => {
  // 1 ур., xp 50 → потеря floor(100 × 0.1) = 10 → 40
  assert.equal(loseXpOnDeath({ level: 1, xp: 50 }), 40);
  // Не уходим в минус
  assert.equal(loseXpOnDeath({ level: 1, xp: 5 }), 0);
  // 2 ур.: потеря floor(282 × 0.1) = 28
  assert.equal(loseXpOnDeath({ level: 2, xp: 100 }), 72);
});

// ============ Повышение уровня: рост класса + 3 очка ============

test("levelUp воина: прирост класса + 3 свободных очка", () => {
  const warrior = getClass("warrior");
  const start = { ...warrior.baseAttributes };
  const up = levelUp(start, "warrior", 0);

  assert.equal(up.attrPoints, 3);
  assert.equal(up.attrs.STR, start.STR + 2);
  assert.equal(up.attrs.AGI, start.AGI + 1);
  assert.equal(up.attrs.VIT, start.VIT + 2);
  assert.equal(up.attrs.INT, start.INT + 0); // INT не растёт у воина
  assert.equal(up.attrs.RES, start.RES + 2);

  // Исходный объект не мутирован
  assert.equal(start.STR, 8);
});
