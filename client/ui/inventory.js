// Окно инвентаря (клавиша I) — День 10 / День 11
// Слева — слоты экипировки персонажа (paper-doll), ниже — сетка рюкзака 6×8 = 48 слотов.
// Справа колонкой на всю высоту — слоты артефактов 1-5.
// Пока все слоты пустые: предметы появятся в Дне 15.

export const INVENTORY_COLS = 6;
export const INVENTORY_ROWS = 8;
export const INVENTORY_SLOTS = INVENTORY_COLS * INVENTORY_ROWS;

// Артефакты — колонка справа, сверху вниз (День 11)
export const ARTIFACT_SLOTS = 5;

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

// Слот экипировки: иконка + подпись
function eqSlot(key, icon, label, extraClass = "") {
  return `
    <div class="gw-eq-slot ${extraClass}" data-eq="${key}" title="${label}">
      <span class="gw-eq-ico">${icon}</span>
      <span class="gw-eq-lbl">${label}</span>
    </div>`;
}

function renderEquipHtml() {
  return `
    <div class="gw-equip">
      <!-- Сверху: шлем, амулет -->
      <div class="gw-equip-row">
        ${eqSlot("helmet", "🪖", "Шлем", "gw-eq-p1")}
        ${eqSlot("amulet", "📿", "Амулет", "gw-eq-p3")}
      </div>

      <!-- Посередине: перчатки · броня · кольца -->
      <div class="gw-equip-row gw-equip-row-mid">
        ${eqSlot("gloves", "🧤", "Перчатки", "gw-eq-p1")}
        ${eqSlot("armor", "🛡️", "Броня", "gw-eq-p2")}
        <div class="gw-eq-rings gw-eq-p3">
          ${eqSlot("ring1", "💍", "Кольцо 1", "gw-eq-slot-sm")}
          ${eqSlot("ring2", "💍", "Кольцо 2", "gw-eq-slot-sm")}
        </div>
      </div>

      <!-- Снизу: сапоги, плащ -->
      <div class="gw-equip-row">
        ${eqSlot("boots", "🥾", "Сапоги", "gw-eq-p1")}
        ${eqSlot("cloak", "🧥", "Плащ", "gw-eq-p3")}
      </div>
    </div>`;
}

function renderArtifactsHtml() {
  const slots = [];
  for (let i = 1; i <= ARTIFACT_SLOTS; i++) {
    slots.push(`
      <div class="gw-eq-slot gw-eq-slot-art" data-eq="artifact${i}" title="Артефакт ${i}">
        <span class="gw-eq-ico">✦</span>
        <span class="gw-eq-lbl">${i}</span>
      </div>`);
  }

  return `
    <div class="gw-artifacts">
      <div class="gw-art-title">Артефакты</div>
      ${slots.join("")}
    </div>`;
}

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

    <div class="gw-inv-body">
      <div class="gw-inv-left">
        ${renderEquipHtml()}
        <div class="gw-inv-grid">
          ${slots.join("")}
        </div>
      </div>

      ${renderArtifactsHtml()}
    </div>

    <div class="gw-inv-foot">
      Экипировка 8 слотов · Артефакты ${ARTIFACT_SLOTS} · Рюкзак ${INVENTORY_COLS}×${INVENTORY_ROWS} (${INVENTORY_SLOTS}) · пусто
    </div>
  `;
}