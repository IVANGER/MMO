// Всплывающая подсказка о предмете (День 13)
// Один DOM-элемент на весь клиент — переиспользуется при наведении на слоты.

const RARITY_COLORS = {
  common: "#cbd5e1",     // обычный — серый
  uncommon: "#4ade80",   // необычный — зелёный
  rare: "#60a5fa",       // редкий — синий
  epic: "#c084fc",       // эпический — фиолетовый
  legendary: "#fbbf24",  // легендарный — золотой
};

const RARITY_NAMES = {
  common: "Обычный",
  uncommon: "Необычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
};

const STAT_NAMES = {
  atk: "Атака",
  defense: "Защита",
  hp: "Здоровье",
  mp: "Мана",
  critChance: "Шанс крита",
  attackSpeed: "Скорость атаки",
};

let el = null;
let hideTimer = null;

function ensureEl() {
  if (el && el.isConnected) return el;
  el = document.createElement("div");
  el.className = "gw-tooltip";
  el.style.display = "none";
  document.getElementById("app").appendChild(el);
  return el;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

/**
 * Показать подсказку о предмете.
 * @param {object} item — предмет из сообщения inventory
 * @param {number} x — координата курсора (clientX)
 * @param {number} y — координата курсора (clientY)
 */
export function showTooltip(item, x, y) {
  if (!item) return;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  const tip = ensureEl();
  tip.innerHTML = renderTooltipHtml(item);

  // Показываем, чтобы измерить, потом уводим от правого/нижнего края
  tip.style.display = "block";
  tip.style.left = "0px";
  tip.style.top = "0px";

  const rect = tip.getBoundingClientRect();
  const pad = 12;
  let left = x + 16;
  let top = y + 16;

  if (left + rect.width + pad > window.innerWidth) {
    left = x - rect.width - 16;
  }
  if (top + rect.height + pad > window.innerHeight) {
    top = y - rect.height - 16;
  }

  tip.style.left = `${Math.max(pad, left)}px`;
  tip.style.top = `${Math.max(pad, top)}px`;
}

/** Скрыть подсказку (с небольшой задержкой — чтобы успел сработать переход между слотами) */
export function hideTooltip(delay = 0) {
  if (!el) return;
  if (hideTimer) clearTimeout(hideTimer);

  if (delay <= 0) {
    el.style.display = "none";
    hideTimer = null;
    return;
  }

  hideTimer = setTimeout(() => {
    if (el) el.style.display = "none";
    hideTimer = null;
  }, delay);
}

export function isTooltipVisible() {
  return !!el && el.style.display !== "none";
}

// ============ Отрисовка содержимого ============

function renderTooltipHtml(item) {
  const color = RARITY_COLORS[item.rarity] ?? RARITY_COLORS.common;
  const rarityName = RARITY_NAMES[item.rarity] ?? "Обычный";

  const rows = [];

  // Описание
  if (item.description) {
    rows.push(`<div class="gw-tip-desc">${escapeHtml(item.description)}</div>`);
  }

  // Бонусы (оружие/броня)
  if (item.bonuses) {
    const bonusLines = Object.entries(item.bonuses)
      .filter(([, v]) => v !== 0)
      .map(([stat, value]) => {
        const sign = value > 0 ? "+" : "";
        return `<div class="gw-tip-bonus">${STAT_NAMES[stat] ?? stat}: ${sign}${value}</div>`;
      });
    if (bonusLines.length) rows.push(`<div class="gw-tip-block">${bonusLines.join("")}</div>`);
  }

  // Эффект (расходники)
  if (item.effect) {
    const e = item.effect;
    if (e.type === "heal") {
      rows.push(`<div class="gw-tip-bonus">Восстанавливает ${e.hp} HP</div>`);
    } else if (e.type === "damage") {
      rows.push(`<div class="gw-tip-bonus">Урон: ${e.amount ?? "?"}</div>`);
    }
    if (item.cooldown > 0) {
      rows.push(`<div class="gw-tip-note">Кулдаун: ${item.cooldown} сек</div>`);
    }
  }

  // Требования
  if (item.requires?.level) {
    rows.push(`<div class="gw-tip-req">Требуется уровень ${item.requires.level}</div>`);
  }

  // Цена
  if (item.price > 0) {
    rows.push(`<div class="gw-tip-price">💰 ${item.price} золота</div>`);
  }

  const equipHint = item.equipped
    ? `<div class="gw-tip-note">Надето</div>`
    : `<div class="gw-tip-note">Двойной клик — надеть/снять</div>`;

  return `
    <div class="gw-tip-head">
      <span class="gw-tip-icon">${item.icon}</span>
      <div class="gw-tip-titles">
        <div class="gw-tip-name" style="color:${color}">${escapeHtml(item.name)}</div>
        <div class="gw-tip-rarity" style="color:${color}">${rarityName}${item.tier > 1 ? ` · ур. ${item.tier}` : ""}</div>
      </div>
    </div>
    ${rows.join("")}
    ${item.slot !== "consumable" ? equipHint : ""}
  `;
}