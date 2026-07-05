'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { clampInt, escapeLike, likeContains } = require('../src/server/queryUtil');

test('clampInt: geçerli sayıyı aralığa sıkıştırır', () => {
  assert.equal(clampInt('10', { def: 50, min: 1, max: 500 }), 10);
  assert.equal(clampInt('9999', { def: 50, min: 1, max: 500 }), 500);
  assert.equal(clampInt('-5', { def: 50, min: 1, max: 500 }), 1);
});

test('clampInt: sayı olmayan girdide varsayılanı döndürür (NaN SQL\'e gitmez)', () => {
  assert.equal(clampInt('abc', { def: 50, min: 1, max: 500 }), 50);
  assert.equal(clampInt(undefined, { def: 50, min: 1, max: 500 }), 50);
  assert.equal(clampInt('', { def: 0, min: 0, max: 100 }), 0);
});

test('escapeLike: joker karakterleri etkisizleştirir', () => {
  assert.equal(escapeLike('%50 indirim_'), '\\%50 indirim\\_');
  assert.equal(escapeLike('ters\\bölü'), 'ters\\\\bölü');
  assert.equal(escapeLike('normal metin'), 'normal metin');
});

test('likeContains: kırpar ve baş/son joker ekler', () => {
  assert.equal(likeContains('  abc  '), '%abc%');
  assert.equal(likeContains('a%b'), '%a\\%b%');
});
