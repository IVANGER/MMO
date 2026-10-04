// Экран выбора персонажа (6 слотов)

import { net } from "../net.js";
import { switchScene } from "./sceneManager.js";

let user = null;
let slots = [null, null, null, null, null, null];
let classes = [];
let maxSlots = 6;
let message = null;
let loading = true;

export const characterScene = {
  onEnter(payload) {
    user = payload?.user ?? user;
    loading = true;
    message = null;
    render();
    net.send({ type: "getCharacters" });
  },

  onExit() {
    document.getElementById("app").innerHTML = "";
  },

  render,
};

// ============ Подписки ============

net.on("characters", (msg) => {
  slots = msg.slots;
  classes = msg.classes ?? [];
  maxSlots = msg.maxSlots ?? 6;
  loading = false;
  render();
});

net.on("characterCreated", (msg) => {
  message = { text: `Создан: ${msg.character.name}`, cls: "success" };
  render();
});

net.on("characterDeleted", () => {
  message = { text: "Персонаж удалён", cls: "info" };
  render();
});

net.on("characterSelected", (msg) => {
  // Сервер подтвердил выбор — входим в мир
  net.send({ type: "enterWorld", characterId: msg.character.id });
});

net.on("error", (msg) => {
  if (msg.action === "character") {
    message = { text: msg.message, cls: "error" };
    render();
  }
});

// ============ Рендер ============

function render() {
  const app = document.getElementById("app");
  if (!app) return;

  if (loading) {
    app.innerHTML = `
      <div class="character-screen">
        <div class="character-box">
          <h2>Загрузка...</h2>
        </div>
      </div>
    `;
    return;
  }

  const slotsHtml = slots.map((c, i) => renderSlot(c, i)).join("");

  app.innerHTML = `
    <div class="character-screen">
      <div class="slots-box">
        <div class="slots-header">
          <div>
            <h2>Выбор персонажа</h2>
            <p class="slots-user">${escapeHtml(user?.nickname ?? "игрок")}</p>
          </div>
          <button class="logout-btn" id="logout-btn">Выйти</button>
        </div>

        ${message ? `<div class="auth-msg ${message.cls}">${escapeHtml(message.text)}</div>` : ""}

        <div class="slots-grid">
          ${slotsHtml}
        </div>
      </div>
    </div>
  `;

  app.querySelectorAll(".slot").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.slot);
      const char = slots[idx];

      if (char) {
        showCharacterMenu(char);
      } else {
        openCreateScene(idx);
      }
    });
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    net.send({ type: "logout" });
  });
}

function renderSlot(char, idx) {
  if (!char) {
    return `
      <div class="slot empty" data-slot="${idx}">
        <div class="slot-plus">+</div>
        <div class="slot-label">Слот ${idx + 1}</div>
      </div>
    `;
  }

  return `
    <div class="slot filled" data-slot="${idx}">
      <div class="slot-icon">${char.classIcon}</div>
      <div class="slot-name">${escapeHtml(char.name)}</div>
      <div class="slot-class">${escapeHtml(char.className)} · Ур. ${char.level}</div>
      <div class="slot-slot">Слот ${idx + 1}</div>
    </div>
  `;
}

function showCharacterMenu(char) {
  const action = confirm(
    `Персонаж: ${char.name} (${char.className}, Ур. ${char.level})\n\n` +
    `OK — войти в мир\nОтмена — удалить персонажа`
  );

  if (action) {
    net.send({ type: "selectCharacter", characterId: char.id });
  } else {
    if (confirm(`Удалить персонажа "${char.name}"? Это нельзя отменить.`)) {
      net.send({ type: "deleteCharacter", characterId: char.id });
    }
  }
}

function openCreateScene(slotIndex) {
  switchScene("createCharacter", {
    slot: slotIndex,
    classes,
    onBack: () => switchScene("character", { user }),
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}