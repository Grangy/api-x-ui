// src/utils/wgApiClient.js
require('dotenv').config();

let WG = require('wg-easy-api');
const WireGuardAPI = WG.default || WG.WireGuardAPI || WG;

const api = new WireGuardAPI(
  process.env.WG_PROTOCOL,           // "http" или "https"
  process.env.WG_HOST,               // хост или IP
  parseInt(process.env.WG_PORT, 10), // порт, например 51821
  process.env.WG_API_KEY             // API‑токен
);

module.exports = api;
