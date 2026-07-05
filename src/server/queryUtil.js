'use strict';

/**
 * Query string'den gelen sayıyı doğrulayıp [min, max] aralığına sıkıştırır.
 * Sayı değilse varsayılanı döndürür — "limit=abc" SQL'e NaN göndermesin.
 */
function clampInt(value, { def, min, max }) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

/**
 * Kullanıcı girdisini LIKE deseni içinde kullanmadan önce joker karakterleri
 * etkisizleştirir. Sorguda ESCAPE '\' ile birlikte kullanılmalı:
 *   WHERE kolon LIKE ? ESCAPE '\'
 * Aksi halde "%%%" gibi bir arama her kaydı döndürür, "_" tek karakter eşleşir.
 */
function escapeLike(str) {
  return String(str).replace(/[\\%_]/g, (c) => '\\' + c);
}

/** escapeLike + baştan/sondan joker: "içeren" araması için hazır desen. */
function likeContains(str) {
  return `%${escapeLike(String(str).trim())}%`;
}

module.exports = { clampInt, escapeLike, likeContains };
