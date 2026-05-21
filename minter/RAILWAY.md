# Деплой на Railway (всё уже настроено в коде)

Вам **не нужно** вручную менять `schema.prisma` или вызывать `db:push` — это делает `npm run build` при каждом деплое.

## Шаги в Railway (5 минут)

### 1. Новый проект

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Репозиторий: `mintless-jetton-test`
3. Ветка: `cursor/mintless-minter-app-a16e` (или `main` после merge)

### 2. Root Directory (важно)

**Вариант A (рекомендуется):** Settings → **Root Directory** → `minter`

**Вариант B:** Root Directory пустой — в корне репо `npm run build` уже идёт в `minter/` (см. `railway.toml` / `nixpacks.toml`)

Если в логах видите `ton-stable` и `blueprint build` — Railway собирает **не** минтер. Задайте Root Directory = `minter` или сделайте Redeploy после pull `main`.

### 3. PostgreSQL

1. В проекте → **+ New** → **Database** → **PostgreSQL**
2. Railway сам создаст переменную `DATABASE_URL` для веб-сервиса  
   (если нет — в Postgres → **Connect** → **Add to Service** ваш Next.js сервис)

### 4. Переменные веб-сервиса

**Variables** → добавить:

| Имя | Значение |
|-----|----------|
| `NEXT_PUBLIC_TON_NETWORK` | `testnet` (или `mainnet`) |

`NEXT_PUBLIC_APP_URL` — **не обязателен** (URL берётся из домена Railway автоматически).  
Если задавали `https://${{RAILWAY_PUBLIC_DOMAIN}}` и TON Connect ломается — **удалите** эту переменную и Redeploy.

`DATABASE_URL` из Postgres **не трогайте** — подставится сам.

### 5. Deploy

**Deploy** — при сборке: `prisma generate` + `next build` (без БД).

При **старте** контейнера: `prisma db push` (создаст таблицы — Postgres уже доступен).

> Postgres на Railway недоступен на этапе build, только при запуске.

### 6. Домен

**Settings** → **Networking** → **Generate Domain** → откройте `https://ваш-проект.up.railway.app`

## Как пользоваться сайтом

1. TON Connect — кошелёк
2. Метаданные + airdrop JSON
3. «Собрать Merkle tree»
4. «Создать jetton» (~1.5 TON в testnet)

## Локально (опционально)

Нужен Postgres (можно `railway connect` к облачной БД):

```bash
cd minter
cp .env.example .env
# в .env вставьте DATABASE_URL из Railway Postgres
npm install
npm run db:push
npm run dev
```

## Что такое Prisma / db:push (если интересно)

- **Prisma** — прослойка между сайтом и PostgreSQL
- **`schema.prisma`** — описание таблицы `Jetton`
- **`db:push`** — создать таблицы в Postgres; у вас это внутри `npm run build`, вручную не нужно
