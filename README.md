# 3X-UI User Manager

**CLI & HTTP API для автоматизации добавления клиентов (VLESS, Shadowsocks, WireGuard) в панели 3X‑UI и WG‑Easy**, генерации конфигурационных файлов и QR-кодов.

---

## 📂 Структура проекта
```bash
3x-ui-user-manager/
├── .env.example           # Пример окружения
├── package.json           # Зависимости и скрипты
├── README.md              # Краткое описание проекта (этот файл)
├── README_FULL.md         # Подробная документация
├── src/                   # Исходный код
│   ├── index.js           # Точка входа: HTTP‑сервер Express
│   ├── routes/            # HTTP‑маршруты
│   │   ├── users.js       # POST /api/users (VLESS/SS)
│   │   └── wg.js          # POST /api/wg/users (WireGuard)
│   ├── controllers/       # Логика обработки запросов
│   │   ├── usersController.js  # VLESS/SS: создание файлов
│   │   └── wgController.js     # WireGuard: создание файлов
│   └── utils/             # Утилиты
│       ├── xuiClient.js   # HTTP‑клиент 3X‑UI API
│       └── wgApiClient.js # HTTP‑клиент WG‑Easy API
└── users/                 # Динамические папки с клиентами
    ├── vless/             # VLESS‑клиенты
    │   └── <id5>/
    │       ├── config.conf
    │       └── qr.jpeg
    ├── ss/                # Shadowsocks‑клиенты
    │   └── <id5>/
    │       ├── config.conf
    │       └── qr.jpeg
    └── wg/                # WireGuard‑клиенты
        └── <id5>/
            ├── config.conf
            └── qr.jpeg
```

---

## ⚙️ Установка и запуск

1. **Клонировать проект и установить зависимости**
   ```bash
   git clone <repo-url>  && cd 3x-ui-user-manager
   npm install
   ```

2. **Настроить `.env`**
   ```bash
   cp .env.example .env
   # 3X-UI API:
   XUI_URL=
   XUI_USER=
   XUI_PASS=
   # WG‑Easy API:
   WG_PROTOCOL=http
   WG_HOST=77.105.164.42
   WG_PORT=51821
   WG_API_KEY=22170313
   ```

3. **Добавить скрипты в `package.json`**
   ```json
   "scripts": {
     "start": "node src/index.js",
     "dev":   "nodemon src/index.js"
   }
   ```

4. **Запустить сервер**
   - **Production**: `npm start`
   - **Development**: `npm run dev`

---

## 🚀 Быстрый старт: HTTP API

### 1) Добавление VLESS‑клиента
```bash
curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d '{
           "inboundType": "vless"
         }'
```
**Ответ**:
```json
{
  "success": true,
  "id": "a1b2c",                // 5‑символьный UID
  "uuid": "...",
  "config": "vless://...#a1b2c",
  "files": {
    "cfgPath": "/.../users/vless/a1b2c/config.conf",
    "qrPath":  "/.../users/vless/a1b2c/qr.jpeg"
  }
}
```

### 2) Добавление Shadowsocks‑клиента
```bash
curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d '{
           "inboundType": "shadowsocks"
         }'
```
**Ответ** аналогично (папка `users/ss/<id5>/`).

### 3) Добавление WireGuard‑клиента
```bash
curl -X POST http://localhost:3000/api/wg/users \
     -H "Content-Type: application/json" \
     -d '{"name":"wg-client-01"}'
```
**Ответ**:
```json
{
  "client": { /* объект клиента WG‑Easy */ },
  "paths": {
    "config": "users/wg/1a2b3/config.conf",
    "qr":     "users/wg/1a2b3/qr.jpeg"
  }
}
```

---

## 📄 Описание новых файлов для WireGuard

### 1. `src/utils/wgApiClient.js`
```js
require('dotenv').config();
let WG = require('wg-easy-api');
const WireGuardAPI = WG.default || WG.WireGuardAPI || WG;
const api = new WireGuardAPI(
  process.env.WG_PROTOCOL,
  process.env.WG_HOST,
  parseInt(process.env.WG_PORT, 10),
  process.env.WG_API_KEY
);
module.exports = api;
```
- Инициирует HTTP‑клиент WG‑Easy API с авторизацией по API‑ключу.

### 2. `src/controllers/wgController.js`
```js
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');
const api   = require('../utils/wgApiClient');

async function createUser(req, res, next) {
  try {
    const { name } = req.body;
    // Авторизация
    if (typeof api.initSession === 'function') {
      await api.initSession({ password: process.env.WG_API_KEY });
    } else {
      await api.createSession({ password: process.env.WG_API_KEY });
    }
    // Создание клиента и поиск в списке
    const { status } = await api.createClient({ name });
    if (status !== 'success') return res.status(400).json({ error: '...' });
    const list = await api.getClients();
    const client = list.data.find(c => c.name === name);
    const id5 = client.id.slice(0,5);
    // Запрос конфига и QR
    const qrRes = await api.getClientQRCode({ clientId: client.id });
    const cfgRes= await api.getClientConfig({ clientId: client.id });
    // Папка и файлы
    const dir = path.join(process.cwd(), 'users', 'wg', id5);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir,'config.conf'), cfgRes.data);
    await sharp(Buffer.from(qrRes.data)).jpeg().toFile(path.join(dir,'qr.jpeg'));
    res.json({ client, paths: { config: `users/wg/${id5}/config.conf`, qr: `users/wg/${id5}/qr.jpeg` }});
  } catch (e) { next(e); }
}
module.exports = { createUser };
```
- Создаёт клиента, сохраняет `config.conf` и `qr.jpeg` в папку `users/wg/<id5>/`.

### 3. `src/routes/wg.js`
```js
const express = require('express');
const router  = express.Router();
const { createUser } = require('../controllers/wgController');
router.post('/users', createUser);
module.exports = router;
```
- Маршрут POST `/api/wg/users` для создания WireGuard‑клиента.

---

## 🎛️ Полная структура с новыми файлами
```bash
src/
├── routes/
│   ├── users.js
│   └── wg.js
├── controllers/
│   ├── usersController.js
│   └── wgController.js
├── utils/
│   ├── xuiClient.js
│   └── wgApiClient.js
└── index.js
```

---

## 📜 Лицензия
MIT © Max Dolya

