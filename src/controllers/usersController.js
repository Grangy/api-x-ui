const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { nanoid } = require('nanoid');
const { v4: uuidv4 } = require('uuid');
const { addClientToXui } = require('../utils/xuiClient');

async function addUser(req, res) {
  try {
    const { inboundType, userId } = req.body;
    const inboundId = inboundType === 'vless' ? 2 : 10;

    const id6 = userId ? userId.slice(0,6) : nanoid(6);
    const uuid = uuidv4();

    console.log(`Adding client to XUI: inbound=${inboundId}, id6=${id6}, uuid=${uuid}`);
    const { host, port } = await addClientToXui(inboundId, { uuid, id6 });
    console.log(`Successfully added client in XUI on ${host}:${port}`);

    // Создание папки пользователя
    const userDir = path.join(process.cwd(), 'users', id6);
    console.log(`Creating user directory at ${userDir}`);
    try {
      fs.mkdirSync(userDir, { recursive: true });
      console.log('Directory created');
    } catch (err) {
      console.error('Failed to create directory:', err.message);
      throw err;
    }

    // Формирование конфигурации
    let config;
    if (inboundType === 'vless') {
      config = `vless://${uuid}@${host}:${port}?encryption=none&security=reality#${id6}`;
    } else {
      const method = 'aes-128-gcm';
      const ssUri = `${method}:${uuid}@${host}:${port}`;
      config = `ss://${Buffer.from(ssUri).toString('base64')}#${id6}`;
    }

    // Сохранение config.txt
    const cfgPath = path.join(userDir, 'config.txt');
    console.log(`Writing config to ${cfgPath}`);
    try {
      fs.writeFileSync(cfgPath, config);
      console.log('Config file saved');
    } catch (err) {
      console.error('Failed to write config file:', err.message);
      throw err;
    }

    // Генерация QR-кода
    const qrPath = path.join(userDir, 'qr.jpeg');
    console.log(`Generating QR code to ${qrPath}`);
    try {
      await QRCode.toFile(qrPath, config, { type: 'image/jpeg' });
      console.log('QR code saved');
    } catch (err) {
      console.error('Failed to generate QR code:', err.message);
      throw err;
    }

    res.json({ success: true, id: id6, uuid, config, files: { cfgPath, qrPath } });
  } catch (err) {
    console.error('Error in addUser:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { addUser };