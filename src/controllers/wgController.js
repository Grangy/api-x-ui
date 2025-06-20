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

    // Создаём нового клиента
    const createRes = await api.createClient({ name });
    if (createRes.status !== 'success') {
      return res.status(400).json({ error: 'Не удалось создать клиента', details: createRes });
    }

    // Получаем список клиентов и ищем созданного
    const listRes = await api.getClients();
    if (listRes.status !== 'success') {
      return res.status(500).json({ error: 'Не удалось получить список клиентов', details: listRes });
    }
    const client = listRes.data.find(c => c.name === name);
    if (!client) {
      return res.status(500).json({ error: 'Созданный клиент не найден' });
    }
    const clientId = client.id;

    // Формируем короткий ID (5 символов)
    const id5 = clientId.slice(0, 5);

    // Запрашиваем конфиг и QR
    const qrRes     = await api.getClientQRCode({ clientId });
    const configRes = await api.getClientConfig({ clientId });
    if (qrRes.status !== 'success' || configRes.status !== 'success') {
      return res.status(500).json({ error: 'Не удалось получить QR или конфиг', qrRes, configRes });
    }

    // Папка users/wg/<id5>
    const outDir = path.join(process.cwd(), 'users', 'wg', id5);
    fs.mkdirSync(outDir, { recursive: true });

    // Сохранение config.conf
    fs.writeFileSync(
      path.join(outDir, 'config.conf'),
      configRes.data,
      'utf-8'
    );

    // Сохранение qr.jpeg
    await sharp(Buffer.from(qrRes.data))
      .jpeg()
      .toFile(path.join(outDir, 'qr.jpeg'));

    // Ответ
    res.json({
      client,
      paths: {
        config: `users/wg/${id5}/config.conf`,
        qr:     `users/wg/${id5}/qr.jpeg`
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createUser };