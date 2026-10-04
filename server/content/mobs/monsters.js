// Обычные мобы: гоблин, волк, орк
// speed — клеток/сек, moveRange — дальность хода за один шаг (клеток),
// aggroRange — радиус агро в клетках (0 = не агрится)
// Статы пересчитаны от гоблина 100 HP (День 9)
// День 10: скорость мобов = скорость игрока 1 уровня (2.0 кл/сек), чтобы
// никто не обгонял воина на старте и убегание было честным

export const MONSTERS = {
  goblin: {
    type: "goblin",
    name: "Гоблин",
    icon: "👺",
    color: "#84cc16",

    hp: 100,
    maxHp: 100,
    atk: 18,
    defense: 5,
    speed: 2.0,
    moveRange: 4,

    // Агрессивный: агрится, если игрок ближе этого радиуса
    aggressive: true,
    aggroRange: 4,

    // Поведение вокруг спавна
    wanderRadius: 2,     // idle-брожение, клеток
    leashRange: 10,      // не уходит дальше от спавна
    attackRange: 1.2,    // дистанция атаки (День 9)

    // Бой (День 11): 1 удар/сек, 3% крита
    attackSpeed: 1.0,
    critChance: 0.03,

    xp: 10,
    respawnSec: 30,

    size: 1,
    sprite: null,        // PNG появится позже: /assets/mobs/goblin.png
  },

  wolf: {
    type: "wolf",
    name: "Волк",
    icon: "🐺",
    color: "#a8a29e",

    hp: 150,
    maxHp: 150,
    atk: 18,
    defense: 6,
    speed: 2.0,
    moveRange: 5,

    // Пассивный: сам не агрится (станет враждебным, если ударить — День 9)
    aggressive: false,
    aggroRange: 0,

    wanderRadius: 2,
    leashRange: 10,
    attackRange: 1.2,

    // Бой (День 11): волк чуть быстрее, крит 5%
    attackSpeed: 1.2,
    critChance: 0.05,

    xp: 15,
    respawnSec: 40,

    size: 1,
    sprite: null,        // /assets/mobs/wolf.png
  },

  orc: {
    type: "orc",
    name: "Орк",
    icon: "👹",
    color: "#b91c1c",

    hp: 250,
    maxHp: 250,
    atk: 30,
    defense: 10,
    speed: 2.0,
    moveRange: 3,

    aggressive: true,
    aggroRange: 3,

    wanderRadius: 2,
    leashRange: 10,
    attackRange: 1.2,

    // Бой (День 11): орк бьёт реже, но зато критует чаще
    attackSpeed: 0.8,
    critChance: 0.08,

    xp: 25,
    respawnSec: 60,

    size: 1.5,
    sprite: null,        // /assets/mobs/orc.png
  },
};

export function getMonster(type) {
  return MONSTERS[type] ?? null;
}

export function getAllMonsters() {
  return Object.values(MONSTERS);
}