// Тесты Дня 9: 10 характеристик → 16 вторичных параметров

import { test } from "node:test";
import assert from "node:assert/strict";

import { ATTRIBUTES, ATTR_ORDER, attrsAtLevel } from "../../shared/attributes.js";
import {
  calcHP, calcMP, calcMeleeDamage, calcDefense, calcAttackSpeed,
  calcCritChance, calcDodgeChance, calcHitChance, calcHpRegen, calcMpRegen,
  calcMoveSpeed, calcMoveRange, calcMagicResist, calcMerchantDiscount, calcAll,
} from "../../shared/derivedStats.js";
import { getClass } from "../../server/content/classes.js";

const WARRIOR = getClass("warrior");
const a1 = WARRIOR.baseAttributes; // STR 8, AGI 5, VIT 7, ...

const near = (actual, expected, msg) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${msg}: ${actual} ≠ ${expected}`);

test("характеристики: ровно 10 и правильный порядок", () => {
  assert.equal(ATTR_ORDER.length, 10);
  assert.equal(Object.keys(ATTRIBUTES).length, 10);
  for (const code of ATTR_ORDER) assert.ok(ATTRIBUTES[code], code);
});

// ============ Скорость и дальность хода (ключевые для Дня 9) ============

test("скорость хода: старт 2.0 при AGI 5", () => {
  near(calcMoveSpeed({ AGI: 5 }), 2.0, "AGI 5");
  near(calcMoveSpeed({ AGI: 10 }), 2.5, "AGI 10");
  near(calcMoveSpeed({ AGI: 24 }), 3.9, "AGI 24");
});

test("дальность хода: старт 3 при AGI 5", () => {
  assert.equal(calcMoveRange({ AGI: 5 }), 3);
});

test("дальность хода: границы роста AGI 10→4, 15→5, 20→6, 25→7", () => {
  assert.equal(calcMoveRange({ AGI: 9 }), 3);
  assert.equal(calcMoveRange({ AGI: 10 }), 4);
  assert.equal(calcMoveRange({ AGI: 14 }), 4);
  assert.equal(calcMoveRange({ AGI: 15 }), 5);
  assert.equal(calcMoveRange({ AGI: 19 }), 5);
  assert.equal(calcMoveRange({ AGI: 20 }), 6);
  assert.equal(calcMoveRange({ AGI: 24 }), 6);
  assert.equal(calcMoveRange({ AGI: 25 }), 7);
  assert.equal(calcMoveRange({ AGI: 1 }), 3); // минимум 3
});

// ============ Воин 1 уровня (пример из плана) ============

test("воин 1 ур.: HP 136, MP 42, урон 18, защита 14", () => {
  assert.equal(calcHP(a1), 136);
  assert.equal(calcMP(a1), 42);
  assert.equal(calcMeleeDamage(a1), 18);
  assert.equal(calcDefense(a1), 14);
});

test("воин 1 ур.: скорость атаки, крит, уклон, хит", () => {
  near(calcAttackSpeed(a1), 1.10, "attackSpeed");
  near(calcCritChance(a1), 0.085, "crit");
  near(calcDodgeChance(a1), 0.06, "dodge");
  near(calcHitChance(a1), 0.83, "hit");
});

test("воин 1 ур.: регены, сопр. магии, скидка", () => {
  near(calcHpRegen(a1), 0.91, "hpRegen");
  near(calcMpRegen(a1), 0.47, "mpRegen");
  assert.equal(calcMagicResist(a1), 5); // floor(3×1.2 + 7×0.3) = floor(5.7)
  near(calcMerchantDiscount(a1), 0.04, "discount");
});

test("воин: calcAll считает все 16 параметров", () => {
  const d = calcAll(a1);
  const keys = [
    "hp", "mp", "meleeDamage", "rangedDamage", "magicDamage", "defense",
    "attackSpeed", "critChance", "dodgeChance", "hitChance",
    "hpRegen", "mpRegen", "moveSpeed", "moveRange", "magicResist", "merchantDiscount",
  ];
  assert.equal(Object.keys(d).length, 16);
  for (const k of keys) assert.ok(d[k] !== undefined, k);
  assert.equal(d.hp, 136);
  assert.equal(d.mp, 42);
  assert.equal(d.moveSpeed, 2.0);
  assert.equal(d.moveRange, 3);
});

// ============ Рост по уровням ============

test("растёт по уровню: AGI 5 → 24 к 20 уровню (таблица плана)", () => {
  const at20 = attrsAtLevel(WARRIOR.baseAttributes, WARRIOR.growthPerLevel, 20);
  assert.equal(at20.AGI, 5 + 1 * 19); // 24
  assert.equal(at20.STR, 8 + 2 * 19);  // 46
  near(calcMoveSpeed(at20), 3.9, "скорость 20 ур.");
  assert.equal(calcMoveRange(at20), 6);

  // Промежуточные строки таблицы плана
  const at10 = attrsAtLevel(WARRIOR.baseAttributes, WARRIOR.growthPerLevel, 10);
  near(calcMoveSpeed(at10), 2.9, "скорость 10 ур.");
  assert.equal(calcMoveRange(at10), 4);

  const at15 = attrsAtLevel(WARRIOR.baseAttributes, WARRIOR.growthPerLevel, 15);
  assert.equal(calcMoveRange(at15), 5);
});

// ============ Контент: локации, объекты, мобы ============

import { REGIONS, LOCATIONS, validateRegions, isLocationCellWalkable } from "../../server/content/regions/index.js";
import { validateObjects, validateLocationObjects } from "../../server/content/objects/index.js";
import { validateMobs } from "../../server/content/mobs/index.js";
import { getMonster, getAllMonsters } from "../../server/content/mobs/monsters.js";
import { isWalkable } from "../../shared/tiles.js";
import { getBlockedCells } from "../../shared/objects.js";

test("локации: размеры тайлов совпадают с width/height", () => {
  for (const loc of Object.values(LOCATIONS)) {
    assert.equal(loc.tiles.length, loc.height, `${loc.id}: высота`);
    for (let y = 0; y < loc.height; y++) {
      assert.equal(loc.tiles[y].length, loc.width, `${loc.id}: ширина строки ${y}`);
    }
  }
});

test("локации: валидация регионов проходит без ошибок", () => {
  assert.doesNotThrow(() => validateRegions());
});

test("локации: есть forest_1 и forest_2", () => {
  assert.ok(LOCATIONS.forest_1);
  assert.ok(LOCATIONS.forest_2);
});

test("связи взаимны и соседние по сетке", () => {
  assert.equal(LOCATIONS.forest_1.connections.east, "forest_2");
  assert.equal(LOCATIONS.forest_2.connections.west, "forest_1");
  assert.equal(LOCATIONS.forest_2.gridX, LOCATIONS.forest_1.gridX + 1);
});

test("ворота перехода на востоке forest_1 проходимы (дорога)", () => {
  const f1 = LOCATIONS.forest_1;
  assert.equal(f1.tiles[7][f1.width - 1], "road");
  assert.ok(isLocationCellWalkable(f1, f1.width - 1, 7));
});

test("ворота перехода на западе forest_2 проходимы (дорога)", () => {
  const f2 = LOCATIONS.forest_2;
  assert.equal(f2.tiles[7][0], "road");
  assert.ok(isLocationCellWalkable(f2, 0, 7));
});

test("спавны локаций проходимы", () => {
  for (const loc of Object.values(LOCATIONS)) {
    assert.ok(
      isLocationCellWalkable(loc, loc.spawnPoint.x, loc.spawnPoint.y),
      `${loc.id}: спавн (${loc.spawnPoint.x},${loc.spawnPoint.y})`
    );
  }
});

test("объекты: валидация проходит без ошибок", () => {
  assert.doesNotThrow(() => validateObjects(LOCATIONS));
});

test("объекты: все стоят на проходимых тайлах (кроме известных исключений)", () => {
  for (const loc of Object.values(LOCATIONS)) {
    for (const obj of loc.objects ?? []) {
      assert.ok(isWalkable(loc.tiles[obj.y][obj.x]), `${loc.id}: объект (${obj.x},${obj.y})`);
    }
  }
});

test("объекты: не занимают точку спавна", () => {
  for (const loc of Object.values(LOCATIONS)) {
    const sp = loc.spawnPoint;
    assert.ok(!getBlockedCells(loc).has(`${sp.x},${sp.y}`), `${loc.id}: спавн занят объектом`);
  }
});

test("валидация ловит объект на воде", () => {
  const loc = {
    id: "test",
    width: 3,
    height: 3,
    tiles: [
      ["grass", "grass", "grass"],
      ["grass", "water", "grass"],
      ["grass", "grass", "grass"],
    ],
    objects: [{ type: "tree", x: 1, y: 1, walkable: false }],
    spawnPoint: { x: 0, y: 0 },
  };
  const errors = validateLocationObjects(loc);
  assert.equal(errors.length, 1);
});

test("валидация ловит неизвестный тип объекта", () => {
  const loc = {
    id: "test",
    width: 2,
    height: 2,
    tiles: [["grass", "grass"], ["grass", "grass"]],
    objects: [{ type: "banana", x: 1, y: 1 }],
    spawnPoint: { x: 0, y: 0 },
  };
  const errors = validateLocationObjects(loc);
  assert.equal(errors.length, 1);
});

test("мобы: валидация спавнов проходит", () => {
  assert.doesNotThrow(() => validateMobs(LOCATIONS));
});

test("мобы: в forest_2 ровно 6 спавнов (3 гоблина, 2 волка, 1 орк)", () => {
  const spawns = LOCATIONS.forest_2.spawns;
  assert.equal(spawns.length, 6);

  const counts = {};
  for (const s of spawns) counts[s.type] = (counts[s.type] ?? 0) + 1;

  assert.equal(counts.goblin, 3);
  assert.equal(counts.wolf, 2);
  assert.equal(counts.orc, 1);
});

test("мобы: шаблоны совпадают с планом (HP/ATK/speed/дальность/XP)", () => {
  const goblin = getMonster("goblin");
  assert.equal(goblin.maxHp, 100);
  assert.equal(goblin.atk, 18);
  assert.equal(goblin.defense, 5);
  assert.equal(goblin.speed, 2.0);
  assert.equal(goblin.moveRange, 4);
  assert.equal(goblin.xp, 10);
  assert.equal(goblin.aggressive, true);
  assert.equal(goblin.aggroRange, 4);

  const wolf = getMonster("wolf");
  assert.equal(wolf.maxHp, 150);
  assert.equal(wolf.atk, 18);
  assert.equal(wolf.defense, 6);
  assert.equal(wolf.speed, 2.0);
  assert.equal(wolf.moveRange, 5);
  assert.equal(wolf.xp, 15);
  assert.equal(wolf.aggressive, false);

  const orc = getMonster("orc");
  assert.equal(orc.maxHp, 250);
  assert.equal(orc.atk, 30);
  assert.equal(orc.defense, 10);
  assert.equal(orc.speed, 2.0);
  assert.equal(orc.moveRange, 3);
  assert.equal(orc.xp, 25);
  assert.equal(orc.aggressive, true);
  assert.equal(orc.aggroRange, 3);
});

test("День 10: скорость всех мобов = скорость игрока 1 уровня (2.0)", () => {
  // Воин 1 уровня: calcMoveSpeed({AGI:5}) = 2.0 — мобы не должны быть быстрее
  const playerSpeed = calcMoveSpeed(WARRIOR.baseAttributes);
  assert.equal(playerSpeed, 2.0, "скорость игрока 1 ур.");
  for (const m of getAllMonsters()) {
    assert.equal(m.speed, playerSpeed, `${m.name}: скорость = скорости игрока`);
  }
});

test("мобы: спавны на проходимых клетках", () => {
  const f2 = LOCATIONS.forest_2;
  for (const s of f2.spawns) {
    assert.ok(isLocationCellWalkable(f2, s.x, s.y), `спавн (${s.x},${s.y})`);
  }
});

// ============ День 10: река в forest_2 переехала вниз ============

test("forest_2: река внизу (y=17-19) и обрывается на конце рукава (x=15)", () => {
  const f2 = LOCATIONS.forest_2;
  assert.equal(f2.width, 25);
  assert.equal(f2.height, 20);

  // Река занимает нижние 3 строки
  for (let y = 17; y <= 19; y++) {
    assert.equal(f2.tiles[y][0], "water", `y=${y}: река слева`);
    assert.equal(f2.tiles[y][12], "water", `y=${y}: река в середине`);
  }

  // Река заканчивается ровно там, где кончается рукав (x=15)
  for (let y = 17; y <= 19; y++) {
    assert.equal(f2.tiles[y][15], "water", `y=${y}: x=15 ещё река (конец рукава)`);
    assert.equal(f2.tiles[y][16], "grass", `y=${y}: x=16 уже суша — река кончилась`);
  }

  // Рукав идёт ВВЕРХ от реки и заканчивается у дороги (y=8)
  for (let y = 8; y <= 16; y++) {
    assert.equal(f2.tiles[y][13], "water", `рукав y=${y}`);
    assert.equal(f2.tiles[y][14], "water", `рукав y=${y}`);
    assert.equal(f2.tiles[y][15], "water", `рукав y=${y}`);
  }
  assert.equal(f2.tiles[7][14], "road", "на уровне дороги рукава уже нет (моста нет)");

  // Сверху — стена леса, а не река
  assert.equal(f2.tiles[0][12], "tree", "верх карты — стена леса");
});

test("forest_2: река внизу непроходима, дорога с запада проходима", () => {
  const f2 = LOCATIONS.forest_2;
  assert.equal(isLocationCellWalkable(f2, 5, 18), false, "река внизу — непроходима");
  assert.equal(isLocationCellWalkable(f2, 14, 12), false, "рукав — непроходим");
  assert.equal(isLocationCellWalkable(f2, 4, 7), true, "дорога (спавн) — проходима");
  assert.equal(isLocationCellWalkable(f2, 0, 7), true, "ворота с запада — проходимы");
});

test("forest_2: дорога идёт с запада и кончается на краю рукава (x=15)", () => {
  const f2 = LOCATIONS.forest_2;
  for (let x = 0; x <= 15; x++) {
    assert.equal(f2.tiles[7][x], "road", `дорога x=${x}`);
  }
  assert.equal(f2.tiles[7][16], "grass", "дорога кончилась — дальше трава");
});

test("регион forest содержит обе локации", () => {
  const region = REGIONS.region_forest;
  assert.equal(region.locations.forest_1.id, "forest_1");
  assert.equal(region.locations.forest_2.id, "forest_2");
});
