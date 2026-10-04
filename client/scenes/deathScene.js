// Экран "Ты мёртв"

import { net } from "../net.js";
import { switchScene } from "./sceneManager.js";

let killedBy = null;
let busy = false;

export const deathScene = {
  onEnter(payload) {
    killedBy = payload?.killedBy ?? null;
    busy = false;
    render();
  },

  onExit() {
    document.getElementById("app").innerHTML = "";
  },

  render,
};

net.on("respawned", (msg) => {
  // Сервер возродил — переключаемся в мир
  switchScene("world", msg);
});

function render() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="death-screen">
      <div class="death-box">
        <div class="death-skull">💀</div>
        <h1 class="death-title">Ты мёртв</h1>
        ${killedBy ? `<p class="death-killer">Убит: ${escapeHtml(killedBy)}</p>` : ""}
        <p class="death-info">Ты потерял 10% опыта</p>
        <button class="auth-submit" id="respawn-btn" ${busy ? "disabled" : ""}>
          ${busy ? "..." : "Возродиться"}
        </button>
      </div>
    </div>
  `;

  document.getElementById("respawn-btn").addEventListener("click", () => {
    if (busy) return;
    busy = true;
    render();
    net.send({ type: "respawn" });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}