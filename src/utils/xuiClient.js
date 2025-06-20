const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const axios = require('axios');

const PANEL = {
  baseURL: process.env.XUI_URL,
  username: process.env.XUI_USER,
  password: process.env.XUI_PASS,
};

async function login(client) {
  await client.post(
    '/login',
    new URLSearchParams({ username: PANEL.username, password: PANEL.password }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
}

/**
 * Добавляет клиента в inbound, возвращает host и port.
 */
async function addClientToXui(inboundId, { uuid, id6 }) {
  const jar = new CookieJar();
  const client = wrapper(axios.create({ baseURL: PANEL.baseURL, jar, withCredentials: true }));
  await login(client);

  // Получаем текущую конфигурацию
  const { data: getData } = await client.get(`/panel/api/inbounds/get/${inboundId}`);
  const conf = getData.obj;
  if (!conf || !conf.settings) {
    throw new Error(`Inbound ${inboundId} not found or has no settings`);
  }

  const settings = JSON.parse(conf.settings);
  settings.clients = settings.clients || [];
  settings.clients.push({
    id: uuid,
    email: id6,
    enable: true,
    limitIp: 0,
    totalGB: 0,
    expiryTime: 0,
    flow: '',
    tgId: '',
    subId: id6,
    reset: 0,
  });

  // Обновляем inbound целиком
  await client.post(
    `/panel/api/inbounds/update/${inboundId}`,
    { ...conf, settings: JSON.stringify(settings) },
    { headers: { 'Content-Type': 'application/json' } }
  );

  // возвращаем host и port для генерации конфига
  const url = new URL(PANEL.baseURL);
  return { host: url.hostname, port: conf.port };
}

module.exports = { addClientToXui };