// Тесты RNG
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng, randomInt, pick, chance, shuffle } from "../../server/rng.js";

test("RNG с одинаковым сидом даёт одинаковые числа", () => {
  const r1 = createRng(12345);
  const r2 = createRng(12345);
  for (let i = 0; i < 100; i++) {
    assert.equal(r1(), r2());
  }
});

test("RNG с разным сидом даёт разные числа", () => {
  const r1 = createRng(1);
  const r2 = createRng(2);
  let same = 0;
  for (let i = 0; i < 100; i++) {
    if (r1() === r2()) same++;
  }
  assert.ok(same < 10, "Слишком много совпадений");
});

test("RNG выдаёт числа в диапазоне [0, 1)", () => {
  const rng = createRng(42);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `v=${v} вне диапазона`);
  }
});

test("randomInt возвращает числа в диапазоне", () => {
  const rng = createRng(42);
  for (let i = 0; i < 1000; i++) {
    const v = randomInt(rng, 5, 10);
    assert.ok(v >= 5 && v <= 10, `v=${v} вне [5,10]`);
  }
});

test("pick возвращает элемент массива", () => {
  const rng = createRng(42);
  const arr = ["a", "b", "c"];
  for (let i = 0; i < 100; i++) {
    assert.ok(arr.includes(pick(rng, arr)));
  }
});

test("chance(0) никогда не срабатывает", () => {
  const rng = createRng(42);
  for (let i = 0; i < 100; i++) {
    assert.equal(chance(rng, 0), false);
  }
});

test("chance(1) всегда срабатывает", () => {
  const rng = createRng(42);
  for (let i = 0; i < 100; i++) {
    assert.equal(chance(rng, 1), true);
  }
});

test("shuffle не теряет элементы", () => {
  const rng = createRng(42);
  const arr = [1, 2, 3, 4, 5];
  const shuffled = shuffle(rng, arr);
  assert.equal(shuffled.length, arr.length);
  assert.deepEqual([...shuffled].sort(), [...arr].sort());
});