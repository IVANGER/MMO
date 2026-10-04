// Объекты мира: сундуки, двери, порталы (День 15) + реэкспорт природных объектов

export {
  OBJECT_TYPES,
  getObjectType,
  isBlockingObject,
  hasBlockingObject,
  getBlockedCells,
} from "../../shared/objects.js";

export { NATURE_OBJECTS, tree, rock } from "../content/objects/nature.js";

// TODO: День 15 — сундуки, двери, порталы (интерактивные объекты)
