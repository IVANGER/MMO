// Экран входа / регистрации

import { net } from "../net.js";
import { switchScene, getCurrentScene } from "./sceneManager.js";

const TOKEN_KEY = "hero_camp_token";

let mode = "login";
let message = null;
let busy = false;

export const loginScene = {

  onEnter() {
    mode = "login";
    message = null;
    busy = false;
    render();
  },

  onExit() {
    document.getElementById("app").innerHTML = "";
  },

  render,
};

// ============ Подписки на net ============

net.on("ok", (msg) => {
  if (msg.action === "registered" || msg.action === "loggedIn") {
    localStorage.setItem(TOKEN_KEY, msg.token);
    busy = false;
    message = { text: `Добро пожаловать, ${msg.user.nickname}!`, cls: "success" };
    render();

    setTimeout(() => {
      switchScene("character", { user: msg.user });
    }, 400);
  }

  if (msg.action === "resumed") {
    localStorage.setItem(TOKEN_KEY, msg.token);

    // НЕ переключаемся сами.
    // Если сервер пришлёт autoEnterWorld — main.js переключит в мир.
    // Если нет — через 300мс идём на character.
    setTimeout(() => {
      const cur = getCurrentScene();
      if (cur !== "world" && cur !== "death") {
        switchScene("character", { user: msg.user });
      }
    }, 300);
  }

  if (msg.action === "loggedOut") {
    localStorage.removeItem(TOKEN_KEY);
    switchScene("login");
  }
});

net.on("error", (msg) => {
  busy = false;
  message = { text: msg.message || "Ошибка", cls: "error" };
  render();
});

// ============ Рендер ============

function render() {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-box">
        <h1 class="auth-title">Hero Camp</h1>
        <div class="auth-tabs">
          <button class="auth-tab ${mode === "login" ? "active" : ""}" data-mode="login">Вход</button>
          <button class="auth-tab ${mode === "register" ? "active" : ""}" data-mode="register">Регистрация</button>
        </div>
        <form class="auth-form" id="auth-form">
          <input
            id="auth-nickname"
            type="text"
            placeholder="Ник (3-16)"
            autocomplete="username"
            maxlength="16"
            ${busy ? "disabled" : ""}
          />
          <input
            id="auth-password"
            type="password"
            placeholder="Пароль (6+)"
            autocomplete="current-password"
            maxlength="64"
            ${busy ? "disabled" : ""}
          />
          <button type="submit" class="auth-submit" ${busy ? "disabled" : ""}>
            ${busy ? "..." : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
        ${message ? `<div class="auth-msg ${message.cls}">${escapeHtml(message.text)}</div>` : ""}
      </div>
    </div>
  `;

  // Tabs
  app.querySelectorAll(".auth-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode;
      message = null;
      render();
    });
  });

  // Form
  const form = document.getElementById("auth-form");
  const nickInput = document.getElementById("auth-nickname");
  const passInput = document.getElementById("auth-password");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (busy) return;

    const nickname = nickInput.value.trim();
    const password = passInput.value;

    if (nickname.length < 3) {
      message = { text: "Ник минимум 3 символа", cls: "error" };
      return render();
    }
    if (password.length < 6) {
      message = { text: "Пароль минимум 6 символов", cls: "error" };
      return render();
    }

    busy = true;
    message = { text: mode === "login" ? "Вход..." : "Регистрация...", cls: "info" };
    render();

    net.send({ type: mode, nickname, password });
  });

  setTimeout(() => {
    const n = document.getElementById("auth-nickname");
    n?.focus();
  }, 50);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}