// src/controllers/usersController.js
const fs         = require('fs');
const path       = require('path');
const QRCode     = require('qrcode');
const { nanoid } = require('nanoid');
const { v4: uuidv4 } = require('uuid');
const { addClientToXui } = require('../utils/xuiClient');

async function addUser(req, res) {
  try {
    const { inboundType } = req.body;
    // inboundType: 'vless' или 'shadowsocks'
    const inboundId = inboundType === 'vless' ? 2 : 10;

    // Всегда случайный 5‑символьный UID
    const id5   = nanoid(5);
    const uuid  = uuidv4();
    const proto = inboundType === 'vless' ? 'vless' : 'ss';

    // Добавляем клиента в XUI
    const { host, port } = await addClientToXui(inboundId, { uuid, id6: id5 });

    // Папка users/<protocol>/<id5>
    const userDir = path.join(process.cwd(), 'users', proto, id5);
    fs.mkdirSync(userDir, { recursive: true });

    // Формируем URI‑конфиг
    let config;
    if (inboundType === 'vless') {
      config = `vless://${uuid}@${host}:${port}?encryption=none&security=reality#${id5}`;
    } else {
      const method = 'aes-128-gcm';
      const ssUri  = `${method}:${uuid}@${host}:${port}`;
      config = `ss://${Buffer.from(ssUri).toString('base64')}#${id5}`;
    }

    // Сохраняем config.conf
    const cfgPath = path.join(userDir, 'config.conf');
    fs.writeFileSync(cfgPath, config, 'utf-8');

    // Генерируем QR‑jpeg
    const qrPath = path.join(userDir, 'qr.jpeg');
    await QRCode.toFile(qrPath, config, { type: 'image/jpeg' });

    // Ответ
    res.json({
      success: true,
      id:      id5,
      uuid,
      config,
      files: { cfgPath, qrPath }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { addUser };
