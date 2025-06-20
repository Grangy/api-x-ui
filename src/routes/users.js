const express = require('express');
const { addUser } = require('../controllers/usersController');
const router = express.Router();
// POST /api/users
router.post('/', addUser);
module.exports = router;