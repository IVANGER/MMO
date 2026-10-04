// Клавиатура в мире (День 10):
//   B — окно персонажа, I — инвентарь, M — карта мира, Esc — закрыть окно
// День 12 (обработка в worldScene.handleKey):
//   1-4 — навыки, 5-8 — слоты хотбара (предметы)

const listeners = new Set();

/**
 * Подключить обработчик клавиш.
 * @param {(key: string, ev: KeyboardEvent) => void} handler
 * @returns {() => void} функция отписки
 */
export function onKey(handler) {
  const wrapped = (ev) => {
    // Не мешаем вводу в полях (чат, инвентарь в будущем)
    const tag = ev.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    const key = ev.key.toLowerCase();
    if (!handler(key, ev)) return;   // true — событие обработано, гасим default
    ev.preventDefault();
  };

  window.addEventListener("keydown", wrapped);
  listeners.add(wrapped);

  return () => {
    window.removeEventListener("keydown", wrapped);
    listeners.delete(wrapped);
  };
}

/** Отписать все обработчики (при выходе из сцены) */
export function resetKeyboard() {
  for (const fn of listeners) window.removeEventListener("keydown", fn);
  listeners.clear();
}
