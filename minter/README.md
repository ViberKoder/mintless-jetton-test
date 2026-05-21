# Mintless Jetton Minter (Web)

Веб-приложение: форма метаданных + airdrop JSON → БД (Merkle + BOC) → деплой minter через **TON Connect** → Claim API (TEP-176).

## Локально

```bash
cd minter
cp .env.example .env
npm install
npm run db:push
npm run dev
```

Откройте http://localhost:3000

## Vercel

1. Root Directory: **`minter`**
2. Env:
   - `DATABASE_URL` — для production лучше Postgres (Neon). Для быстрого теста можно SQLite volume не на Vercel — используйте **Neon** или **Vercel Postgres**
   - `NEXT_PUBLIC_APP_URL` — `https://your-app.vercel.app`
   - `NEXT_PUBLIC_TON_NETWORK` — `testnet` или `mainnet`
3. Build: `npm run build`
4. После деплоя обновите `public/tonconnect-manifest.json` поле `url` на ваш домен

## Railway

1. New Project → Deploy from repo, root **`minter`**
2. Add **PostgreSQL** (рекомендуется) или volume для SQLite
3. Для Postgres измените `prisma/schema.prisma` provider на `postgresql` и `npm run db:push`
4. Variables: как на Vercel
5. Start: `npm run start`

## Как пользоваться

1. Подключить кошелёк (TON Connect)
2. Заполнить name, symbol, airdrop JSON
3. «Собрать Merkle tree» — сохранение в БД
4. «Создать jetton» — транзакция ~1.5 TON, в контракт пишется metadata URI вида  
   `https://ваш-домен/api/jettons/{id}/jetton.json`
5. Claim API: `GET /api/jettons/{id}/wallet/{owner_raw}`

## Airdrop JSON

```json
[
  {
    "owner": "0:<64 hex>",
    "amount": "1000000000",
    "start_from": 1735689600,
    "expire_at": 1893456000
  }
]
```

`amount` — nanojettons.

## Библиотека jetton-wallet

Контракт использует **library** для wallet code (дешевле gas). На mainnet библиотека уже может быть задеплоена сообществом; иначе см. `scripts/deployLibrary.ts` в корне репозитория.
