'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'efatura-secret-test-'));
const dbPath = path.join(tmpDir, 'test.sqlite');

let server;
let base;
let yetkiCookie; // gizli yol ziyaretinden dönen "yetki_karti=<token>" çifti

before(async () => {
  // Test için gerekli env'leri ayarlıyoruz
  process.env.DB_PATH = dbPath;
  process.env.UPLOAD_DIR = path.join(tmpDir, 'uploads');
  process.env.SECRET_PATH = 'test-gizli-anahtar';

  // app.js önceden import edildiyse cache'i temizliyoruz
  delete require.cache[require.resolve('../src/server/app')];

  const app = require('../src/server/app');

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  if (server) server.close();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* Windows */ }
  // Env'leri temizliyoruz
  delete process.env.SECRET_PATH;
  delete require.cache[require.resolve('../src/server/app')];
});

test('Gizli yol olmadan yapılan isteğe 404 dönmeli', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 404);
  const text = await res.text();
  assert.equal(text, 'Not Found');
});

test('Gizli yola istek atıldığında çerez vermeli ve yönlendirmeli', async () => {
  const res = await fetch(base + '/test-gizli-anahtar', { redirect: 'manual' });
  assert.equal(res.status, 302);

  const setCookie = res.headers.get('set-cookie');
  assert.ok(setCookie);
  const m = setCookie.match(/yetki_karti=([0-9a-f]{32})/);
  assert.ok(m, 'çerez değeri gizli yoldan türetilmiş 32 karakterlik token olmalı');
  yetkiCookie = m[0];
  assert.match(setCookie, /Max-Age=2592000/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);

  const location = res.headers.get('location');
  assert.equal(location, '/');
});

test('Yetki çereziyle istek yapıldığında başarılı yanıt dönmeli', async () => {
  const res = await fetch(base + '/', {
    headers: { 'Cookie': yetkiCookie }
  });
  assert.equal(res.status, 200);
});

test('Uydurma çerez değeri kabul edilmemeli', async () => {
  const res = await fetch(base + '/', {
    headers: { 'Cookie': 'yetki_karti=gecerli' }
  });
  assert.equal(res.status, 404);
});
