# Деплой без merge и без доступа к чужому репозиторию

Если вы **не можете** смержить ветку и **не можете** подключить `mintless-jetton-test` к Railway — используйте один из способов ниже.

---

## Способ 1 — Railway с вашего компьютера (без GitHub)

Нужны только папка `minter` и аккаунт Railway.

```bash
# 1. Скачайте ZIP (см. способ 3) или склонируйте репо и зайдите в minter/
cd minter

# 2. Railway CLI
npm i -g @railway/cli
railway login

# 3. Новый проект
railway init

# 4. Postgres в том же проекте (в браузере railway.app → + PostgreSQL)
#    или: railway add --database postgres

# 5. Переменные (в dashboard или CLI)
railway variables set NEXT_PUBLIC_TON_NETWORK=testnet
railway variables set 'NEXT_PUBLIC_APP_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}'

# 6. Деплой текущей папки (файлы уходят напрямую, GitHub не нужен)
railway up
```

В Dashboard → **Settings** → **Networking** → **Generate Domain**.

---

## Способ 2 — Свой новый репозиторий на GitHub

1. На GitHub: **New repository** (пустой, без README).
2. На компьютере:

```bash
cd /path/to/mintless-jetton-standalone   # из ZIP, см. способ 3
git init
git add .
git commit -m "Mintless jetton minter"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПО.git
git push -u origin main
```

3. Railway → Deploy from GitHub → **ваш** репозиторий.
4. Root Directory: оставьте **пустым** (корень = уже только minter).
5. + PostgreSQL, переменные как в [RAILWAY.md](./RAILWAY.md).

---

## Способ 3 — Скачать только minter (ZIP)

В репозитории `ViberKoder/mintless-jetton-test`, ветка **`main`**:

**Вариант A** — с GitHub в браузере:
- Code → Download ZIP → распаковать → зайти в папку `minter/`

**Вариант B** — скрипт (если есть полный клон):

```bash
cd mintless-jetton-test
bash minter/scripts/make-standalone.sh
# появится mintless-minter-standalone.zip рядом с репо
```

Дальше — способ 1 или 2.

---

## Способ 4 — Docker на Railway

1. Загрузите **только папку `minter`** (ZIP из способа 3) в свой репо **или** используйте `railway up` из папки minter.
2. В Railway: **Settings** → Builder = **Dockerfile** (файл `Dockerfile` уже в minter).
3. PostgreSQL + переменные как выше.

---

## Ветка `main` уже содержит минтер

Если у вас есть доступ к `github.com/ViberKoder/mintless-jetton-test`:

- ветка **`main`** (не cursor/*) уже включает папку `minter/`
- Railway: Root Directory = **`minter`**

Если форк от **Trinketer22** (оригинал без minter) — не merge, а **скопируйте папку `minter`** (способ 2 или 3).

---

## Что вам НЕ нужно делать вручную

- Менять `schema.prisma` — уже `postgresql`
- Вызывать `db:push` — внутри `npm run build` при деплое

---

## Если что-то падает

Пришлите **Build Logs** из Railway. Частые причины:

| Ошибка | Решение |
|--------|---------|
| `DATABASE_URL` не задан | Добавить PostgreSQL и привязать к сервису |
| Root Directory неверный | Для полного репо: `minter`; для standalone ZIP: корень `.` |
| Build без Postgres | Сначала создать БД в проекте, потом Redeploy |
