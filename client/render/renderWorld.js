// Отрисовка мира на Canvas 2D: тайлы, объекты и сущности (сортировка по y)

import { TILES } from "../../shared/tiles.js";
import { OBJECT_TYPES, getObjectType } from "../../shared/objects.js";
import { getSprite } from "./spriteLoader.js";

export function renderWorld(ctx, { location, you, entities = [], tileSize = 32, showGrid = false }) {
  const { width, height } = location;

  // 1. Тайлы (PNG или цветной квадрат)
  drawTiles(ctx, location, tileSize);

  // 2. Сетка (для отладки)
  if (showGrid && tileSize >= 12) drawGrid(ctx, width, height, tileSize);

  // 3. Объекты + сущности: вместе, сортировка по y
  const drawables = [];

  for (const obj of location.objects ?? []) {
    drawables.push({ kind: "object", sortY: obj.y + 1, data: obj });
  }

  for (const e of entities) {
    if (e.id === you?.id) continue;
    drawables.push({ kind: "entity", sortY: e.y + 1, data: e, isYou: false });
  }

  if (you) {
    drawables.push({ kind: "entity", sortY: you.y + 1, data: you, isYou: true });
  }

  drawables.sort((a, b) => a.sortY - b.sortY);

  for (const d of drawables) {
    if (d.kind === "object") drawObject(ctx, d.data, tileSize);
    else drawEntity(ctx, d.data, tileSize, d.isYou);
  }
}

// ============ Тайлы ============

function drawTiles(ctx, location, tileSize) {
  const { width, height, tiles } = location;
  const size = Math.ceil(tileSize);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tileId = tiles[y][x];
      const tile = TILES[tileId] ?? TILES.wall;
      const px = x * tileSize;
      const py = y * tileSize;

      const sprite = getSprite(tileId);
      if (sprite) {
        ctx.drawImage(sprite, px, py, size, size);
      } else {
        ctx.fillStyle = tile.color;
        ctx.fillRect(px, py, size, size);
      }

      // Шахматная вариация
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(px, py, size, size);
      }
    }
  }
}

function drawGrid(ctx, width, height, tileSize) {
  ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * tileSize + 0.5, 0);
    ctx.lineTo(x * tileSize + 0.5, height * tileSize);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * tileSize + 0.5);
    ctx.lineTo(width * tileSize, y * tileSize + 0.5);
    ctx.stroke();
  }
}

// ============ Объекты (деревья, камни) ============

