// Экран мира (Canvas 2D): интерполяция, объекты, мобы, HUD

import { net } from "../net.js";
import { switchScene, getCurrentScene } from "./sceneManager.js";
import { renderWorld } from "../render/renderWorld.js";
import { renderPath } from "../render/renderPath.js";
import { renderHUD, HUD_HEIGHT, hotbarSlotAt } from "../render/renderHUD.js";
import { preloadSprites } from "../render/spriteLoader.js";
import { findPath, isCellWalkable } from "../../shared/pathfinding.js";

// Окна Дня 10: B — персонаж, I — инвентарь, M — карта мира
import {
  toggleCharacterWindow,
  closeCharacterWindow,
  isCharacterWindowOpen,
} from "../ui/characterWindow.js";
import {
  toggleInventoryWindow,
  closeInventoryWindow,
  isInventoryWindowOpen,
  setInventoryItems,
  getDraggingItemId,
} from "../ui/inventory.js";
import {
  toggleWorldMapWindow,
  closeWorldMapWindow,
  refreshWorldMapWindow,
  isWorldMapWindowOpen,
} from "../ui/targetInfo.js";
import { onKey } from "../input/keyboard.js";

let canvas = null;
let ctx = null;
let location = null;
let you = null;
let entities = new Map();
let otherEntities = [];

let camera = { x: 0, y: 0 };
let tileSize = 32;
let viewport = { width: 0, height: 0 };        // весь игровой экран (без топбара)
let worldViewport = { width: 0, height: 0 };   // только игровая область (без HUD)

let currentPath = [];
let pathInvalid = null;
let attackTargetId = null;   // текущая цель автоатаки (День 10)

// Состояние Дня 12: навыки 1-4, хотбар 5-8, инвентарь, зелья
let skillsList = [];                        // [{id, name, icon, cooldownUntil}] в порядке слотов
let hotbarSlots = [null, null, null, null]; // itemId в слотах хотбара
let inventoryItems = [];                    // предметы с сервера
let potionCooldownUntil = 0;                // общий кулдаун зелий (мс)
let notice = null;                          // всплывающая строка над HUD {text, until}

const MIN_TILE_SIZE = 16;
const MAX_TILE_SIZE = 96;
const TOOLBAR_HEIGHT = 60;

// ============ Интерполяция ============
const INTERP_SPEED_PLAYER = 8;   // клеток/сек — плавный догон чужого игрока
const INTERP_SPEED_MOB = 15;     // мобы «дёргаются» сильнее — догоняем быстрее (День 10)
const TELEPORT_TILES = 5;        // разница больше — телепорт без интерполяции
const SELF_TELEPORT_TILES = 4;   // своя позиция расходится настолько — телепорт (переход, читы)
const CORRECT_THRESHOLD = 1.2;   // фазовое расхождение с тиками ≤1 клетки; больше — подтягиваем
const CORRECT_SPEED = 8;         // клеток/сек — скорость плавной коррекции к серверу

let spritesReady = false;

export const worldScene = {
  onEnter(payload) {
    applyWorldData(payload);
    createCanvas();
    resize();
    render();

    // Клавиши Дня 10: B / I / M / Esc
    offKey = onKey(handleKey);

    // PNG-спрайты (если есть) — после загрузки перерисуем
    if (!spritesReady) {
      preloadSprites().then(() => {
        spritesReady = true;
        render();
      });
    }
  },

  onExit() {
    document.getElementById("app").innerHTML = "";
    window.removeEventListener("resize", resize);
    offKey?.();
    offKey = null;
    closeAllWindows();
    attackTargetId = null;
    canvas = null;
    ctx = null;
  },

  render,
};

let offKey = null;

// ============ Клавиши (День 10) ============

