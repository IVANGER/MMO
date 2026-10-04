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
  } else {
    // Тело
    ctx.fillStyle = e.color ?? "#60a5fa";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Обводка
    ctx.strokeStyle = isYou ? "#fbbf24" : "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = isYou ? 3 : 2;
    ctx.stroke();

    // Иконка класса / моба
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