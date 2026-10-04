# 🖼 PNG-спрайты тайлов (часть 9, День 8)

Сюда положить (имена должны совпадать):

- `grass.png` — трава
- `water.png` — вода
- `road.png` — дорога
- `stone_road.png` — каменная дорога
- `stone.png` — камень

Рекомендуемый размер **32×32**, режим RGBA с прозрачностью.

Карта путей — `client/render/spriteRegistry.js`. Если файла нет (404),
`client/render/spriteLoader.js` откатывается на цветной квадрат из
`client/render/renderWorld.js` — игра работает и без картинок.