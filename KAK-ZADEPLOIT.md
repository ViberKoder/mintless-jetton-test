# Не получается задеплоить / смержить? Читайте сюда

## Быстрый ответ

Вам **не обязательно** мержить ветки. Достаточно папки **`minter/`**.

Три рабочих пути:

1. **Railway с компьютера** — `railway up` из папки `minter` (GitHub не нужен) → [minter/DEPLOY-BEZ-GITHUB.md](./minter/DEPLOY-BEZ-GITHUB.md)
2. **Свой новый репозиторий** — скопировать только `minter`, push в свой GitHub → Railway подключает ваш репо
3. **Скачать ZIP** — Code → Download ZIP на GitHub, взять папку `minter`

Подробно: **[minter/DEPLOY-BEZ-GITHUB.md](./minter/DEPLOY-BEZ-GITHUB.md)**

---

## Где код сейчас

| Ветка | Что там |
|-------|---------|
| `main` на `ViberKoder/mintless-jetton-test` | Контракты + папка `minter/` (веб-минтер) |

Если ваш fork от другого автора (без `minter/`) — **не merge**, а копируйте папку `minter` (см. выше).

---

## Railway за 3 шага (свой репо или `railway up`)

1. Postgres в проекте Railway  
2. `NEXT_PUBLIC_APP_URL` = `https://${{RAILWAY_PUBLIC_DOMAIN}}`  
3. `NEXT_PUBLIC_TON_NETWORK` = `testnet`  

Root Directory:
- полный репозиторий → **`minter`**
- только standalone ZIP → **корень** (`.`)
