// Окно персонажа (клавиша B) — День 10
// Аватарка, имя, класс, полоска уровня (XP), базовые и вторичные характеристики.
// Это DOM-оверлей поверх игрового canvas (рисовать в canvas неудобно — много текста).

import { ATTRIBUTES, ATTR_ORDER } from "../../shared/attributes.js";

export const CHARACTER_WINDOW_KEY = "b";

let el = null;
let open = false;

export function isCharacterWindowOpen() {
  return open;
}

/**
 * Показать/скрыть окно персонажа.
 * @param {object|null} you — данные персонажа (you из worldEntered)
 * @returns {boolean} новое состояние
 */
export function toggleCharacterWindow(you) {
  if (open) {
    closeCharacterWindow();
    return false;
  }
  showCharacterWindow(you);
  return true;
}

function showCharacterWindow(you) {
  closeCharacterWindow();
  if (!you) return;

  el = document.createElement("div");
  el.className = "gw-window gw-character";
  el.innerHTML = renderCharacterHtml(you);
  document.getElementById("app").appendChild(el);
  open = true;
}

export function closeCharacterWindow() {
  if (el) el.remove();
  el = null;
  open = false;
}

// ============ Отрисовка ============

function renderCharacterHtml(you) {
  const attrs = you.attrs ?? {};
  const level = you.level ?? 1;
  const xp = you.xp ?? 0;
  const xpToNext = you.xpToNext ?? 100;
  const xpPct = Math.max(0, Math.min(100, (xp / Math.max(1, xpToNext)) * 100));

  const attrRows = ATTR_ORDER.map((code) => {
    const a = ATTRIBUTES[code];
    const value = attrs[code] ?? 0;
    return `
      <div class="gw-attr">
        <span class="gw-attr-icon" title="${a.desc}">${a.icon}</span>
        <span class="gw-attr-name">${a.name}</span>
        <span class="gw-attr-value">${value}</span>
      </div>`;
  }).join("");

  return `
    <div class="gw-window-head">
      <span class="gw-window-title">Персонаж</span>
      <span class="gw-window-hint">B — закрыть</span>
    </div>

    <div class="gw-char-head">
      <div class="gw-avatar">${you.classIcon ?? "⚔️"}</div>
      <div class="gw-char-info">
        <div class="gw-char-name">${escapeHtml(you.name ?? "")}</div>
        <div class="gw-char-class">${escapeHtml(you.className ?? you.class ?? "")} · уровень ${level}</div>
        ${you.attrPoints > 0 ? `<div class="gw-points">Свободных очков: ${you.attrPoints}</div>` : ""}
      </div>
    </div>

    <div class="gw-xp">
      <div class="gw-xp-label">
        <span>Опыт</span>
        <span>${xp} / ${xpToNext}</span>
      </div>
      <div class="gw-xp-bar"><div class="gw-xp-fill" style="width:${xpPct}%"></div></div>
    </div>

    <div class="gw-section-title">Базовые характеристики</div>
    <div class="gw-attrs">${attrRows}</div>

    <div class="gw-section-title">Вторичные параметры</div>
    <div class="gw-derived">
      ${derivedRow("❤️", "Здоровье", you.hp, you.maxHp)}
      ${derivedRow("💧", "Мана", you.mp, you.maxMp)}
      ${derivedRow("⚔️", "Атака", you.atk)}
      ${derivedRow("🛡️", "Защита", you.defense)}
      ${derivedRow("🏃", "Скорость хода", Number(you.speed ?? 2.0).toFixed(1), " кл/сек")}
    </div>
  `;
}

function derivedRow(icon, name, value, unit = "") {
  return `
    <div class="gw-derived-row">
      <span class="gw-derived-icon">${icon}</span>
      <span class="gw-derived-name">${name}</span>
      <span class="gw-derived-value">${value ?? 0}${unit}</span>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
