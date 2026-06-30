'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseTrNumber, parseTrPercent, parseTrDate } = require('../src/ingest/normalize');

test('parseTrNumber: binlik ayraçlı sayı', () => {
  assert.equal(parseTrNumber('15.000,00'), 15000);
  assert.equal(parseTrNumber('3.000,00'), 3000);
  assert.equal(parseTrNumber('18.000,00'), 18000);
});

test('parseTrNumber: TL birimi olan sayı', () => {
  assert.equal(parseTrNumber('15.000 TL'), 15000);
  assert.equal(parseTrNumber('3.000,00 TL'), 3000);
});

test('parseTrNumber: basit sayı', () => {
  assert.equal(parseTrNumber('1'), 1);
  assert.equal(parseTrNumber('0'), 0);
});

test('parseTrNumber: null/geçersiz', () => {
  assert.equal(parseTrNumber(null), null);
  assert.equal(parseTrNumber('abc'), null);
});

test('parseTrPercent: yüzde string', () => {
  assert.equal(parseTrPercent('%20,00'), 20);
  assert.equal(parseTrPercent('20,00'), 20);
  assert.equal(parseTrPercent('%8'), 8);
});

test('parseTrDate: GG-AA-YYYY → YYYY-MM-DD', () => {
  assert.equal(parseTrDate('30-06-2026'), '2026-06-30');
  assert.equal(parseTrDate('01-01-2024'), '2024-01-01');
});

test('parseTrDate: geçersiz format', () => {
  assert.equal(parseTrDate('2026-06-30'), null);
  assert.equal(parseTrDate(''), null);
  assert.equal(parseTrDate(null), null);
});
