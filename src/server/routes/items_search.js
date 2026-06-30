'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/db');

// GET /api/items?q=<metin>&limit=&offset=
router.get('/', (req, res) => {
  const db = getDb();
  const { q, limit = 50, offset = 0 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'q parametresi en az 2 karakter olmalı' });
  }

  const pattern = `%${q.trim()}%`;
  const countRow = db.prepare(
    "SELECT COUNT(*) as total FROM items WHERE aciklama LIKE ?"
  ).get(pattern);

  const rows = db.prepare(`
    SELECT i.id, i.sira_no, i.aciklama, i.miktar, i.birim, i.birim_fiyat,
           i.kdv_orani, i.kdv_tutari, i.mal_hizmet_tutari,
           d.id as document_id, d.belge_no, d.duzenleme_tarihi,
           d.satici_unvan, d.alici_unvan, d.parse_durumu
    FROM items i
    JOIN documents d ON d.id = i.document_id
    WHERE i.aciklama LIKE ?
    ORDER BY d.duzenleme_tarihi DESC, d.id DESC
    LIMIT ? OFFSET ?
  `).all(pattern, parseInt(limit), parseInt(offset));

  res.json({ total: countRow.total, limit: parseInt(limit), offset: parseInt(offset), data: rows });
});

module.exports = router;
