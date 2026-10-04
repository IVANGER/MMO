// Загрузка PNG-спрайтов с graceful fallback
// Если файла нет — спрайт не появляется в кэше, рендер рисует цветной квадрат

import { spritePath, allSpriteKeys } from "./spriteRegistry.js";

const images = new Map();   // key → Image
const failed = new Set();   // key, которые не загрузились (404/битый файл)

let started = false;
let preloadPromise = null;

/**
 * Готовый спрайт или null (пока грузится / если файла нет).
 */
export function getSprite(key) {
  if (!key || failed.has(key)) return null;
  const img = images.get(key);
  if (!img || !img.complete || img.naturalWidth === 0) return null;
  return img;
}

export function hasSprite(key) {
  return getSprite(key) !== null;
}

function loadOne(key) {
  return new Promise((resolve) => {
    if (failed.has(key) || images.has(key)) return resolve(false);

    const path = spritePath(key);
    if (!path) {
      failed.add(key);
      return resolve(false);
    }

    const img = new Image();
    images.set(key, img);

    img.onload = () => {
      if (img.naturalWidth === 0) {
        failed.add(key);
        images.delete(key);
        resolve(false);
      } else {
        resolve(true);
      }
    };
    img.onerror = () => {
      failed.add(key);
      images.delete(key);
      resolve(false);
    };

    img.src = path;
  });
}

/**
 * Загрузить все известные спрайты. Возвращает промис (список загруженных ключей).
 * Повторный вызов возвращает тот же промис.
 */
export function preloadSprites() {
  if (started) return preloadPromise;
  started = true;

  const keys = allSpriteKeys();
  preloadPromise = Promise.all(
    keys.map(async (key) => ((await loadOne(key)) ? key : null))
  ).then((res) => {
    const ok = res.filter(Boolean);
    if (ok.length === 0) {
      console.info("[sprites] PNG не найдены — включён fallback (цветные квадраты)");
    } else {
      console.info(`[sprites] загружено: ${ok.join(", ")}`);
    }
    return ok;
  });

  return preloadPromise;
}

export function getLoadedKeys() {
  return [...images.keys()].filter((k) => !failed.has(k));
}