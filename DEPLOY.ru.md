# Деплой Mintless Jetton

## Рекомендуется: веб-минтер

Папка **[minter/](./minter/)** — полноценное приложение:

1. Открываете сайт (Vercel / Railway)
2. TON Connect → подключаете кошелёк
3. Форма: название, символ, картинка, **airdrop JSON**
4. «Собрать Merkle tree» — БД сохраняет airdrop + merkle root
5. «Создать jetton» — подтверждаете ~1.5 TON в кошельке
6. Готово: адрес minter + Claim API URL

Инструкция: [minter/README.md](./minter/README.md)

### Vercel (кратко)

- Root Directory: `minter`
- `NEXT_PUBLIC_APP_URL` = ваш домен
- `NEXT_PUBLIC_TON_NETWORK` = `testnet` или `mainnet`
- БД: Neon / Vercel Postgres (`DATABASE_URL`), затем `npx prisma db push` в build или отдельно

### Railway

- Root: `minter`, Start: `npm run start`
- PostgreSQL plugin + `DATABASE_URL`
- Те же env, что на Vercel

---

## CLI (без веб-UI)

### 1. Merkle tree

```bash
cp data/airdrop.example.json data/airdrop.json
npm run build:airdrop
```

### 2. Деплой minter

```bash
npx blueprint run deployMintless --custom ... --custom-key KEY
```

### 3. Claim API

```bash
npm run start:api
```

Подробности в секциях ниже (legacy).

## Airdrop JSON (формат)

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

## Custom payload

`GET /api/jettons/{id}/wallet/{owner_raw}` — `custom_payload`, `state_init`, `compressed_info` (TEP-176).

## Библиотека wallet code

Контракт ссылается на jetton-wallet **library**. При ошибках деплоя на mainnet может понадобиться `deployLibrary` из корня репозитория.
