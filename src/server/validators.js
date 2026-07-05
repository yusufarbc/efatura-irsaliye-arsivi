'use strict';

/**
 * CRUD endpoint'leri için alan doğrulayıcıları. Her doğrulayıcı
 * { ok: true, val } veya { ok: false, mesaj } döndürür.
 * Amaç: panelden gelen gövdeyi SQL'e sokmadan önce tipi garanti etmek —
 * whitelist dışı alan, yanlış tip, aşırı uzun metin reddedilir.
 */

function sayiVeyaNull(v) {
  if (v === null || v === '') return { ok: true, val: null };
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return { ok: false, mesaj: 'sayı olmalı' };
  return { ok: true, val: n };
}

function tamsayiVeyaNull(v) {
  const r = sayiVeyaNull(v);
  if (!r.ok || r.val === null) return r;
  if (!Number.isInteger(r.val)) return { ok: false, mesaj: 'tamsayı olmalı' };
  return r;
}

function metinVeyaNull(maxLen = 2000) {
  return (v) => {
    if (v === null || v === '') return { ok: true, val: null };
    if (typeof v !== 'string') return { ok: false, mesaj: 'metin olmalı' };
    const t = v.trim();
    if (t.length > maxLen) return { ok: false, mesaj: `en fazla ${maxLen} karakter` };
    return { ok: true, val: t || null };
  };
}

function zorunluMetin(maxLen = 2000) {
  return (v) => {
    if (typeof v !== 'string' || !v.trim()) return { ok: false, mesaj: 'boş olamaz' };
    if (v.trim().length > maxLen) return { ok: false, mesaj: `en fazla ${maxLen} karakter` };
    return { ok: true, val: v.trim() };
  };
}

function kumeden(izinliler) {
  const set = new Set(izinliler);
  return (v) => {
    if (v === null || v === '') return { ok: true, val: null };
    const s = String(v).toUpperCase();
    if (!set.has(s)) return { ok: false, mesaj: `şunlardan biri olmalı: ${izinliler.join(', ')}` };
    return { ok: true, val: s };
  };
}

function isoTarihVeyaNull(v) {
  if (v === null || v === '') return { ok: true, val: null };
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return { ok: false, mesaj: 'YYYY-AA-GG formatında olmalı' };
  }
  return { ok: true, val: v };
}

/**
 * Gövdedeki alanları şemaya göre doğrular; yalnızca şemada tanımlı VE gövdede
 * gönderilmiş alanları döndürür (kısmi güncelleme / PATCH semantiği).
 * Dönüş: { fields: {ad: değer}, errors: ['alan: mesaj'] }
 */
function dogrula(body, sema) {
  const fields = {};
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { fields, errors: ['Gövde bir JSON nesnesi olmalı'] };
  }
  for (const [ad, deger] of Object.entries(body)) {
    const validator = sema[ad];
    if (!validator) {
      errors.push(`${ad}: bilinmeyen alan`);
      continue;
    }
    const r = validator(deger);
    if (!r.ok) errors.push(`${ad}: ${r.mesaj}`);
    else fields[ad] = r.val;
  }
  return { fields, errors };
}

module.exports = {
  sayiVeyaNull,
  tamsayiVeyaNull,
  metinVeyaNull,
  zorunluMetin,
  kumeden,
  isoTarihVeyaNull,
  dogrula,
};
