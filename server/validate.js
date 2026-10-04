// Валидация команд от клиента

const NICKNAME_RE = /^[a-zA-Z0-9_а-яА-ЯёЁ]{3,16}$/;

export function validateNickname(nickname) {
  if (typeof nickname !== "string") return "Ник должен быть строкой";
  const n = nickname.trim();
  if (n.length < 3) return "Ник слишком короткий (минимум 3)";
  if (n.length > 16) return "Ник слишком длинный (максимум 16)";
  if (!NICKNAME_RE.test(n)) return "Ник: только буквы, цифры и _ (3-16)";
  return null;
}

export function validatePassword(password) {
  if (typeof password !== "string") return "Пароль должен быть строкой";
  if (password.length < 6) return "Пароль слишком короткий (минимум 6)";
  if (password.length > 64) return "Пароль слишком длинный (максимум 64)";
  return null;
}

export function validateCharacterName(name) {
  if (typeof name !== "string") return "Имя должно быть строкой";
  const n = name.trim();
  if (n.length < 3) return "Имя слишком короткое (минимум 3)";
  if (n.length > 16) return "Имя слишком длинное (максимум 16)";
  return null;
}

// Универсальный ответ с ошибкой
export function err(message) {
  return { type: "error", message };
}

export function ok(data = {}) {
  return { type: "ok", ...data };
}