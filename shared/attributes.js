// 10 базовых характеристик персонажа (День 9)

export const ATTRIBUTES = {
  STR: { code: "STR", name: "Сила", icon: "💪", desc: "Урон ближнего боя, HP" },
  AGI: { code: "AGI", name: "Ловкость", icon: "🏃", desc: "Дальность и скорость хода, скорость атаки, уклонение" },
  VIT: { code: "VIT", name: "Выносливость", icon: "❤️", desc: "HP, регенерация HP" },
  INT: { code: "INT", name: "Мудрость", icon: "🧠", desc: "Мана, урон магии" },
  SPI: { code: "SPI", name: "Дух", icon: "✨", desc: "Сопротивление магии, регенерация MP" },
  PER: { code: "PER", name: "Восприятие", icon: "👁️", desc: "Дальность атаки, крит, обнаружение" },
  CHA: { code: "CHA", name: "Харизма", icon: "💬", desc: "Цены у торговцев, диалоги" },
  LUK: { code: "LUK", name: "Удача", icon: "🍀", desc: "Шанс крита, дроп, уклонение" },
  DEX: { code: "DEX", name: "Точность", icon: "🎯", desc: "Шанс попадания, урон дальнего боя" },
  RES: { code: "RES", name: "Стойкость", icon: "🛡️", desc: "Защита, снижение урона" },
};

export const ATTR_ORDER = ["STR", "AGI", "VIT", "INT", "SPI", "PER", "CHA", "LUK", "DEX", "RES"];

// Характеристики на заданном уровне: база + прирост класса × (level − 1)
export function attrsAtLevel(base, growth, level) {
  const times = Math.max(0, (level ?? 1) - 1);
  const out = {};
  for (const code of ATTR_ORDER) {
    out[code] = (base[code] ?? 0) + (growth?.[code] ?? 0) * times;
  }
  return out;
}