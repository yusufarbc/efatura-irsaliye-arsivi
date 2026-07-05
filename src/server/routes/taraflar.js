'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/db');
const { clampInt, likeContains } = require('../queryUtil');
const { zorunluMetin, metinVeyaNull, dogrula } = require('../validators');

const TARAF_SEMASI = {
  unvan: zorunluMetin(500),
  vkn_tckn: metinVeyaNull(20),
  vergi_dairesi: metinVeyaNull(200),
  adres: metinVeyaNull(1000),
  eposta: metinVeyaNull(200),
  telefon: metinVeyaNull(50),
};

// GET /api/taraflar?q=&limit=&offset= — unvan veya VKN/TCKN'ye göre ara
router.get('/', (req, res) => {
  const db = getDb();
  const { q } = req.query;
  const limit = clampInt(req.query.limit, { def: 50, min: 1, max: 500 });
  const offset = clampInt(req.query.offset, { def: 0, min: 0, max: 1e9 });

  let where = '';
  const positional = [];
  if (q && q.trim()) {
    where = "WHERE tr_lower(t.unvan) LIKE tr_lower(?) ESCAPE '\\' OR t.vkn_tckn LIKE ? ESCAPE '\\'";
    const pattern = likeContains(q);
    positional.push(pattern, pattern);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM taraflar t ${where}`).get(...positional);
  const rows = db.prepare(`
    SELECT t.*,
           (SELECT COUNT(*) FROM documents d WHERE d.satici_id = t.id) as satici_belge_sayisi,
           (SELECT COUNT(*) FROM documents d WHERE d.alici_id = t.id) as alici_belge_sayisi
    FROM taraflar t ${where}
    ORDER BY t.unvan COLLATE NOCASE
    LIMIT ? OFFSET ?
  `).all(...positional, limit, offset);

  res.json({ total: countRow.total, limit, offset, data: rows });
});

// PATCH /api/taraflar/:id — taraf bilgisini düzelt (tüm belgelerine yansır)
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id) || id < 1) return res.status(400).json({ error: 'Geçersiz id' });
  const db = getDb();

  const mevcut = db.prepare('SELECT id FROM taraflar WHERE id = ?').get(id);
  if (!mevcut) return res.status(404).json({ error: 'Taraf bulunamadı' });

  const { fields, errors } = dogrula(req.body, TARAF_SEMASI);
  if (errors.length) return res.status(400).json({ error: 'Doğrulama hatası', detaylar: errors });
  if (!Object.keys(fields).length) return res.status(400).json({ error: 'Güncellenecek alan yok' });

  const sets = Object.keys(fields).map((k) => `${k} = :${k}`).join(', ');
  try {
    db.prepare(`UPDATE taraflar SET ${sets} WHERE id = :__id`).run({ ...fields, __id: id });
  } catch (err) {
    if (/UNIQUE.*vkn_tckn/i.test(err.message)) {
      return res.status(409).json({ error: 'Bu VKN/TCKN başka bir tarafta zaten kayıtlı' });
    }
    throw err;
  }

  const taraf = db.prepare('SELECT * FROM taraflar WHERE id = ?').get(id);
  res.json(taraf);
});

module.exports = router;
