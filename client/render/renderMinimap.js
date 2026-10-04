// Мини-карта региона и окно карты мира (клавиша M) — День 10
// Рисует схему региона по сетке gridX/gridY: один регион с несколькими
// районами, текущий район подсвечен, связи показаны стрелками.

export function renderWorldMap(ctx, { location, region, width, height, showGrid = false }) {
  if (!ctx || !region) return;

  // Полноэкранный вариант — отдельное окно; здесь рисуем угловую схему
  const margin = 12;
  const maxW = width - margin * 2;
  const maxH = height - margin * 2;
  const cols = Math.max(1, region.gridWidth ?? 1);
  const rows = Math.max(1, region.gridHeight ?? 1);

  const cellW = Math.floor(maxW / cols);
  const cellH = Math.floor(maxH / rows);
  const cellSize = Math.max(24, Math.min(cellW, cellH));

  const boardW = cellSize * cols;
  const boardH = cellSize * rows;
  const originX = Math.round((width - boardW) / 2);
  const originY = Math.round((height - boardH) / 2);

  // Фон
  ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
  ctx.fillRect(originX - 8, originY - 8, boardW + 16, boardH + 16);
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1;
  ctx.strokeRect(originX - 8.5, originY - 8.5, boardW + 17, boardH + 17);

  // Заголовок региона
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(region.name ?? "Регион", width / 2, originY - 14);

  if (showGrid) {
    for (let gx = 0; gx <= cols; gx++) {
      ctx.strokeStyle = "rgba(100, 116, 139, 0.15)";
      ctx.beginPath();
      ctx.moveTo(originX + gx * cellSize + 0.5, originY);
      ctx.lineTo(originX + gx * cellSize + 0.5, originY + boardH);
      ctx.stroke();
    }
  }

  // Районы
  const byCell = new Map();
  for (const loc of region.locations ?? []) {
    const key = `${loc.gridX},${loc.gridY}`;
    byCell.set(key, loc);
  }

  for (const loc of region.locations ?? []) {
    const x = originX + loc.gridX * cellSize;
    const y = originY + loc.gridY * cellSize;
    const isHere = loc.id === location?.id;

    ctx.fillStyle = isHere ? "#1e40af" : "#1e293b";
    ctx.fillRect(x + 2, y + 2, cellSize - 4, cellSize - 4);

    ctx.strokeStyle = isHere ? "#60a5fa" : "#475569";
    ctx.lineWidth = isHere ? 2 : 1;
    ctx.strokeRect(x + 2.5, y + 2.5, cellSize - 5, cellSize - 5);

    ctx.font = `${isHere ? "bold " : ""}10px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isHere ? "#bfdbfe" : "#94a3b8";
    ctx.fillText(loc.name ?? loc.id, x + cellSize / 2, y + cellSize / 2);
  }
}

/**
 * HTML-версия окна карты мира (M) — та же схема, но списком + сеткой.
 * @param {object} location — текущая локация
 * @param {object} region — данные региона (region в worldEntered/locationChange)
 */
export function renderWorldMapHtml(location, region) {
  if (!region) {
    return `
      <div class="gw-window-head">
        <span class="gw-window-title">Карта мира</span>
        <span class="gw-window-hint">M — закрыть</span>
      </div>
      <div class="gw-map-empty">Карта этого региона пока недоступна</div>`;
  }

  const cols = Math.max(1, region.gridWidth ?? 1);
  const rows = Math.max(1, region.gridHeight ?? 1);

  // Заполняем сетку: занятые районы + пустые клетки
  const cells = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const loc = (region.locations ?? []).find((l) => l.gridX === gx && l.gridY === gy);
      if (!loc) {
        cells.push(`<div class="gw-map-cell gw-map-empty-cell"></div>`);
        continue;
      }

      const isHere = loc.id === location?.id;
      const links = Object.entries(loc.connections ?? {})
        .map(([dir, targetId]) => {
          const target = (region.locations ?? []).find((l) => l.id === targetId);
          const arrows = { east: "→", west: "←", north: "↑", south: "↓" };
          return target ? `${arrows[dir] ?? ""} ${target.name ?? target.id}` : "";
        })
        .filter(Boolean)
        .join(" · ");

      cells.push(`
        <div class="gw-map-cell ${isHere ? "gw-map-here" : ""}">
          <div class="gw-map-name">${escapeHtml(loc.name ?? loc.id)}</div>
          <div class="gw-map-size">${loc.width}×${loc.height}</div>
          ${links ? `<div class="gw-map-links">${escapeHtml(links)}</div>` : ""}
          ${isHere ? `<div class="gw-map-badge">вы здесь</div>` : ""}
        </div>`);
    }
  }

  const here = (region.locations ?? []).find((l) => l.id === location?.id);

  return `
    <div class="gw-window-head">
      <span class="gw-window-title">Карта мира</span>
      <span class="gw-window-hint">M — закрыть</span>
    </div>

    <div class="gw-map-region">${escapeHtml(region.name ?? "Регион")}</div>
    ${here ? `<div class="gw-map-current">Сейчас: ${escapeHtml(here.name)} (${here.width}×${here.height})</div>` : ""}

    <div class="gw-map-grid" style="grid-template-columns: repeat(${cols}, 1fr)">
      ${cells.join("")}
    </div>

    <div class="gw-inv-foot">Регион ${region.gridWidth}×${region.gridHeight} · районов: ${(region.locations ?? []).length}</div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}
