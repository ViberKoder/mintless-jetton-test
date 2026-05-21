# Деплой Mintless Jetton

Краткий порядок: **airdrop JSON → merkle root → деплой minter → Railway API**.

## Что нужно заранее

| Что | Зачем |
|-----|--------|
| Кошелёк с TON (admin) | Деплой jetton-minter (~1.5 TON) |
| `WALLET_MNEMONIC` | Для `blueprint run deployMintless` |
| Toncenter API key | Mainnet/testnet RPC |
| `airdrop.json` | Список получателей (owner, amount, окна claim) |
| `jetton.json` metadata | URI в `JETTON_METADATA_URI` (name, symbol, decimals…) |

## 1. Собрать Merkle tree (off-chain)

Скопируйте пример и заполните адреса:

```bash
cp data/airdrop.example.json data/airdrop.json
# отредактируйте data/airdrop.json
npm run build:airdrop
```

Появятся:

- `data/airdropData.boc` — словарь airdrop (для API)
- `data/merkle.json` — `merkle_root` для деплоя minter

Формат записи:

```json
{
  "owner": "0:<64 hex символа owner wallet>",
  "amount": "1000000000",
  "start_from": 1735689600,
  "expire_at": 1893456000
}
```

`amount` — в nanojettons (как `toNano()`). `start_from` / `expire_at` — unix time (48 bit в контракте).

## 2. Задеплоить Jetton Minter

`.env`:

```env
WALLET_MNEMONIC="word1 word2 ..."
WALLET_VERSION=v4
ADMIN_ADDRESS=EQ...
JETTON_METADATA_URI=https://your-domain.com/jetton.json
```

**Testnet:**

```bash
npx blueprint run deployMintless \
  --custom https://testnet.toncenter.com/api/v2/ \
  --custom-version v2 \
  --custom-type testnet \
  --custom-key YOUR_TONCENTER_KEY
```

**Mainnet:** замените endpoint на `https://toncenter.com/api/v2/` и `--custom-type mainnet`.

После деплоя: `data/minter.json` с адресом minter.

## 3. Claim API на Railway (TEP-176)

Переменные в Railway:

| Variable | Value |
|----------|--------|
| `PORT` | `3000` (Railway подставит сам) |
| `AIRDROP_BOC_PATH` | `data/airdropData.boc` |
| `MINTER_ADDRESS` | из `data/minter.json` |
| или `MINTER_JSON_PATH` | `data/minter.json` |

Закоммитьте `data/airdropData.boc` в репо **или** загрузите volume / artifact на Railway.

**Start command:** `npm run start:api`

### Эндпоинты

- `GET /health` — статус, merkle root, minter
- `GET /wallet/:address` — TEP-176 ответ для кошелька

`:address` — **raw** owner (`0:...`), не friendly `EQ...`.

Ответ при наличии airdrop:

```json
{
  "owner": "0:...",
  "jetton_wallet": "0:...",
  "custom_payload": "<base64 BoC>",
  "state_init": "<base64 BoC>",
  "compressed_info": {
    "amount": "...",
    "start_from": "...",
    "expired_at": "..."
  }
}
```

`custom_payload` — op `merkle_airdrop_claim` + Merkle proof. Кошелёк прикрепляет его к transfer для claim сжатого jetton wallet.

## 4. Metadata jetton

Пример off-chain `jetton.json`:

```json
{
  "name": "My Mintless",
  "symbol": "MMJ",
  "decimals": "9",
  "image": "https://your-domain.com/logo.png",
  "description": "Mintless airdrop jetton"
}
```

Укажите тот же URL в `JETTON_METADATA_URI` при деплое.

## Custom payload (как устроено)

В репозитории: `wrappers/JettonWallet.claimPayload(proof)` → cell `0x0df602d6` + ref(proof).

Proof: `airdropDict.generateMerkleProof(owner)` из `@ton/core` Dictionary.

## Локально проверить API

```bash
npm run build:airdrop
npm run start:api
curl http://localhost:3000/health
curl http://localhost:3000/wallet/0:...
```

## Масштаб (миллионы адресов)

Этот API держит словарь в памяти. Для больших airdrop смотрите [proof-machine](https://github.com/Trinketer22/proof-machine).
