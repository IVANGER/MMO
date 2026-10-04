// Менеджер сцен

const scenes = {};
let current = null;
let currentName = null;

export function registerScene(name, scene) {
  scenes[name] = scene;
}

export function switchScene(name, payload) {
  if (!scenes[name]) {
    console.error(`Scene "${name}" not registered`);
    return;
  }
  current?.onExit?.();
  current = scenes[name];
  currentName = name;
  current.onEnter?.(payload);
}

export function getCurrentScene() {
  return currentName;
}

export function renderCurrent() {
  current?.render?.();
}