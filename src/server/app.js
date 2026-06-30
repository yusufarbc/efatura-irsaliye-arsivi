'use strict';

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Statik frontend
app.use(express.static(path.join(__dirname, '..', 'web')));

// API route'ları (yalnızca GET)
app.use('/api/documents', require('./routes/documents'));
app.use('/api/documents', require('./routes/documents_detail'));
app.use('/api/items', require('./routes/items_search'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`e-Fatura Arşivi çalışıyor: http://localhost:${PORT}`);
});

module.exports = app;