function handleKey(key) {
  // B — окно персонажа
  if (key === "b" || key === "и") {
    closeOtherWindows("character");
    toggleCharacterWindow(you);
    return true;
  }

  // I — инвентарь
  if (key === "i" || key === "ш") {
    closeOtherWindows("inventory");
    toggleInventoryWindow();
    return true;
  }

  // M — карта мира
  if (key === "m" || key === "ь") {
    closeOtherWindows("map");
    toggleWorldMapWindow(location, location?.region);
    return true;
  }

  // Esc — закрыть окно / отменить атаку
  if (key === "escape") {
    if (isAnyWindowOpen()) {
      closeAllWindows();
      return true;
    }
    if (attackTargetId) {
      attackTargetId = null;
      net.send({ type: "stopAttack" });
      render();
      return true;
    }
    return false;
  }

  // ============ 1-4 — навыки (День 12) ============
  if (key >= "1" && key <= "4") {
    const skill = skillsList[Number(key) - 1];
    if (skill) {
      net.send({ type: "useSkill", skillId: skill.id, targetId: attackTargetId });
    } else {
      showNotice("Слот навыка пуст");
    }
    return true;
  }

  // ============ 5-8 — хотбар: использование предмета (День 12) ============
  if (key >= "5" && key <= "8") {
    const itemId = hotbarSlots[Number(key) - 5];
    if (itemId) {
      net.send({ type: "useItem", itemId });
    } else {
      showNotice("Слот хотбара пуст — перетащи зелье (клавиша I)");
    }
    return true;
  }

  return false;
}

function closeOtherWindows(keep) {
  if (keep !== "character") closeCharacterWindow();
  if (keep !== "inventory") closeInventoryWindow();
  if (keep !== "map") closeWorldMapWindow();
}

function closeAllWindows() {
  closeCharacterWindow();
  closeInventoryWindow();
  closeWorldMapWindow();
}

function isAnyWindowOpen() {
  return isCharacterWindowOpen() || isInventoryWindowOpen() || isWorldMapWindowOpen();
}

// ============ Данные мира ============

function applyWorldData(payload) {
  location = payload?.location ?? null;
  you = payload?.you ?? null;

  entities.clear();
  for (const e of payload?.entities ?? []) {
    entities.set(e.id, withTarget(e));
  }
  if (you) {
    you = withTarget(you);
    you.serverX = you.x;   // серверная позиция для плавной коррекции
    you.serverY = you.y;
    entities.set(you.id, you);
  }
  rebuildOthers();

  currentPath = [];
  pathInvalid = null;

  updateTopbar();
}

// Сущность: x/y — позиция отрисовки, targetX/targetY — куда плавно догоняем
function withTarget(e) {
  e.targetX = e.x;
  e.targetY = e.y;
  return e;
}

function rebuildOthers() {
  otherEntities = [...entities.values()].filter((e) => e.id !== you?.id);
}

// ============ Canvas ============

