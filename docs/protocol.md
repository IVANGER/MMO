# Протокол WebSocket

## Клиент → сервер

- `register`, `login` — авторизация
- `createCharacter`, `getCharacter` — персонаж
- `enterWorld`, `moveTo`, `stopMove` — мир
- `attack`, `useSkill` — бой
- `openLootBag`, `takeLootItem`, `takeAllLoot` — лут

## Сервер → клиент

- `authOk`, `character` — авторизация
- `worldState`, `worldUpdate` — мир (тик)
- `pathFound`, `locationChange` — движение
- `combatEvent`, `entityDied` — бой
- `lootBagSpawned`, `goldGained` — лут
