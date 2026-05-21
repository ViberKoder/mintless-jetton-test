# Mintless Jetton Minter

Веб-минтер: metadata + airdrop JSON → PostgreSQL → Merkle → TON Connect деплой.

## Railway (основной способ)

**Полная инструкция:** [RAILWAY.md](./RAILWAY.md)

Кратко: Root Directory = `minter`, добавить **PostgreSQL**, переменные `NEXT_PUBLIC_APP_URL` и `NEXT_PUBLIC_TON_NETWORK`. Prisma и таблицы — автоматически при деплое.

## Локально

```bash
cd minter
cp .env.example .env
# DATABASE_URL из Railway Postgres (Connect → copy)
npm install
npm run db:push
npm run dev
```