function createCanvas() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="world-screen">
      <div class="world-topbar">
        <span class="world-location" id="loc-name">${escapeHtml(location?.name ?? "Мир")}</span>
        <span class="world-coords" id="coords">(${you?.x ?? 0}, ${you?.y ?? 0})</span>
        <span class="world-zoom" id="zoom">×1.0</span>
        <button class="world-exit" id="exit-btn">Выход</button>
      </div>
      <div class="world-viewport" id="viewport">
        <canvas id="world-canvas"></canvas>
      </div>
    </div>
  `;

  canvas = document.getElementById("world-canvas");
  ctx = canvas.getContext("2d", { alpha: false });

  canvas.addEventListener("click", onCanvasClick);
  canvas.addEventListener("contextmenu", onCanvasContextMenu);

  // Drag & Drop: предмет из инвентаря → слот хотбара (День 12)
  canvas.addEventListener("dragover", (e) => {
    if (hotbarSlotFromEvent(e) >= 0) e.preventDefault();
  });
  canvas.addEventListener("drop", onCanvasDrop);

  document.getElementById("exit-btn").addEventListener("click", () => {
    if (confirm("Выйти из игры?")) {
      net.send({ type: "logout" });
    }
  });

  window.addEventListener("resize", resize);
}

function updateTopbar() {
  const el = document.getElementById("loc-name");
  if (el) el.textContent = location?.name ?? "Мир";
}

// ============ Resize ============

function resize() {
  if (!canvas || !location) return;

  const w = window.innerWidth;
  const h = window.innerHeight - TOOLBAR_HEIGHT;

  viewport.width = w;
  viewport.height = h;

  // Игровая область — без полосы HUD
  worldViewport.width = w;
  worldViewport.height = Math.max(120, h - HUD_HEIGHT);

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const TARGET_TILES_VERTICAL = 15;
  const raw = Math.floor(worldViewport.height / TARGET_TILES_VERTICAL);
  tileSize = Math.max(MIN_TILE_SIZE, Math.min(MAX_TILE_SIZE, raw));

  updateCamera();
  render();
}

// ============ Камера ============

function updateCamera() {
  if (!you || !location) return;

  const vw = worldViewport.width;
  const vh = worldViewport.height;

  const worldPxW = location.width * tileSize;
  const worldPxH = location.height * tileSize;

  const px = (you.x + 0.5) * tileSize;
  const py = (you.y + 0.5) * tileSize;

  let camX = vw / 2 - px;
  let camY = vh / 2 - py;

  if (worldPxW <= vw) {
    camX = (vw - worldPxW) / 2;
  } else {
    camX = Math.min(0, Math.max(vw - worldPxW, camX));
  }

  if (worldPxH <= vh) {
    camY = (vh - worldPxH) / 2;
  } else {
    camY = Math.min(0, Math.max(vh - worldPxH, camY));
  }

  camera.x = Math.round(camX);
  camera.y = Math.round(camY);
}

// ============ Рендер ============

function render() {
  if (!ctx || !location) return;

  ctx.fillStyle = "#0a0f1e";
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  // Мир
  ctx.save();
  ctx.translate(camera.x, camera.y);

  renderWorld(ctx, {
    location,
    you,
    entities: otherEntities,
    tileSize,
    showGrid: true,
  });

  if (currentPath.length > 0) {
    renderPath(ctx, { path: currentPath, tileSize, valid: true });
  }
  if (pathInvalid) {
    renderPath(ctx, {
      path: [{ x: pathInvalid.x, y: pathInvalid.y }],
      tileSize,
      valid: false,
    });
  }

  // Цифры урона над мобами (День 10)
  if (damageNumbers.length > 0) drawDamageNumbers(ctx);

  // Подсветка текущей цели атаки (День 10)
  drawAttackTarget(ctx);

  ctx.restore();

  // HUD (поверх мира, в экранных координатах)
  renderHUD(ctx, {
    width: viewport.width,
    height: viewport.height,
    you,
    location,
    skills: skillsView(),   // День 12: иконки + кулдауны
    hotbar: hotbarView(),   // День 12: иконки предметов + кулдаун зелья
  });

  drawNotice(ctx);

  const coords = document.getElementById("coords");
  if (coords && you) coords.textContent = `(${you.x.toFixed(1)}, ${you.y.toFixed(1)})`;

  const zoom = document.getElementById("zoom");
  if (zoom) zoom.textContent = `×${(tileSize / 32).toFixed(1)}`;
}

// ============ HUD Дня 12: вид слотов, уведомления, хотбар ============

function skillsView() {
  return skillsList.slice(0, 4).map((s) => ({
    icon: s.icon,
    cooldownUntil: s.cooldownUntil ?? 0,
  }));
}

function hotbarView() {
  return hotbarSlots.map((itemId) => {
    if (!itemId) return null;
    const item = inventoryItems.find((i) => i.id === itemId);
    return {
      icon: item?.icon ?? "🧪",
      name: item?.name ?? "",
      // Общий кулдаун зелий — гасим слот, даже если предмет уже не в списке
      cooldownUntil: potionCooldownUntil,
    };
  });
}

function showNotice(text, ms = 1600) {
  notice = { text, until: Date.now() + ms };
}

function drawNotice(ctx) {
  if (!notice) return;
  if (Date.now() > notice.until) {
    notice = null;
    return;
  }

  const y = viewport.height - HUD_HEIGHT - 16;
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const w = ctx.measureText(notice.text).width + 20;
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  ctx.fillRect(viewport.width / 2 - w / 2, y - 11, w, 22);
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1;
  ctx.strokeRect(viewport.width / 2 - w / 2 + 0.5, y - 10.5, w - 1, 21);

  ctx.fillStyle = "#f8fafc";
  ctx.fillText(notice.text, viewport.width / 2, y);
}

// ============ Хотбар: drag & drop и ПКМ (День 12) ============

function hotbarSlotFromEvent(e) {
  if (!canvas) return -1;
  const rect = canvas.getBoundingClientRect();
  return hotbarSlotAt(
    e.clientX - rect.left,
    e.clientY - rect.top,
    viewport.width,
    viewport.height
  );
}

function onCanvasDrop(e) {
  const slot = hotbarSlotFromEvent(e);
  if (slot < 0) return;
  e.preventDefault();

  const itemId = e.dataTransfer?.getData("text/plain") || getDraggingItemId();
  if (!itemId) return;

  net.send({ type: "setHotbarSlot", slotIndex: slot, itemId });
}

function onCanvasContextMenu(e) {
  e.preventDefault();
  const slot = hotbarSlotFromEvent(e);
  if (slot < 0 || !hotbarSlots[slot]) return;

  net.send({ type: "clearHotbarSlot", slotIndex: slot });
  showNotice("Слот хотбара очищен");
}

// ============ Клик ============

function onCanvasClick(e) {
  if (!location || !you) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Клик по полосе HUD — не команда движения
  if (my > worldViewport.height) return;

  const worldPx = mx - camera.x;
  const worldPy = my - camera.y;

  const tx = Math.floor(worldPx / tileSize);
  const ty = Math.floor(worldPy / tileSize);

  if (tx < 0 || tx >= location.width || ty < 0 || ty >= location.height) return;

  // ============ 1. Клик по мобу → автоатака (День 10) ============
  // Проверяем ДО движения: моб под курсором = цель, а не точка пути
  const mob = findMobAtCell(tx, ty);
  if (mob) {
    attackTargetId = mob.id;
    net.send({ type: "attack", targetId: mob.id });
    render();
    return;
  }

  // Клик по земле — снимаем атаку, если она была
  if (attackTargetId) {
    attackTargetId = null;
    net.send({ type: "stopAttack" });
  }

  // ============ 2. Иначе — движение ============

  // Непроходимо (тайл или объект) — красная подсветка
  if (!isCellWalkable(location, tx, ty)) {
    flashInvalid(tx, ty);
    return;
  }

  const occupied = new Set();
  for (const ent of entities.values()) {
    if (ent.id === you.id) continue;
    occupied.add(`${Math.round(ent.x)},${Math.round(ent.y)}`);
  }

  const startX = Math.round(you.x);
  const startY = Math.round(you.y);

  const path = findPath(
    location,
    { x: startX, y: startY },
    { x: tx, y: ty },
    { occupied }
  );

  if (!path) {
    flashInvalid(tx, ty);
    return;
  }

  // Дальность хода (День 10): ограничение убрано — идём по всему пути
  currentPath = path;
  you.path = path;
  you.state = path.length > 0 ? "moving" : "idle";

  net.send({ type: "moveTo", x: tx, y: ty });

  render();
}

function flashInvalid(x, y) {
  pathInvalid = { x, y };
  currentPath = [];
  if (you) {
    you.path = [];
    you.state = "idle";
  }
  render();
  setTimeout(() => {
    pathInvalid = null;
    render();
  }, 400);
}

// Рамка вокруг моба, по которому идёт автоатака (День 10)
function drawAttackTarget(ctx) {
  if (!attackTargetId) return;

  const mob = entities.get(attackTargetId);
  if (!mob) return;

  const cx = (mob.x + 0.5) * tileSize;
  const cy = (mob.y + 0.5) * tileSize;
  const r = tileSize * 0.42 * (mob.size ?? 1);

  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Моб на клетке (по округлённым координатам) — для клика по нему
function findMobAtCell(x, y) {
  for (const e of entities.values()) {
    if (e.type !== "mob") continue;
    if (Math.round(e.x) === x && Math.round(e.y) === y) return e;
  }
  return null;
}

// ============ Анимация (своё движение + интерполяция чужих) ============

let lastFrame = performance.now();

function animate() {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;

  moveSelf(dt);
  interpolateOthers(dt);

  updateCamera();
  render();

  requestAnimationFrame(animate);
}

// Своё движение — сразу по пути (как было)
function moveSelf(dt) {
  if (!you || !you.path || you.path.length === 0) return;

  const speed = you.speed ?? 4.0;   // скорость СЕРВЕРА (раньше хардкод 4.0 против серверных 5.0)
  let remaining = speed * dt;

  while (remaining > 0 && you.path.length > 0) {
    const next = you.path[0];
    const dx = next.x - you.x;
    const dy = next.y - you.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    if (dist <= remaining) {
      you.x = next.x;
      you.y = next.y;
      you.path.shift();
      remaining -= dist;
    } else {
      const step = remaining / dist;
      you.x = you.x + dx * step;
      you.y = you.y + dy * step;
      remaining = 0;
    }
  }

  if (you.path.length === 0) {
    you.state = "idle";
    currentPath = [];
  }
}

// Чужие сущности (игроки, мобы) — плавно догоняют серверную позицию
function interpolateOthers(dt) {
  if (otherEntities.length === 0) return;

  for (const e of otherEntities) {
    // Мобы обновляются реже и рывками — им нужен более быстрый догон
    const speed = e.type === "mob" ? INTERP_SPEED_MOB : INTERP_SPEED_PLAYER;
    const step = speed * dt;

    const tx = e.targetX ?? e.x;
    const ty = e.targetY ?? e.y;

    const dx = tx - e.x;
    const dy = ty - e.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.001) {
      e.x = tx;
      e.y = ty;
      continue;
    }

    if (dist <= step) {
      e.x = tx;
      e.y = ty;
    } else {
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
    }
  }
}

requestAnimationFrame(animate);

// ============ Серверные апдейты ============

net.on("worldEntered", (msg) => {
  applyWorldData(msg);

  // День 12: навыки, инвентарь и хотбар запрашиваем при каждом входе в мир
  net.send({ type: "getSkills" });
  net.send({ type: "getInventory" });
  net.send({ type: "getHotbar" });

  if (msg.dead) {
    // Игрок мёртв — переключаемся на death scene
    switchScene("death", { killedBy: msg.killedBy });
    return;
  }

  if (getCurrentScene() !== "world") {
    switchScene("world", msg);
  } else {
    createCanvas();
    resize();
    render();
  }
});

// Переход между локациями (Часть 6)
net.on("locationChange", (msg) => {
  applyWorldData(msg);

  // Карта мира открыта — обновляем содержимое (новый район)
  refreshWorldMapWindow(location, location?.region);

  // Сообщение о переходе (если сервер прислал)
  if (msg.direction && msg.location?.name) {
    console.log(`[world] переход: ${msg.direction} → ${msg.location.name}`);
  }

  render();
});

net.on("pathFound", (msg) => {
  const goalX = msg.x;
  const goalY = msg.y;

  // Уже идём к той же цели — локальный путь (от НАШЕЙ позиции) точнее серверного,
  // который начинается от расходящейся серверной точки (иначе телепорт назад)
  const curGoal = currentPath[currentPath.length - 1];
  const sameGoal = curGoal && curGoal.x === goalX && curGoal.y === goalY;

  if (!sameGoal && you && location) {
    // Иначе — строим путь от текущей позиции, а не принимаем серверный вслепую
    const np = findPath(
      location,
      { x: Math.round(you.x), y: Math.round(you.y) },
      { x: goalX, y: goalY }
    );
    currentPath = np ?? [];
    you.path = [...currentPath];
  }

  if (you) {
    you.state = currentPath.length > 0 ? "moving" : "idle";
  }
  render();
});

net.on("pathNotFound", (msg) => {
  flashInvalid(msg.x, msg.y);
});

net.on("entityMoved", (msg) => {
  for (const upd of msg.entities) {
    const e = entities.get(upd.id);
    if (!e) continue;

    if (e.id === you?.id) {
      // Своё движение: запоминаем серверную позицию для плавной коррекции.
      // Резкий снап — только при телепорте (переход, читы): иначе рывки.
      you.serverX = upd.x;
      you.serverY = upd.y;
      const dist = Math.hypot(upd.x - you.x, upd.y - you.y);
      if (dist > SELF_TELEPORT_TILES) {
        you.x = upd.x;
        you.y = upd.y;
        you.targetX = upd.x;
        you.targetY = upd.y;
        currentPath = [];   // путь начинался от старой точки — сбрасываем
        you.path = [];
      }
      you.state = upd.state;
      continue;
    }

    // Чужие — плавно (телепорт, если разница слишком большая)
    const dist = Math.hypot(upd.x - e.x, upd.y - e.y);
    if (dist > TELEPORT_TILES) {
      e.x = upd.x;
      e.y = upd.y;
      e.targetX = upd.x;
      e.targetY = upd.y;
    } else {
      e.targetX = upd.x;
      e.targetY = upd.y;
    }

    e.state = upd.state;

    // Мобы: HP и агро для полоски над головой
    if (upd.hp !== undefined) e.hp = upd.hp;
    if (upd.maxHp !== undefined) e.maxHp = upd.maxHp;
    if (upd.aggro !== undefined) e.aggro = upd.aggro;
  }
});

net.on("entityJoined", (msg) => {
  if (!msg.entity) return;
  if (msg.entity.id === you?.id) return;
  entities.set(msg.entity.id, withTarget(msg.entity));
  rebuildOthers();
  render();
});

net.on("entityLeft", (msg) => {
  if (!msg.entityId) return;
  entities.delete(msg.entityId);
  rebuildOthers();
  render();
});

// ============ Бой (День 10): автоатака, урон, опыт ============

net.on("attackStarted", (msg) => {
  attackTargetId = msg.targetId ?? null;
  render();
});

net.on("attackCleared", () => {
  attackTargetId = null;
  render();
});

net.on("combatEvent", (msg) => {
  // Удар по НАМ — обрабатывает playerHit (День 11), цифру не дублируем
  if (msg.targetType === "player" && msg.targetId === you?.id) return;

  const mob = entities.get(msg.targetId);
  if (mob) {
    mob.hp = msg.hp;
    mob.maxHp = msg.maxHp ?? mob.maxHp;
    mob.aggro = true;
  }

  if (msg.killed) {
    // Моб убит — сервер пришлёт entityLeft, цели больше нет
    attackTargetId = null;
  }

  showDamageNumber(msg.x, msg.y, msg.damage, msg.crit);
  render();
});

// ============ Моб бьёт игрока (День 11) ============

net.on("playerHit", (msg) => {
  if (!you) return;

  you.hp = msg.hp;
  you.maxHp = msg.maxHp ?? you.maxHp;

  // Цифра урона над игроком + вспышка экрана
  showDamageNumber(msg.x, msg.y, msg.damage, msg.crit);
  flashScreen();
  render();
});

net.on("youDied", (msg) => {
  attackTargetId = null;
  currentPath = [];
  pathInvalid = null;
  switchScene("death", { killedBy: msg.killedBy });
});

// Вспышка экрана при получении урона
function flashScreen() {
  if (!canvas) return;
  canvas.style.transition = "filter 0.1s";
  canvas.style.filter = "brightness(1.6) hue-rotate(-30deg)";
  setTimeout(() => {
    if (canvas) canvas.style.filter = "";
  }, 120);
}

net.on("xpGained", (msg) => {
  if (!you) return;

  you.xp = msg.xp ?? you.xp;
  you.xpToNext = msg.xpToNext ?? you.xpToNext;
  you.level = msg.level ?? you.level;

  // Окно персонажа открыто — обновляем на лету
  if (isCharacterWindowOpen()) {
    closeCharacterWindow();
    toggleCharacterWindow(you);
  }

  render();
});

// ============ Инвентарь, зелья, хотбар (День 12) ============

net.on("inventory", (msg) => {
  inventoryItems = Array.isArray(msg.items) ? msg.items : [];
  setInventoryItems(inventoryItems);   // обновить окно, если оно открыто
  render();
});

net.on("itemUsed", (msg) => {
  if (you) {
    you.hp = msg.hp;
    you.maxHp = msg.maxHp;
  }
  potionCooldownUntil = msg.cooldownUntil ?? 0;
  if (msg.healed > 0) showNotice(`+${msg.healed} HP`);
  render();
});

net.on("itemCooldown", (msg) => {
  showNotice(`Зелье перезаряжается: ${msg.left} с`);
  render();
});

net.on("hotbar", (msg) => {
  const slots = Array.isArray(msg.slots) ? msg.slots : [];
  hotbarSlots = [null, null, null, null];
  for (const s of slots) {
    if (s.index >= 0 && s.index < 4) hotbarSlots[s.index] = s.itemId;
  }
  render();
});

net.on("hotbarUpdate", (msg) => {
  if (msg.index >= 0 && msg.index < 4) hotbarSlots[msg.index] = msg.itemId;
  render();
});

// ============ Навыки (День 12) ============

net.on("skills", (msg) => {
  skillsList = Array.isArray(msg.skills) ? msg.skills : [];
  render();
});

net.on("skillUsed", (msg) => {
  if (you) you.mp = msg.mp;
  const s = skillsList.find((sk) => sk.id === msg.skillId);
  if (s) s.cooldownUntil = msg.cooldownUntil;
  render();
});

net.on("skillCooldown", (msg) => {
  showNotice(`Навык перезаряжается: ${msg.left} с`);
  render();
});

// Ошибки сервера (нет цели, не хватает маны, предмет не найден...)
net.on("error", (msg) => {
  if (msg.message) showNotice(msg.message);
  render();
});

// Всплывающая цифра урона над мобом
const damageNumbers = [];

function showDamageNumber(x, y, damage, crit) {
  damageNumbers.push({ x, y, damage, crit, born: performance.now() });
  if (damageNumbers.length > 30) damageNumbers.shift();
}

function drawDamageNumbers(ctx) {
  const now = performance.now();

  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const d = damageNumbers[i];
    const age = now - d.born;
    if (age > 900) {
      damageNumbers.splice(i, 1);
      continue;
    }

    const px = (d.x + 0.5) * tileSize;
    const py = (d.y + 0.5) * tileSize - (age / 900) * 18;

    ctx.font = `bold ${d.crit ? 16 : 13}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = Math.max(0, 1 - age / 900);
    ctx.fillStyle = d.crit ? "#f97316" : "#f8fafc";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = 3;
    ctx.strokeText(String(d.damage), px, py);
    ctx.fillText(String(d.damage), px, py);
    ctx.globalAlpha = 1;
  }
}

// ============ Кик ============

net.on("afkKick", (msg) => {
  alert(msg.message ?? "Тебя отключило за бездействие");
  localStorage.removeItem("hero_camp_token");
  window.location.reload();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}