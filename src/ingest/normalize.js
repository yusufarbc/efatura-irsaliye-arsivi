'use strict';

/**
 * Türkçe sayı formatını (15.000,00) JS float'a çevirir.
 * Binlik ayraç: nokta, ondalık ayraç: virgül.
 */
function parseTrNumber(str) {
  if (str == null) return null;
  const cleaned = String(str)
    .trim()
    .replace(/\s/g, '')
    .replace(/TL$/i, '')
    .replace(/\./g, '')   // binlik ayraçları kaldır
    .replace(',', '.');   // ondalık virgülü noktaya çevir
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Türkçe KDV oranı string'ini (örn. "%20,00" veya "20,00") yüzde sayısına çevirir.
 * Dönen değer: 20 (yüzde olarak, 0.20 değil)
 */
function parseTrPercent(str) {
  if (str == null) return null;
  const cleaned = String(str).trim().replace('%', '').trim();
  return parseTrNumber(cleaned);
}

/**
 * GG-AA-YYYY formatındaki tarihi ISO 8601 (YYYY-MM-DD) formatına çevirir.
 */
function parseTrDate(str) {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

module.exports = { parseTrNumber, parseTrPercent, parseTrDate };
