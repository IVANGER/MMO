// 16 вторичных параметров от 10 базовых характеристик (День 9)
// Формулы — из плана Дня 9 (PROJECT_RESUME.md, «Вторичные параметры»)
// Округления: floor — для целочисленных (урон, защита); прочие — точные значения.

export function calcHP(a) {
  return 50 + a.VIT * 10 + a.STR * 2;
}

export function calcMP(a) {
  return 20 + a.INT * 8 + a.SPI * 2;
}

export function calcMeleeDamage(a) {
  return Math.floor(a.STR * 2 + a.AGI * 0.5);
}

export function calcRangedDamage(a) {
  return Math.floor(a.DEX * 2 + a.AGI * 0.5);
}

export function calcMagicDamage(a) {
  return Math.floor(a.INT * 2 + a.SPI * 0.5);
}

export function calcDefense(a) {
  return Math.floor(a.RES * 1.5 + a.VIT * 0.5);
}

export function calcAttackSpeed(a) {
  return 1.0 + a.AGI * 0.02;
}

export function calcCritChance(a) {
  return Math.min(0.5, 0.05 + a.LUK * 0.005 + a.AGI * 0.003);
}

export function calcDodgeChance(a) {
  return Math.min(0.4, 0.03 + a.AGI * 0.004 + a.PER * 0.002);
}

export function calcHitChance(a) {
  return Math.min(0.95, 0.8 + a.DEX * 0.005);
}

export function calcHpRegen(a) {
  return 0.5 + a.VIT * 0.05 + a.SPI * 0.02;
}

export function calcMpRegen(a) {
  return 0.3 + a.INT * 0.04 + a.SPI * 0.03;
}

// ============ Энергия (ресурс Воина, День 13) ============
// Воин тратит не магию, а энергию — она копится от VIT/STR и медленнее,
// зато восстанавливается заметно быстрее (нет задержки «мана после боя»).

export function calcEnergyMax(a) {
  return 30 + a.VIT * 4 + a.STR * 1;
}

export function calcEnergyRegen(a) {
  return 0.5 + a.VIT * 0.05 + a.STR * 0.02;
}

// Скорость хода, кл/сек — старт 2.0 (AGI 5)
export function calcMoveSpeed(a) {
  return 1.5 + a.AGI * 0.1;
}

// Дальность хода, клеток — старт 3, +1 каждые 5 AGI (AGI 10 → 4, 15 → 5, 20 → 6, 25 → 7)
export function calcMoveRange(a) {
  return Math.max(3, 2 + Math.floor(a.AGI / 5));
}

export function calcMagicResist(a) {
  return Math.floor(a.SPI * 1.2 + a.RES * 0.3);
}

export function calcMerchantDiscount(a) {
  return Math.min(0.3, a.CHA * 0.01);
}

// Все вторичные параметры одним объектом
export function calcAll(a) {
  return {
    hp: calcHP(a),
    mp: calcMP(a),
    meleeDamage: calcMeleeDamage(a),
    rangedDamage: calcRangedDamage(a),
    magicDamage: calcMagicDamage(a),
    defense: calcDefense(a),
    attackSpeed: calcAttackSpeed(a),
    critChance: calcCritChance(a),
    dodgeChance: calcDodgeChance(a),
    hitChance: calcHitChance(a),
    hpRegen: calcHpRegen(a),
    mpRegen: calcMpRegen(a),
    energyMax: calcEnergyMax(a),
    energyRegen: calcEnergyRegen(a),
    moveSpeed: calcMoveSpeed(a),
    moveRange: calcMoveRange(a),
    magicResist: calcMagicResist(a),
    merchantDiscount: calcMerchantDiscount(a),
  };
}