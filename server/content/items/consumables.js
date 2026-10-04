// Расходники: зелья, еда, свитки (День 12)
// Используются через useItem, перетаскиваются в хотбар (слоты 5-8)

export const CONSUMABLES = {
  health_potion: {
    type: "health_potion",
    name: "Зелье здоровья",
    icon: "🧪",
    description: "Восстанавливает 50 HP",
    slot: "consumable",
    rarity: "common",
    effect: { type: "heal", hp: 50 },
    cooldown: 10,                 // сек — общий кулдаун на зелья
    stackable: true,
    maxStack: 99,
    price: 25,
  },
};
