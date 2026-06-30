'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/db');

// GET /api/documents
// Query params: tarih_baslangic, tarih_bitis, belge_tipi, satici, alici, belge_no, parse_durumu, limit, offset
router.get('/', (req, res) => {
  const db = getDb();
  const {
    tarih_baslangic,
    tarih_bitis,
    belge_tipi,
    satici,
    alici,
    belge_no,
    parse_durumu,
    limit = 50,
    offset = 0,
  } = req.query;

  const conditions = [];
  const positional = [];

  if (tarih_baslangic) { conditions.push('duzenleme_tarihi >= ?'); positional.push(tarih_baslangic); }
  if (tarih_bitis)     { conditions.push('duzenleme_tarihi <= ?'); positional.push(tarih_bitis); }
  if (belge_tipi)      { conditions.push('belge_tipi = ?');        positional.push(belge_tipi.toUpperCase()); }
  if (satici)          { conditions.push('satici_unvan LIKE ?');    positional.push(`%${satici}%`); }
  if (alici)           { conditions.push('alici_unvan LIKE ?');     positional.push(`%${alici}%`); }
  if (belge_no)        { conditions.push('belge_no LIKE ?');        positional.push(`%${belge_no}%`); }
  if (parse_durumu)    { conditions.push('parse_durumu = ?');       positional.push(parse_durumu.toUpperCase()); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM documents ${where}`).get(...positional);
  const rows = db.prepare(
    `SELECT id, belge_tipi, belge_no, ettn, duzenleme_tarihi, senaryo, fatura_tipi,
            satici_unvan, satici_vkn_tckn, alici_unvan, alici_vkn_tckn,
            mal_hizmet_toplam_tutari, vergiler_dahil_toplam_tutar, odenecek_tutar,
            parse_durumu, parse_notu, kaynak_dosya, olusturma_tarihi
     FROM documents ${where}
     ORDER BY duzenleme_tarihi DESC, id DESC
     LIMIT ? OFFSET ?`
  ).all(...positional, parseInt(limit), parseInt(offset));

  res.json({ total: countRow.total, limit: parseInt(limit), offset: parseInt(offset), data: rows });
});

module.exports = router;
