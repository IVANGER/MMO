// Экран создания персонажа

import { net } from "../net.js";
import { switchScene } from "./sceneManager.js";

let slotIndex = 0;
let classes = [];
let selectedClass = null;
let name = "";
let message = null;
let busy = false;
let onBack = null;

export const createCharacterScene = {
  onEnter(payload) {
    slotIndex = payload?.slot ?? 0;
    classes = payload?.classes ?? [];
    selectedClass = classes[0]?.type ?? null;
    name = "";
    message = null;
    busy = false;
    onBack = payload?.onBack ?? null;
    render();
  },

  onExit() {
    document.getElementById("app").innerHTML = "";
  },

  render,
};

net.on("characters", () => {
  // После создания или ошибки сервер шлёт "characters" —
  // значит, успешно или нужно вернуться
  if (busy) {
    busy = false;
    switchScene("character");
  }
});

net.on("error", (msg) => {
  if (msg.action === "character") {
    busy = false;
    message = { text: msg.message, cls: "error" };
    render();
  }
});

function render() {
  const app = document.getElementById("app");
  if (!app) return;

  const classesHtml = classes.map((c) => `
    <div class="class-option ${c.type === selectedClass ? "selected" : ""}" data-class="${c.type}">
      <div class="class-icon">${c.icon}</div>
      <div class="class-name">${escapeHtml(c.name)}</div>
      <div class="class-desc">${escapeHtml(c.description)}</div>
      <div class="class-stats">
        ❤️ ${c.baseStats.max_hp}
        ⚔️ ${c.baseStats.atk}
        🛡️ ${c.baseStats.defense}
      </div>
    </div>
  `).join("");

  app.innerHTML = `
    <div class="character-screen">
      <div class="auth-box create-box">
        <h2 class="auth-title">Новый персонаж</h2>
        <p class="slots-user">Слот ${slotIndex + 1}</p>

        <form class="auth-form" id="create-form">
          <input
            id="char-name"
            type="text"
            placeholder="Имя персонажа (3-16)"
            maxlength="16"
            value="${escapeHtml(name)}"
            ${busy ? "disabled" : ""}
          />

          <div class="classes-grid">${classesHtml}</div>

          <div class="create-actions">
            <button type="button" class="auth-submit secondary" id="back-btn">Назад</button>
            <button type="submit" class="auth-submit" ${busy ? "disabled" : ""}>
              ${busy ? "..." : "Создать"}
            </button>
          </div>
        </form>

        ${message ? `<div class="auth-msg ${message.cls}">${escapeHtml(message.text)}</div>` : ""}
      </div>
    </div>
  `;

  // Выбор класса
  app.querySelectorAll(".class-option").forEach((el) => {
    el.addEventListener("click", () => {
      selectedClass = el.dataset.class;
      render();
    });
  });

  // Форма
  const form = document.getElementById("create-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;

    const input = document.getElementById("char-name");
    name = input.value.trim();

    if (name.length < 3) {
      message = { text: "Имя минимум 3 символа", cls: "error" };
      return render();
    }
    if (!selectedClass) {
      message = { text: "Выбери класс", cls: "error" };
      return render();
    }

    busy = true;
    message = { text: "Создание...", cls: "info" };
    render();

    net.send({
      type: "createCharacter",
      slot: slotIndex,
      name,
      class: selectedClass,
    });
  });

  // Назад
  document.getElementById("back-btn").addEventListener("click", () => {
    onBack?.();
  });

  // Фокус на имя
  setTimeout(() => document.getElementById("char-name")?.focus(), 50);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}