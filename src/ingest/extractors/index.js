'use strict';

const gibStandardInvoice = require('./gibStandardInvoice');

// Dispatcher sırayla dener, ilk null-döndürmeyeni kullanır.
// Yeni entegratör/format için buraya ekle, mevcut dosyalara dokunma.
const extractors = [
  { name: 'gibStandardInvoice', extractor: gibStandardInvoice },
];

/**
 * @param {string} text - pdftotext -layout çıktısı
 * @returns {{ name: string, result: { header, items, confidence } } | null}
 */
function dispatch(text) {
  for (const { name, extractor } of extractors) {
    const result = extractor.extract(text);
    if (result !== null) {
      return { name, result };
    }
  }
  return null;
}

module.exports = { dispatch };
