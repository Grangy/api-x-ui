// src/index.js
require('dotenv').config();
const express       = require('express');
const app           = express();

app.use(express.json());

// Существующий роутер 3X‑UI
const usersRouter = require('./routes/users');
app.use('/api/users', usersRouter);

// Новый WireGuard‑роут
const wgRouter    = require('./routes/wg');
app.use('/api/wg', wgRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
