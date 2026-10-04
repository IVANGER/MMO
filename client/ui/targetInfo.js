// Окно карты мира (клавиша M) — День 10
// DOM-оверлей: схема региона с районами в правильном расположении.

import { renderWorldMapHtml } from "../render/renderMinimap.js";

let el = null;
let open = false;

export function isWorldMapWindowOpen() {
  return open;
}

export function toggleWorldMapWindow(location, region) {
  if (open) {
    closeWorldMapWindow();
    return false;
  }
  showWorldMapWindow(location, region);
  return true;
}

function showWorldMapWindow(location, region) {
  closeWorldMapWindow();

  el = document.createElement("div");
  el.className = "gw-window gw-map";
  el.innerHTML = renderWorldMapHtml(location, region);
  document.getElementById("app").appendChild(el);
  open = true;
}

export function closeWorldMapWindow() {
  if (el) el.remove();
  el = null;
  open = false;
}

/** Обновить содержимое открытой карты (после перехода между локациями) */
export function refreshWorldMapWindow(location, region) {
  if (!open || !el) return;
  el.innerHTML = renderWorldMapHtml(location, region);
}