function drawObject(ctx, obj, tileSize) {
  const tmpl = getObjectType(obj.type) ?? OBJECT_TYPES.rock;

  const anchorX = (obj.x + 0.5) * tileSize;
  const anchorY = (obj.y + 1) * tileSize;      // якорь — низ-центр

  const sprite = getSprite(obj.sprite ?? obj.type);
  if (sprite) {
    const w = ((tmpl.spriteW ?? 32) / 32) * tileSize;
    const h = ((tmpl.spriteH ?? 32) / 32) * tileSize;
    ctx.drawImage(sprite, anchorX - w / 2, anchorY - h, w, h);
    return;
  }

  // Fallback: цветной куб (дерево — зелёное, камень — серый)
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(anchorX, anchorY - tileSize * 0.08, tileSize * 0.34, tileSize * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  if (obj.type === "tree") {
    // Ствол
    ctx.fillStyle = tmpl.accent ?? "#78350f";
    ctx.fillRect(anchorX - tileSize * 0.08, anchorY - tileSize * 0.5, tileSize * 0.16, tileSize * 0.45);

    // Крона
    ctx.fillStyle = tmpl.color ?? "#166534";
    ctx.beginPath();
    ctx.arc(anchorX, anchorY - tileSize * 0.72, tileSize * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    // Камень
    ctx.fillStyle = tmpl.color ?? "#9ca3af";
    ctx.beginPath();
    ctx.moveTo(anchorX - tileSize * 0.34, anchorY);
    ctx.lineTo(anchorX - tileSize * 0.24, anchorY - tileSize * 0.42);
    ctx.lineTo(anchorX + tileSize * 0.1, anchorY - tileSize * 0.5);
    ctx.lineTo(anchorX + tileSize * 0.34, anchorY - tileSize * 0.16);
    ctx.lineTo(anchorX + tileSize * 0.28, anchorY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ============ Сущности (игроки, мобы, NPC) ============

function drawEntity(ctx, e, tileSize, isYou = false) {
  const scale = e.size ?? 1;
  const cx = (e.x + 0.5) * tileSize;
  const cy = (e.y + 0.5) * tileSize;
  const r = tileSize * 0.35 * scale;

  const sprite = getSprite(e.sprite ?? null);

  // Тень
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.7, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (sprite) {
    const w = tileSize * scale;
    const h = tileSize * 1.5 * scale;
    ctx.drawImage(sprite, cx - w / 2, cy + r * 0.7 - h, w, h);
  } else if (e.type === "player") {
    // День 12: процедурная модель игрока (не смайлик)
    drawPlayerModel(ctx, cx, cy, r, e, isYou);
  } else if (e.type === "mob") {
    // День 12: модель моба по mobType (гоблин, волк, орк)
    drawMobModel(ctx, cx, cy, r, e);
  } else {
    // Прочее (NPC и т.п.) — запасной вариант: цветной кружок с иконкой
    ctx.fillStyle = e.color ?? "#60a5fa";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (tileSize >= 24) {
      ctx.font = `${Math.floor(r * 1.2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(e.classIcon ?? "❓", cx, cy + 1);
    }
  }

  // HP-бар моба (только после агро)
  if (e.type === "mob" && e.aggro && e.maxHp > 0) {
    const bw = Math.max(tileSize * 1.1, 34);
    const bh = 5;
    const bx = cx - bw / 2;
    const by = cy - r - 14;
    const ratio = Math.max(0, Math.min(1, (e.hp ?? 0) / e.maxHp));

    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);

    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(bx, by, bw, bh);

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(bx, by, bw * ratio, bh);

    drawName(ctx, e.name, cx, by - 4, "#fca5a5", 10);
    return;
  }

  if (e.name && tileSize >= 24) {
    const color = isYou ? "#fbbf24" : e.type === "mob" ? "#cbd5e1" : "#e2e8f0";
    drawName(ctx, e.name, cx, cy - r - 4, color, 11);
  }
}

// ============ Модельки (День 12): процедурные фигурки вместо смайликов ============

// Скруглённый прямоугольник (запасной вариант вместо ctx.roundRect)
function rr(ctx, x, y, w, h, rad) {
  const r = Math.max(0, Math.min(rad, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function outline(ctx) {
  ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Игрок: ноги, корпус (цвет класса), руки, голова, волосы, меч у воина
function drawPlayerModel(ctx, cx, cy, r, e, isYou) {
  const footY = cy + r * 0.65;
  const h = r * 2.2;
  const w = r * 1.0;
  const top = footY - h;

  // Золотое кольцо под ногами — это Я
  if (isYou) {
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, footY, r * 0.85, r * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Ноги
  ctx.fillStyle = "#1f2937";
  ctx.fillRect(cx - w * 0.4, footY - h * 0.3, w * 0.3, h * 0.3);
  ctx.fillRect(cx + w * 0.1, footY - h * 0.3, w * 0.3, h * 0.3);

  // Руки
  ctx.fillStyle = e.color ?? "#60a5fa";
  rr(ctx, cx - w * 0.66, top + h * 0.36, w * 0.2, h * 0.3, w * 0.08);
  ctx.fill(); outline(ctx);
  rr(ctx, cx + w * 0.46, top + h * 0.36, w * 0.2, h * 0.3, w * 0.08);
  ctx.fill(); outline(ctx);

  // Корпус (броня/рубаха цвета класса)
  ctx.fillStyle = e.color ?? "#60a5fa";
  rr(ctx, cx - w / 2, top + h * 0.32, w, h * 0.4, w * 0.18);
  ctx.fill(); outline(ctx);

  // Поясок
  ctx.fillStyle = "#374151";
  ctx.fillRect(cx - w / 2, top + h * 0.66, w, h * 0.06);

  // Голова
  ctx.fillStyle = "#f2c79b";
  ctx.beginPath();
  ctx.arc(cx, top + h * 0.17, r * 0.4, 0, Math.PI * 2);
  ctx.fill(); outline(ctx);

  // Волосы (дуга сверху)
  ctx.fillStyle = "#4b5563";
  ctx.beginPath();
  ctx.arc(cx, top + h * 0.17, r * 0.4, Math.PI * 1.05, Math.PI * 1.95);
  ctx.closePath();
  ctx.fill();

  // Глаза
  ctx.fillStyle = "#111827";
  ctx.fillRect(cx - r * 0.16, top + h * 0.18, r * 0.07, r * 0.07);
  ctx.fillRect(cx + r * 0.09, top + h * 0.18, r * 0.07, r * 0.07);

  // Меч (воин) — с правой стороны
  if (e.class === "warrior") {
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.7, top + h * 0.72);
    ctx.lineTo(cx + w * 0.95, top + h * 0.3);
    ctx.stroke();

    ctx.strokeStyle = "#92400e";
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.62, top + h * 0.66);
    ctx.lineTo(cx + w * 0.78, top + h * 0.78);
    ctx.stroke();
  }
}

// Моб: модель по типу, запасной вариант — кружок с иконкой
function drawMobModel(ctx, cx, cy, r, e) {
  switch (e.mobType) {
    case "wolf":
      drawWolfModel(ctx, cx, cy, r);
      return;
    case "goblin":
      drawGoblinModel(ctx, cx, cy, r);
      return;
    case "orc":
      drawOrcModel(ctx, cx, cy, r);
      return;
    default: {
      ctx.fillStyle = e.color ?? "#84cc16";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx);
      ctx.font = `${Math.floor(r * 1.2)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(e.classIcon ?? "🐾", cx, cy + 1);
    }
  }
}

// Гоблин: низкая зелёная фигурка с острыми ушами и красными глазами
function drawGoblinModel(ctx, cx, cy, r) {
  const footY = cy + r * 0.6;
  const h = r * 1.9;
  const w = r * 0.85;
  const top = footY - h;

  // Ноги
  ctx.fillStyle = "#3f6212";
  ctx.fillRect(cx - w * 0.36, footY - h * 0.3, w * 0.28, h * 0.3);
  ctx.fillRect(cx + w * 0.08, footY - h * 0.3, w * 0.28, h * 0.3);

  // Руки (длинные, вниз)
  ctx.fillStyle = "#65a30d";
  rr(ctx, cx - w * 0.62, top + h * 0.4, w * 0.18, h * 0.32, w * 0.08);
  ctx.fill(); outline(ctx);
  rr(ctx, cx + w * 0.44, top + h * 0.4, w * 0.18, h * 0.32, w * 0.08);
  ctx.fill(); outline(ctx);

  // Корпус
  ctx.fillStyle = "#65a30d";
  rr(ctx, cx - w / 2, top + h * 0.36, w, h * 0.36, w * 0.18);
  ctx.fill(); outline(ctx);

  // Голова
  ctx.fillStyle = "#84cc16";
  ctx.beginPath();
  ctx.arc(cx, top + h * 0.2, r * 0.38, 0, Math.PI * 2);
  ctx.fill(); outline(ctx);

  // Уши в стороны
  ctx.fillStyle = "#84cc16";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.34, top + h * 0.16);
  ctx.lineTo(cx - r * 0.75, top + h * 0.06);
  ctx.lineTo(cx - r * 0.3, top + h * 0.26);
  ctx.closePath();
  ctx.fill(); outline(ctx);
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.34, top + h * 0.16);
  ctx.lineTo(cx + r * 0.75, top + h * 0.06);
  ctx.lineTo(cx + r * 0.3, top + h * 0.26);
  ctx.closePath();
  ctx.fill(); outline(ctx);

  // Красные глаза
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(cx - r * 0.16, top + h * 0.18, r * 0.09, r * 0.07);
  ctx.fillRect(cx + r * 0.07, top + h * 0.18, r * 0.09, r * 0.07);
}

// Волк: quadruped в профиль — тело, голова с ухом, хвот, четыре лапы
function drawWolfModel(ctx, cx, cy, r) {
  const footY = cy + r * 0.6;
  const bodyY = footY - r * 0.85;

  // Лапы
  ctx.fillStyle = "#6b7280";
  const legW = r * 0.16;
  const legTop = bodyY + r * 0.15;
  for (const lx of [-0.55, -0.2, 0.3, 0.6]) {
    ctx.fillRect(cx + lx * r, legTop, legW, footY - legTop);
  }

  // Хвост
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = r * 0.18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.85, bodyY - r * 0.1);
  ctx.lineTo(cx - r * 1.25, bodyY - r * 0.5);
  ctx.stroke();

  // Тело
  ctx.fillStyle = "#9ca3af";
  ctx.beginPath();
  ctx.ellipse(cx, bodyY, r * 0.95, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill(); outline(ctx);

  // Голова
  const hx = cx + r * 0.95;
  const hy = bodyY - r * 0.25;
  ctx.fillStyle = "#a8b0bb";
  ctx.beginPath();
  ctx.arc(hx, hy, r * 0.36, 0, Math.PI * 2);
  ctx.fill(); outline(ctx);

  // Ухо
  ctx.fillStyle = "#9ca3af";
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.2, hy - r * 0.25);
  ctx.lineTo(hx - r * 0.02, hy - r * 0.62);
  ctx.lineTo(hx + r * 0.14, hy - r * 0.22);
  ctx.closePath();
  ctx.fill(); outline(ctx);

  // Морда + глаз
  ctx.fillStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.arc(hx + r * 0.28, hy + r * 0.12, r * 0.16, 0, Math.PI * 2);
  ctx.fill(); outline(ctx);

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(hx + r * 0.08, hy - r * 0.05, r * 0.06, 0, Math.PI * 2);
  ctx.fill();
}

// Орк: широкая тёмно-зелёная фигура с клыками и наплечниками
function drawOrcModel(ctx, cx, cy, r) {
  const footY = cy + r * 0.7;
  const h = r * 2.5;
  const w = r * 1.3;
  const top = footY - h;

  // Ноги
  ctx.fillStyle = "#292524";
  ctx.fillRect(cx - w * 0.36, footY - h * 0.3, w * 0.3, h * 0.3);
  ctx.fillRect(cx + w * 0.06, footY - h * 0.3, w * 0.3, h * 0.3);

  // Руки (толстые)
  ctx.fillStyle = "#4d7c0f";
  rr(ctx, cx - w * 0.7, top + h * 0.34, w * 0.24, h * 0.36, w * 0.1);
  ctx.fill(); outline(ctx);
  rr(ctx, cx + w * 0.46, top + h * 0.34, w * 0.24, h * 0.36, w * 0.1);
  ctx.fill(); outline(ctx);

  // Корпус
  ctx.fillStyle = "#4d7c0f";
  rr(ctx, cx - w / 2, top + h * 0.3, w, h * 0.4, w * 0.2);
  ctx.fill(); outline(ctx);

  // Наплечники
  ctx.fillStyle = "#57534e";
  rr(ctx, cx - w * 0.58, top + h * 0.3, w * 0.3, h * 0.1, w * 0.06);
  ctx.fill(); outline(ctx);
  rr(ctx, cx + w * 0.28, top + h * 0.3, w * 0.3, h * 0.1, w * 0.06);
  ctx.fill(); outline(ctx);

  // Пояс
  ctx.fillStyle = "#78350f";
  ctx.fillRect(cx - w / 2, top + h * 0.66, w, h * 0.06);

  // Голова
  ctx.fillStyle = "#4d7c0f";
  ctx.beginPath();
  ctx.arc(cx, top + h * 0.16, r * 0.44, 0, Math.PI * 2);
  ctx.fill(); outline(ctx);

  // Клыки вверх
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.16, top + h * 0.24);
  ctx.lineTo(cx - r * 0.1, top + h * 0.16);
  ctx.lineTo(cx - r * 0.04, top + h * 0.24);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.16, top + h * 0.24);
  ctx.lineTo(cx + r * 0.1, top + h * 0.16);
  ctx.lineTo(cx + r * 0.04, top + h * 0.24);
  ctx.closePath();
  ctx.fill();

  // Глаза (злые — косые)
  ctx.fillStyle = "#fef08a";
  ctx.fillRect(cx - r * 0.2, top + h * 0.13, r * 0.12, r * 0.06);
  ctx.fillRect(cx + r * 0.08, top + h * 0.13, r * 0.12, r * 0.06);
}

function drawName(ctx, name, cx, baselineY, color, size) {
  if (!name) return;

  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  const textW = ctx.measureText(name).width + 8;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(cx - textW / 2, baselineY - size - 3, textW, size + 4);

  ctx.fillStyle = color;
  ctx.fillText(name, cx, baselineY);
}