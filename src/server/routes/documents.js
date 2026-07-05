'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/db');
const { clampInt, likeContains } = require('../queryUtil');

const BELGE_TIPLERI = new Set(['FATURA', 'IRSALIYE']);
const PARSE_DURUMLARI = new Set(['BASARILI', 'SUPHELI', 'HATALI']);
const ISO_TARIH_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  } = req.query;

  const limit = clampInt(req.query.limit, { def: 50, min: 1, max: 500 });
  const offset = clampInt(req.query.offset, { def: 0, min: 0, max: 1e9 });

  const conditions = [];
  const positional = [];

  if (tarih_baslangic && ISO_TARIH_RE.test(tarih_baslangic)) {
    conditions.push('d.duzenleme_tarihi >= ?'); positional.push(tarih_baslangic);
  }
  if (tarih_bitis && ISO_TARIH_RE.test(tarih_bitis)) {
    conditions.push('d.duzenleme_tarihi <= ?'); positional.push(tarih_bitis);
  }
  if (belge_tipi && BELGE_TIPLERI.has(belge_tipi.toUpperCase())) {
    conditions.push('d.belge_tipi = ?'); positional.push(belge_tipi.toUpperCase());
  }
  if (satici) {
    conditions.push("tr_lower(s.unvan) LIKE tr_lower(?) ESCAPE '\\'");
    positional.push(likeContains(satici));
  }
  if (alici) {
    conditions.push("tr_lower(a.unvan) LIKE tr_lower(?) ESCAPE '\\'");
    positional.push(likeContains(alici));
  }
  if (belge_no) {
    conditions.push("tr_lower(d.belge_no) LIKE tr_lower(?) ESCAPE '\\'");
    positional.push(likeContains(belge_no));
  }
  if (parse_durumu && PARSE_DURUMLARI.has(parse_durumu.toUpperCase())) {
    conditions.push('d.parse_durumu = ?'); positional.push(parse_durumu.toUpperCase());
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const joins = `
     FROM documents d
     LEFT JOIN taraflar s ON s.id = d.satici_id
     LEFT JOIN taraflar a ON a.id = d.alici_id
  `;

  const countRow = db.prepare(`SELECT COUNT(*) as total ${joins} ${where}`).get(...positional);
  const rows = db.prepare(
    `SELECT d.id, d.belge_tipi, d.belge_no, d.ettn, d.duzenleme_tarihi, d.senaryo, d.fatura_tipi,
            s.unvan as satici_unvan, s.vkn_tckn as satici_vkn_tckn,
            a.unvan as alici_unvan, a.vkn_tckn as alici_vkn_tckn,
            d.mal_hizmet_toplam_tutari, d.vergiler_dahil_toplam_tutar, d.odenecek_tutar,
            d.parse_durumu, d.parse_notu, d.kaynak_dosya, d.olusturma_tarihi
     ${joins} ${where}
     ORDER BY d.duzenleme_tarihi DESC, d.id DESC
     LIMIT ? OFFSET ?`
  ).all(...positional, limit, offset);

  res.json({ total: countRow.total, limit, offset, data: rows });
});

module.exports = router;
