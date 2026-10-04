// Сущности: игроки, мобы, NPC

export function createPlayerEntity(character) {
  return {
    id: character.id,
    type: "player",
    name: character.name,
    class: character.class,
    classIcon: character.classIcon ?? "⚔️",
    level: character.level,

    x: character.x ?? 0,
    y: character.y ?? 0,

    hp: character.hp,
    maxHp: character.maxHp,
    mp: character.mp,
    maxMp: character.maxMp,
    atk: character.atk ?? 1,         // из характеристик (День 9) + бонусы оружия
    defense: character.defense ?? 0,
    baseAtk: character.atk ?? 1,    // база без экипировки — чтобы пересчитать бонусы
    baseDefense: character.defense ?? 0,

    // Бой (День 13)
    attackRange: character.attackRange ?? 1,   // радиус автоатаки из класса (воин 1, маг 3)
    resource: character.resource ?? "mana",    // mana | energy — как называть полоску
    hpRegen: character.hpRegen ?? 0.5,         // HP в секунду
    resourceRegen: character.resourceRegen ?? 0.3, // мана/энергия в секунду
    slow: null,                                // замедление {mult, until}
    buffs: [],                                 // баффы навыков [{stat, mult, until}]
    casting: null,                             // каст {skillId, targetX, targetY, until}
    equippedBonuses: { atk: 0, defense: 0 },   // сумма бонусов надетых предметов

    // Прогресс и характеристики — для окна персонажа (B) и полосы опыта (День 10)
    xp: character.xp ?? 0,
    xpToNext: character.xpToNext ?? 100,
    attrs: character.attrs ?? null,
    attrPoints: character.attrPoints ?? 0,
    className: character.className ?? character.class,
    attackSpeed: character.attackSpeed ?? 1.0,   // ударов в секунду → кулдаун
    critChance: character.critChance ?? 0.05,   // шанс крита

    // Движение
    path: [],              // массив {x, y} — куда идти
    moveProgress: 0,       // 0..1 — прогресс между текущей и следующей клеткой
    speed: character.speed ?? 2.0,   // клеток в секунду (из AGI)
    moveRange: character.moveRange ?? 3, // дальность хода за один клик, клеток

    // Визуал
    color: "#60a5fa",
    size: 1,

    // Состояние
    state: "idle",         // idle | moving
    justArrived: false,    // дошёл до конца пути (одноразовый флаг для переходов)
    targetId: null,        // цель автоатаки (День 10)
    nextAttackAt: 0,       // время следующего удара (мс)
    nextRepathAt: 0,       // время пересчёта пути к цели (мс)
    itemCooldownUntil: 0,  // кулдаун зелий/расходников (мс) — День 12
  };
}

// ============ Моб (из шаблона content/mobs) ============

export function createMobEntity(id, spawn, tmpl) {
  return {
    id,
    type: "mob",
    mobType: tmpl.type,
    name: tmpl.name,
    classIcon: tmpl.icon ?? "🐾",
    level: tmpl.level ?? 1,

    x: spawn.x,
    y: spawn.y,

    // Дом моба (для idle/return и лиша)
    spawnX: spawn.x,
    spawnY: spawn.y,

    hp: tmpl.maxHp,
    maxHp: tmpl.maxHp,
    mp: 0,
    maxMp: 0,

    atk: tmpl.atk ?? 1,
    defense: tmpl.defense ?? 0,
    speed: tmpl.speed ?? 3.0,

    aggressive: tmpl.aggressive ?? false,
    aggroRange: tmpl.aggroRange ?? 0,
    wanderRadius: tmpl.wanderRadius ?? 2,
    leashRange: tmpl.leashRange ?? 10,
    attackRange: tmpl.attackRange ?? 1.2,

    // Бой мобов (День 11): скорость атаки, крит, кулдаун следующего удара
    attackSpeed: tmpl.attackSpeed ?? 1.0,   // ударов в секунду → кулдаун
    critChance: tmpl.critChance ?? 0.03,    // шанс крита моба
    nextAttackAt: 0,                        // время следующего удара (мс)

    xp: tmpl.xp ?? 0,
    respawnSec: spawn.respawnSec ?? tmpl.respawnSec ?? 30,

    // Движение
    path: [],
    moveProgress: 0,
    state: "idle",
    justArrived: false,
    moveRange: tmpl.moveRange ?? 3, // дальность хода за один шаг ИИ, клеток

    // ИИ
    aiState: "idle",       // idle | chase | return | dead
    targetId: null,
    provoked: false,       // пассивный моб, которого ударили (День 9)
    aggro: false,          // агро → клиент рисует HP-бар
    nextWanderAt: 0,
    nextRepathAt: 0,
    respawnAt: 0,

    // Визуал
    color: tmpl.color ?? "#84cc16",
    size: tmpl.size ?? 1,
    sprite: tmpl.sprite ?? null,
    boss: tmpl.isBoss === true,
  };
}

// Форматирование для клиента
export function serializeEntity(e) {
  return {
    id: e.id,
    type: e.type,
    name: e.name,
    class: e.class,
    classIcon: e.classIcon,
    level: e.level,
    x: e.x,
    y: e.y,
    speed: e.speed,          // чтобы клиент шёл с той же скоростью, что и сервер
    moveRange: e.moveRange,  // дальность хода за один клик (День 9)
    hp: e.hp,
    maxHp: e.maxHp,
    mp: e.mp,
    maxMp: e.maxMp,
    atk: e.atk,            // атака/защита для HUD и панели персонажа (День 9)
    defense: e.defense,

    // Бой и ресурсы (День 13): радиус атаки, тип ресурса, замедление, каст
    attackRange: e.attackRange ?? 1,
    resource: e.resource ?? "mana",
    resourceName: e.resource === "energy" ? "Энергия" : "Мана",
    hpRegen: e.hpRegen ?? 0.5,
    resourceRegen: e.resourceRegen ?? 0.3,
    slow: e.slow ?? null,
    casting: e.casting ?? null,

    // Прогресс и характеристики (только у игроков) — окно персонажа, полоса опыта
    xp: e.xp,
    xpToNext: e.xpToNext,
    attrs: e.attrs,
    attrPoints: e.attrPoints,
    className: e.className,
    color: e.color,
    state: e.state,

    // Мобы / визуал
    mobType: e.mobType,
    size: e.size,
    sprite: e.sprite,
    aggro: e.aggro,
  };
}

// ============ Видимость сущности для других игроков ============

export function isVisibleEntity(e) {
  if (!e) return false;
  if (e.type === "mob") return e.aiState !== "dead";
  if (e.type === "player") return e.dead !== true;
  return true;
}