// src/routes/wg.js
const express     = require('express');
const router      = express.Router();
const { createUser } = require('../controllers/wgController');

// POST /api/wg/users — создать WireGuard‑пользователя
router.post('/users', createUser);

module.exports = router;
