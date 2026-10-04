// Отрисовка маршрута

export function renderPath(ctx, { path, tileSize, valid = true }) {
  if (!path || path.length === 0) return;

  const color = valid ? "#fbbf24" : "#ef4444";
  const fillColor = valid ? "rgba(251, 191, 36, 0.25)" : "rgba(239, 68, 68, 0.25)";

  // 1. Линия
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, tileSize * 0.08);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([tileSize * 0.25, tileSize * 0.15]);

  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const px = (p.x + 0.5) * tileSize;
    const py = (p.y + 0.5) * tileSize;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 2. Точки на каждой клетке
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const px = (p.x + 0.5) * tileSize;
    const py = (p.y + 0.5) * tileSize;

    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(px, py, tileSize * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Финальная точка — крупнее
  const last = path[path.length - 1];
  const lx = (last.x + 0.5) * tileSize;
  const ly = (last.y + 0.5) * tileSize;

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.arc(lx, ly, tileSize * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, tileSize * 0.08);
  ctx.beginPath();
  ctx.arc(lx, ly, tileSize * 0.35, 0, Math.PI * 2);
  ctx.stroke();
}