'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateDocument } = require('../src/ingest/validate');

const items = [
  { mal_hizmet_tutari: 15000, kdv_tutari: 3000 },
];

test('validate: tutarlar eşleşiyor → BASARILI', () => {
  const header = { mal_hizmet_toplam_tutari: 15000, hesaplanan_kdv_toplam: 3000 };
  const result = validateDocument(header, items);
  assert.equal(result.durum, 'BASARILI');
  assert.equal(result.notlar.length, 0);
});

test('validate: küçük yuvarlama farkı → BASARILI', () => {
  const header = { mal_hizmet_toplam_tutari: 15000.03, hesaplanan_kdv_toplam: 3000 };
  const result = validateDocument(header, items);
  assert.equal(result.durum, 'BASARILI');
});

test('validate: büyük fark → SUPHELI', () => {
  const header = { mal_hizmet_toplam_tutari: 16000, hesaplanan_kdv_toplam: 3000 };
  const result = validateDocument(header, items);
  assert.equal(result.durum, 'SUPHELI');
  assert.equal(result.notlar.length, 1);
});

test('validate: KDV farkı → SUPHELI', () => {
  const header = { mal_hizmet_toplam_tutari: 15000, hesaplanan_kdv_toplam: 2500 };
  const result = validateDocument(header, items);
  assert.equal(result.durum, 'SUPHELI');
});
