'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/db');
const { dogrula } = require('../validators');
const { KALEM_SEMASI } = require('./documents_crud');

function kalemIdAl(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) {
    res.status(400).json({ error: 'Geçersiz id' });
    return null;
  }
  return id;
}

// PATCH /api/items/:id — kalemi kısmi güncelle
router.patch('/:id', (req, res) => {
  const id = kalemIdAl(req, res);
  if (id === null) return;
  const db = getDb();

  const mevcut = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
  if (!mevcut) return res.status(404).json({ error: 'Kalem bulunamadı' });

  const { fields, errors } = dogrula(req.body, KALEM_SEMASI);
  if (errors.length) return res.status(400).json({ error: 'Doğrulama hatası', detaylar: errors });
  if (!Object.keys(fields).length) return res.status(400).json({ error: 'Güncellenecek alan yok' });

  const sets = Object.keys(fields).map((k) => `${k} = :${k}`).join(', ');
  db.prepare(`UPDATE items SET ${sets} WHERE id = :__id`).run({ ...fields, __id: id });

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json(item);
});

// DELETE /api/items/:id
router.delete('/:id', (req, res) => {
  const id = kalemIdAl(req, res);
  if (id === null) return;
  const db = getDb();

  const result = db.prepare('DELETE FROM items WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'Kalem bulunamadı' });
  res.json({ ok: true });
});

module.exports = router;
