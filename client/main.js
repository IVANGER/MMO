// Точка входа клиента

import { net } from "./net.js";
import { preloadSprites } from "./render/spriteLoader.js";
import { registerScene, switchScene, getCurrentScene } from "./scenes/sceneManager.js";
import { loginScene } from "./scenes/loginScene.js";
import { characterScene } from "./scenes/characterScene.js";
import { createCharacterScene } from "./scenes/createCharacterScene.js";
import { worldScene } from "./scenes/worldScene.js";
import { deathScene } from "./scenes/deathScene.js";

registerScene("login", loginScene);
registerScene("character", characterScene);
registerScene("createCharacter", createCharacterScene);
registerScene("world", worldScene);
registerScene("death", deathScene);

net.on("_open", () => {
  console.log("[main] WS connected");

  const cur = getCurrentScene();
  const token = localStorage.getItem("hero_camp_token");

  // Если мы в игре и есть токен — resume (восстановление)
  if ((cur === "world" || cur === "death") && token) {
    net.send({ type: "resume", token });
  } else if (token && !cur) {
    // Первый вход с токеном — пробуем resume
    net.send({ type: "resume", token });
  } else {
    // Токена нет — на логин
    switchScene("login");
  }
});

// Сервер сам говорит "зайди в мир этим персонажем"
net.on("autoEnterWorld", (msg) => {
  net.send({ type: "enterWorld", characterId: msg.characterId });
});

// Если resume не удался (токен истёк)
net.on("error", (msg) => {
  if (msg.message === "Токен недействителен") {
    localStorage.removeItem("hero_camp_token");
    switchScene("login");
  }
});

net.on("_close", () => {
  console.log("[main] WS disconnected");
});

console.log("Hero Camp client starting...");

// Часть 9 (PNG): пробуем заранее загрузить спрайты тайлов и объектов.
// Если файлов нет — spriteLoader молча уходит на цветные квадраты.
preloadSprites().catch(() => {});

net.connect();