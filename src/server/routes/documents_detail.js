'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/db');

// GET /api/documents/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Geçersiz id' });

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
  if (!doc) return res.status(404).json({ error: 'Belge bulunamadı' });

  const items = db.prepare('SELECT * FROM items WHERE document_id = ? ORDER BY sira_no').all(id);
  res.json({ ...doc, items });
});

module.exports = router;
