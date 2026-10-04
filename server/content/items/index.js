// Сборка предметов (День 12): оружие + броня + расходники
import { WEAPONS } from "./weapons.js";
import { ARMOR } from "./armor.js";
import { CONSUMABLES } from "./consumables.js";

export const ITEMS = {
  ...WEAPONS,
  ...ARMOR,
  ...CONSUMABLES,
};

export function getItem(type) {
  return ITEMS[type] ?? null;
}
