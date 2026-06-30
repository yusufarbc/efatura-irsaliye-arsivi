'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { extract } = require('../src/ingest/extractors/gibStandardInvoice');

const sampleText = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'gib_standard_invoice_sample.txt'),
  'utf8'
);
const expected = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'gib_standard_invoice_expected.json'),
  'utf8'
));

let result;

test('gibStandardInvoice: örnek metni tanımalı', () => {
  result = extract(sampleText);
  assert.notEqual(result, null, 'extract() null döndürmemeli');
});

test('gibStandardInvoice: belge_no doğru çıkarılmalı', () => {
  result = result || extract(sampleText);
  assert.equal(result.header.belge_no, expected.header.belge_no);
});

test('gibStandardInvoice: ettn doğru çıkarılmalı', () => {
  result = result || extract(sampleText);
  assert.equal(result.header.ettn, expected.header.ettn);
});

test('gibStandardInvoice: düzenleme tarihi ISO 8601 formatında', () => {
  result = result || extract(sampleText);
  assert.equal(result.header.duzenleme_tarihi, expected.header.duzenleme_tarihi);
});

test('gibStandardInvoice: düzenleme zamanı doğru', () => {
  result = result || extract(sampleText);
  assert.equal(result.header.duzenleme_zamani, expected.header.duzenleme_zamani);
});

test('gibStandardInvoice: mal_hizmet_toplam_tutari doğru', () => {
  result = result || extract(sampleText);
  assert.equal(result.header.mal_hizmet_toplam_tutari, expected.header.mal_hizmet_toplam_tutari);
});

test('gibStandardInvoice: hesaplanan_kdv_toplam doğru', () => {
  result = result || extract(sampleText);
  assert.equal(result.header.hesaplanan_kdv_toplam, expected.header.hesaplanan_kdv_toplam);
});

test('gibStandardInvoice: odenecek_tutar doğru', () => {
  result = result || extract(sampleText);
  assert.equal(result.header.odenecek_tutar, expected.header.odenecek_tutar);
});

test('gibStandardInvoice: satici_unvan doğru', () => {
  result = result || extract(sampleText);
  assert.equal(result.header.satici_unvan, expected.header.satici_unvan);
});

test('gibStandardInvoice: senaryo ve fatura_tipi doğru', () => {
  result = result || extract(sampleText);
  assert.equal(result.header.senaryo, expected.header.senaryo);
  assert.equal(result.header.fatura_tipi, expected.header.fatura_tipi);
});

test('gibStandardInvoice: 1 kalem çıkarılmalı', () => {
  result = result || extract(sampleText);
  assert.equal(result.items.length, 1);
});

test('gibStandardInvoice: kalem mal_hizmet_tutari doğru', () => {
  result = result || extract(sampleText);
  assert.equal(result.items[0].mal_hizmet_tutari, expected.items[0].mal_hizmet_tutari);
});

test('gibStandardInvoice: kalem kdv_orani doğru', () => {
  result = result || extract(sampleText);
  assert.equal(result.items[0].kdv_orani, expected.items[0].kdv_orani);
});

test('gibStandardInvoice: kalem birim doğru', () => {
  result = result || extract(sampleText);
  assert.equal(result.items[0].birim, expected.items[0].birim);
});

test('gibStandardInvoice: tanımayan metin null döndürmeli', () => {
  const sonuc = extract('Bu bir fatura değil.');
  assert.equal(sonuc, null);
});
