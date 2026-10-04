// Окно инвентаря (клавиша I) — День 10
// Сетка 6×8 = 48 слотов. Пока все пустые: предметы появятся в Дне 15.

export const INVENTORY_COLS = 6;
export const INVENTORY_ROWS = 8;
export const INVENTORY_SLOTS = INVENTORY_COLS * INVENTORY_ROWS;

let el = null;
let open = false;

export function isInventoryWindowOpen() {
  return open;
}

export function toggleInventoryWindow() {
  if (open) {
    closeInventoryWindow();
    return false;
  }
  showInventoryWindow();
  return true;
}

function showInventoryWindow() {
  closeInventoryWindow();

  el = document.createElement("div");
  el.className = "gw-window gw-inventory";
  el.innerHTML = renderInventoryHtml();
  document.getElementById("app").appendChild(el);
  open = true;
}

export function closeInventoryWindow() {
  if (el) el.remove();
  el = null;
  open = false;
}

// ============ Отрисовка ============

function renderInventoryHtml() {
  const slots = [];
  for (let i = 0; i < INVENTORY_SLOTS; i++) {
    slots.push(`<div class="gw-slot" data-slot="${i}"></div>`);
  }

  return `
    <div class="gw-window-head">
      <span class="gw-window-title">Инвентарь</span>
      <span class="gw-window-hint">I — закрыть</span>
    </div>

    <div class="gw-inv-grid">
      ${slots.join("")}
    </div>

    <div class="gw-inv-foot">
      Слотов: ${INVENTORY_COLS}×${INVENTORY_ROWS} (${INVENTORY_SLOTS}) · пусто
    </div>
  `;
}