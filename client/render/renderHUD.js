// HUD: полоса внизу экрана — HP, мана, опыт, 4 слота навыков, хотбар
// Полоска опыта добавлена в День 10 (под полосы здоровья и маны)
// День 12: иконки навыков/предметов + кулдаун-оверлей (затемнение + секунды)

export const HUD_HEIGHT = 96;

const PAD = 16;
const BAR_W = 240;
const BAR_H = 18;
const SLOT_SIZE = 46;
const SLOT_GAP = 8;
const SKILL_SLOTS = 4;
const HOTBAR_SLOTS = 4;
const XP_BAR_H = 14;         // полоса опыта чуть ниже основных (День 10)

export function renderHUD(ctx, { width, height, you, location, skills = [], hotbar = [] }) {
  if (!ctx) return;

  const top = Math.round(height - HUD_HEIGHT);
  if (top < 0) return;

  // ============ Фон ============
  ctx.fillStyle = "rgba(15, 23, 42, 0.96)";
  ctx.fillRect(0, top, width, HUD_HEIGHT);

  ctx.fillStyle = "#334155";
  ctx.fillRect(0, top, width, 1);

  // ============ HP / Мана (слева) ============
  drawBar(ctx, PAD, top + 14, BAR_W, BAR_H, you?.hp ?? 0, you?.maxHp ?? 0, {
    icon: "❤️",
    color: "#ef4444",
    bg: "#3f1d1d",
  });

  // Ресурс навыков: энергия (⚡ жёлтый, Воин) или мана (💧 синий, Маг) — День 13
  const isEnergy = you?.resource === "energy";
  drawBar(ctx, PAD, top + 40, BAR_W, BAR_H, you?.mp ?? 0, you?.maxMp ?? 0, {
    icon: isEnergy ? "⚡" : "💧",
    color: isEnergy ? "#eab308" : "#3b82f6",
    bg: isEnergy ? "#422006" : "#1e3a5f",
  });

  // ============ Опыт (День 10) — под полосами здоровья и маны ============
  drawBar(
    ctx, PAD, top + 64, BAR_W, XP_BAR_H,
    you?.xp ?? 0, you?.xpToNext ?? 100,
    {
      icon: "⭐",
      color: "#eab308",
      bg: "#422006",
      small: true,
    }
  );

  // Имя и уровень
  if (you) {
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`${you.name ?? ""} · ур. ${you.level ?? 1}`, PAD, top + 86);
  }

  // ============ Навыки (центр) ============
  const skillsW = SKILL_SLOTS * SLOT_SIZE + (SKILL_SLOTS - 1) * SLOT_GAP;
  let sx = Math.round(width / 2 - skillsW / 2);
  const slotY = Math.round(top + (HUD_HEIGHT - SLOT_SIZE) / 2);

  for (let i = 0; i < SKILL_SLOTS; i++) {
    drawSlot(ctx, sx, slotY, i + 1, skills[i] ?? null, i < SKILL_SLOTS - 1);
    sx += SLOT_SIZE + SLOT_GAP;
  }

  // ============ Хотбар (справа) ============
  const hotW = HOTBAR_SLOTS * SLOT_SIZE + (HOTBAR_SLOTS - 1) * SLOT_GAP;
  let hx = Math.round(width - PAD - hotW);
  if (hx > sx + 40) {
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      drawSlot(ctx, hx, slotY, SKILL_SLOTS + i + 1, hotbar[i] ?? null, i < HOTBAR_SLOTS - 1);
      hx += SLOT_SIZE + SLOT_GAP;
    }
  }

  // ============ Локация (справа сверху над хотбаром) ============
  if (location?.name) {
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#64748b";
    ctx.fillText(location.name, width - PAD, top + 4);
  }
}

// ============ Полоска ресурса ============

function drawBar(ctx, x, y, w, h, value, max, { icon, color, bg, small = false }) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.max(0, Math.min(1, value / safeMax));

  // Иконка
  ctx.font = `${small ? 11 : 14}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, x, y + h / 2);

  const bx = x + 24;
  const bw = w - 24;

  // Фон
  ctx.fillStyle = bg;
  ctx.fillRect(bx, y, bw, h);

  // Заполнение
  ctx.fillStyle = color;
  ctx.fillRect(bx, y, Math.round(bw * ratio), h);

  // Обводка
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 0.5, y + 0.5, bw - 1, h - 1);

  // Значение
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.max(0, Math.round(value))} / ${Math.round(safeMax)}`, bx + bw / 2, y + h / 2 + 1);
}

// ============ Слот навыка / хотбара ============

function drawSlot(ctx, x, y, key, entry, drawConnector) {
  if (drawConnector) {
    ctx.fillStyle = "rgba(100, 116, 139, 0.35)";
    ctx.fillRect(x + SLOT_SIZE, y + SLOT_SIZE / 2 - 1, SLOT_GAP, 2);
  }

  // Корпус слота
  ctx.fillStyle = entry ? "#1e293b" : "#0f172a";
  ctx.fillRect(x, y, SLOT_SIZE, SLOT_SIZE);

  ctx.strokeStyle = entry ? "#60a5fa" : "#334155";
  ctx.lineWidth = entry ? 2 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, SLOT_SIZE - 1, SLOT_SIZE - 1);

  // Иконка навыка / предмета
  if (entry?.icon) {
    ctx.font = "22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(entry.icon, x + SLOT_SIZE / 2, y + SLOT_SIZE / 2);
  }

  // Кулдаун-оверлей (День 12): полупрозрачное затемнение + секунды
  const leftMs = (entry?.cooldownUntil ?? 0) - Date.now();
  if (leftMs > 0) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
    ctx.fillRect(x, y, SLOT_SIZE, SLOT_SIZE);

    ctx.font = "bold 14px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(
      String(Math.ceil(leftMs / 1000)),
      x + SLOT_SIZE / 2,
      y + SLOT_SIZE / 2 + 1
    );
  }

  // Номер клавиши (поверх оверлея)
  ctx.font = "bold 10px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(String(key), x + 4, y + 3);
}

// ============ Геометрия хотбара (День 12) ============
// Точная копия расчётов renderHUD — нужна для drop/contextmenu на канвасе.

export function hotbarSlotAt(mx, my, width, height) {
  const top = Math.round(height - HUD_HEIGHT);
  const slotY = Math.round(top + (HUD_HEIGHT - SLOT_SIZE) / 2);
  if (my < slotY || my > slotY + SLOT_SIZE) return -1;

  const skillsW = SKILL_SLOTS * SLOT_SIZE + (SKILL_SLOTS - 1) * SLOT_GAP;
  const sx0 = Math.round(width / 2 - skillsW / 2);
  const hotW = HOTBAR_SLOTS * SLOT_SIZE + (HOTBAR_SLOTS - 1) * SLOT_GAP;
  const hx0 = Math.round(width - PAD - hotW);

  // Как в renderHUD: хотбар рисуется только если не наезжает на навыки
  if (hx0 <= sx0 + skillsW + 40) return -1;

  for (let i = 0; i < HOTBAR_SLOTS; i++) {
    const hx = hx0 + i * (SLOT_SIZE + SLOT_GAP);
    if (mx >= hx && mx <= hx + SLOT_SIZE) return i;
  }
  return -1;
}