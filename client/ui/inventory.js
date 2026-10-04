// Окно инвентаря (клавиша I) — День 10 / День 11 / День 12
// Слева — слоты экипировки персонажа (paper-doll), ниже — сетка рюкзака 6×8 = 48 слотов.
// Справа колонкой на всю высоту — слоты артефактов 1-5.
// День 12: предметы приходят с сервера (getInventory), складываются стопками
// по типу и перетаскиваются (drag & drop) в хотбар — слоты 5-8.

import { net } from "../net.js";
import { showTooltip, hideTooltip } from "./tooltip.js";

export const INVENTORY_COLS = 6;
export const INVENTORY_ROWS = 8;
export const INVENTORY_SLOTS = INVENTORY_COLS * INVENTORY_ROWS;

// Артефакты — колонка справа, сверху вниз (День 11)
export const ARTIFACT_SLOTS = 5;

let el = null;
let open = false;

// Предметы с сервера + что тащим мышью (fallback для drop на канвас)
let items = [];
let draggingItemId = null;

export function isInventoryWindowOpen() {
  return open;
}

/** Обновить список предметов (вызывается из worldScene по сообщению inventory) */
export function setInventoryItems(list) {
  items = Array.isArray(list) ? list : [];
  if (open && el) el.innerHTML = renderInventoryHtml();
}

/** itemId, который сейчас перетаскивается (для drop на канвас хотбара) */
export function getDraggingItemId() {
  return draggingItemId;
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

  // Всегда просим актуальный состав (День 12)
  net.send({ type: "getInventory" });

  // Drag & Drop: тянем предмет → сбрасываем на слот хотбара в канвасе
  el.addEventListener("dragstart", (ev) => {
    const cell = ev.target.closest?.("[data-item]");
    if (!cell) return;
    draggingItemId = cell.dataset.item;
    ev.dataTransfer.setData("text/plain", draggingItemId);
    ev.dataTransfer.effectAllowed = "copy";
    cell.classList.add("gw-dragging");
  });

  el.addEventListener("dragend", (ev) => {
    draggingItemId = null;
    ev.target.closest?.(".gw-dragging")?.classList.remove("gw-dragging");
  });

  // Двойной клик — надеть/снять экипировку или использовать расходник (День 13)
  el.addEventListener("dblclick", (ev) => {
    const cell = ev.target.closest?.("[data-item]");
    if (!cell) return;

    const item = findItemById(cell.dataset.item);
    if (!item) return;

    if (item.slot === "consumable") {
      net.send({ type: "useItem", itemId: cell.dataset.item });
    } else if (item.equipped) {
      net.send({ type: "unequipItem", itemId: cell.dataset.item });
    } else {
      net.send({ type: "equipItem", itemId: cell.dataset.item });
    }
  });

  // Tooltip при наведении (День 13)
  el.addEventListener("mouseover", (ev) => {
    const cell = ev.target.closest?.("[data-item]");
    if (!cell) return;
    const item = findItemById(cell.dataset.item);
    if (item) showTooltip(item, ev.clientX, ev.clientY);
  });

  el.addEventListener("mousemove", (ev) => {
    const cell = ev.target.closest?.("[data-item]");
    if (!cell) return;
    const item = findItemById(cell.dataset.item);
    if (item) showTooltip(item, ev.clientX, ev.clientY);
  });

  el.addEventListener("mouseout", (ev) => {
    if (ev.target.closest?.("[data-item]")) hideTooltip(80);
  });
}

/** Найти предмет по id в загруженном списке */
function findItemById(id) {
  return items.find((i) => i.id === id) ?? null;
}

export function closeInventoryWindow() {
  if (el) el.remove();
  el = null;
  open = false;
  draggingItemId = null;
  hideTooltip();   // День 13: подсказка не должна висеть после закрытия
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

// Стопки по типу: 5 зелий → одна ячейка «🧪 ×5», в ячейке — id первого предмета.
// День 13: надетые предметы тоже показываем (помечены «Э»)
// groupItems не фильтрует equipped, чтобы стопка отражала весь инвентарь.
function groupItems(list) {
  const out = [];
  const idx = new Map();

  for (const it of list) {
    if (!it) continue;
    if (idx.has(it.type)) {
      const g = out[idx.get(it.type)];
      g.ids.push(it.id);
      // Стопка надето — если надет хотя бы один экземпляр
      if (it.equipped) g.equipped = true;
    } else {
      idx.set(it.type, out.length);
      out.push({ ...it, ids: [it.id] });
    }
  }
  return out;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>\"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function itemCellHtml(g) {
  const count = g.ids.length > 1 ? `<span class="gw-item-count">${g.ids.length}</span>` : "";
  const equipped = g.equipped ? `<span class="gw-item-equipped">Э</span>` : "";
  return `
    <div class="gw-slot gw-slot-item ${g.equipped ? "gw-slot-equipped" : ""}"
         data-item="${g.ids[0]}" draggable="true"
         title="${escapeHtml(g.name)} · ЛКМ×2 — надеть/снять, тяни в хотбар (5-8)">
      <span class="gw-item-ico">${g.icon}</span>
      ${count}
      ${equipped}
    </div>`;
}

function renderInventoryHtml() {
  const groups = groupItems(items);
  const slots = [];

  for (let i = 0; i < INVENTORY_SLOTS; i++) {
    const g = groups[i];
    slots.push(
      g
        ? itemCellHtml(g)
        : `<div class="gw-slot" data-slot="${i}"></div>`
    );
  }

  const total = groups.reduce((n, g) => n + g.ids.length, 0);

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
      Экипировка 8 · Артефакты ${ARTIFACT_SLOTS} · Рюкзак ${INVENTORY_COLS}×${INVENTORY_ROWS} ·
      предметов: ${total} · наведи — описание, ЛКМ×2 — надеть/снять,
      тяни в хотбар (5-8), ПКМ по слоту — очистить
    </div>
  `;
}