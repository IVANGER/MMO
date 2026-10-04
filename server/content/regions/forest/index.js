// Регион «Тёмный лес» (сетка 3×3)
// Пока занято 2 локации: forest_1 (0,0) и forest_2 (1,0)

import { FOREST_1 } from "./forest_1.js";
import { FOREST_2 } from "./forest_2.js";

export const FOREST_LOCATIONS = {
  [FOREST_1.id]: FOREST_1,
  [FOREST_2.id]: FOREST_2,
};

export const FOREST_REGION = {
  id: "region_forest",
  name: "Тёмный лес",
  type: "wilderness",
  gridWidth: 3,
  gridHeight: 3,
  locations: FOREST_LOCATIONS,
};