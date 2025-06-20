# 3X-UI User Manager

**CLI & HTTP API для автоматизации добавления клиентов (VLESS, Shadowsocks) в панель 3X‑UI**, генерации конфигурационных файлов и QR-кодов.

---

## 📂 Структура проекта
```bash
3x-ui-user-manager/
├── .env.example          # Пример окружения
├── package.json          # Зависиимости и скрипты
├── README.md             # Краткое описание проекта
├── README_FULL.md        # Подробная документация (этот файл)
├── src/                  # Исходный код
│   ├── index.js          # Точка входа: HTTP-сервер Express
│   ├── routes/           # HTTP-маршруты
│   │   └── users.js      # POST /api/users
│   ├── controllers/      # Логика работы API
│   │   └── usersController.js  # Обработка запроса, создание файлов
│   └── utils/            # Утилиты
│       └── xuiClient.js  # HTTP-клиент для 3X‑UI API (login, get, update)
└── users/                # Динамически создаваемые папки пользователей
    └── <userId>/         # Пример: users/ABC123/
        ├── config.txt    # Конфигурационная строка (VLESS/SS)
        └── qr.jpeg       # QR‑код для быстрого импорта
```  

---

## ⚙️ Установка и запуск

1. **Клонировать или создать папку проекта**
   ```bash
   mkdir 3x-ui-user-manager && cd 3x-ui-user-manager
   ```

2. **Инициализировать `package.json` и установить зависимости**
   ```bash
   npm init -y
   npm install express axios axios-cookiejar-support tough-cookie dotenv nanoid uuid qrcode readline-promises
   npm install --save-dev nodemon
   ```

3. **Настроить переменные окружения**
   ```bash
   cp .env.example .env
   # отредактировать .env, указав:
   # XUI_URL, XUI_USER, XUI_PASS, PORT (опционально)
   ```

4. **Добавить скрипты в `package.json`**
   ```diff
   "scripts": {
-    "test": "echo \"Error: no test specified\" && exit 1"
+    "start": "node src/index.js",
+    "dev": "nodemon src/index.js"
   }
   ```

5. **Запустить сервер**
   - **Production**:  `npm start`
   - **Development**: `npm run dev` (автоперезапуск при изменениях)

6. **(Опционально) Проверить CLI-скрипт**
   ```bash
   node src/cli.js   # если есть CLI-версия или `node add-users-3x-ui.js`
   ```

---

## ⚙️ Файл `.env.example`
```dotenv
XUI_URL=http://95.164.53.215:11706
XUI_USER=root
XUI_PASS=DMax22170313
# PORT=3000      # опционально
```  

---

## 🚀 Быстрый старт

### HTTP API

**Добавить пользователя**

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"inboundType":"vless","userId":"ABC123"}'
```

**Пример успешного ответа**
```json
{
  "success": true,
  "id": "ABC123",
  "uuid": "bbfad557-28f2-47e5-9f3d-e3c7f532fbda",
  "config": "vless://bbfad557-...",
  "files": {
    "cfgPath": "/.../users/ABC123/config.txt",
    "qrPath": "/.../users/ABC123/qr.jpeg"
  }
}
```

- В папке `users/ABC123` появятся `config.txt` и `qr.jpeg`.

### CLI (Интерактивный режим)

```bash
node src/cli.js
```

1. Ввод имени inbound (1 – VLESS, 2 – Shadowsocks).
2. Опциональный ввод собственного userId (или генерация nanoid).
3. Скрипт выводит логи и создаёт папку с файлами.

---

## 📖 Описание ключевых файлов

### 1. `src/index.js`
```js
require('dotenv').config();
const express = require('express');
const usersRouter = require('./routes/users');

const app = express();
app.use(express.json());
app.use('/api/users', usersRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```
- Инициализирует сервер Express.
- Подключает JSON-парсер и роуты.

### 2. `src/routes/users.js`
```js
const express = require('express');
const { addUser } = require('../controllers/usersController');
const router = express.Router();

// POST /api/users
router.post('/', addUser);

module.exports = router;
```
- Определяет единственный маршрут для добавления пользователя.

### 3. `src/controllers/usersController.js`
```js
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { nanoid } = require('nanoid');
const { v4: uuidv4 } = require('uuid');
const { addClientToXui } = require('../utils/xuiClient');

async function addUser(req, res) {
  try {
    const { inboundType, userId } = req.body;
    const inboundId = inboundType === 'vless' ? 2 : 5;
    const id6 = userId?.slice(0,6) || nanoid(6);
    const uuid = uuidv4();
    console.log(`Adding client to XUI: inbound=${inboundId}, id6=${id6}, uuid=${uuid}`);

    // Добавление через utils/xuiClient
    const { host, port } = await addClientToXui(inboundId, { uuid, id6 });

    // Файловые операции
    const userDir = path.join(process.cwd(), 'users', id6);
    fs.mkdirSync(userDir, { recursive: true });
    const config = inboundType === 'vless'
      ? `vless://${uuid}@${host}:${port}?encryption=none&security=reality#${id6}`
      : `ss://${Buffer.from(`aes-128-gcm:${uuid}@${host}:${port}`).toString('base64')}#${id6}`;
    fs.writeFileSync(path.join(userDir, 'config.txt'), config);
    await QRCode.toFile(path.join(userDir, 'qr.jpeg'), config, { type: 'image/jpeg' });

    res.json({ success: true, id: id6, uuid, config, files: {
      cfgPath: path.join(userDir, 'config.txt'),
      qrPath: path.join(userDir, 'qr.jpeg')
    }});
  } catch (err) {
    console.error('Error in addUser:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { addUser };
```
- Логирует каждый шаг.
- Вызывает `addClientToXui` для работы с панелью.
- Создаёт директорию, сохраняет конфиг и QR.

### 4. `src/utils/xuiClient.js`
```js
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const axios = require('axios');
require('dotenv').config();

const PANEL = {
  baseURL: process.env.XUI_URL,
  username: process.env.XUI_USER,
  password: process.env.XUI_PASS
};

async function login(client) {
  await client.post('/login', new URLSearchParams({
    username: PANEL.username,
    password: PANEL.password
  }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
}

async function addClientToXui(inboundId, { uuid, id6 }) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ baseURL: PANEL.baseURL, jar, withCredentials: true }));
  await login(client);

  // Получаем текущую конфигурацию инбаунда
  const { data } = await client.get(`/panel/api/inbounds/get/${inboundId}`);
  const conf = data.obj;
  const s = JSON.parse(conf.settings);
  s.clients = s.clients || [];
  s.clients.push({ id: uuid, email: id6, enable: true, limitIp:0, totalGB:0, expiryTime:0, flow:'', tgId:'', subId:id6, reset:0 });

  // Отправляем полный update
  await client.post(`/panel/api/inbounds/update/${inboundId}`, {
    ...conf,
    settings: JSON.stringify(s)
  }, { headers: { 'Content-Type': 'application/json' } });

  const { host, port } = new URL(PANEL.baseURL);
  return { host, port: conf.port };
}

module.exports = { addClientToXui };
```
- Выполняет login → get → update для добавления клиента.
- Возвращает host и port для генерации конфигов.

---

## ⚙️ Разработка и тестирование

- **Логи**: все важные шаги выводятся в консоль.
- **HTTP**: используйте Postman или `curl`.
- **CLI**: при наличии `src/cli.js` можно запускать `node src/cli.js`.

---

## 📝 Лицензия
MIT © Max Dolya

