'use strict';

// Express sunucusunu Windows Service olarak kaydeder (node-windows).
// Yönetici (Administrator) PowerShell'den çalıştırılmalı: npm run service:install

const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
  name: 'EFaturaArsivServisi',
  description: 'e-Fatura/e-İrsaliye arşiv web sunucusu (salt-okunur, GET).',
  script: path.join(__dirname, '..', 'src', 'server', 'app.js'),
  nodeOptions: ['--experimental-sqlite'],
  workingDirectory: path.join(__dirname, '..'),
  env: [
    { name: 'PORT', value: process.env.PORT || '3000' },
  ],
});

svc.on('install', () => {
  console.log('Servis kuruldu, başlatılıyor...');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('Servis zaten kurulu.');
});

svc.on('start', () => {
  console.log(`Servis çalışıyor: http://localhost:${process.env.PORT || 3000}`);
  console.log('Bilgisayar her açıldığında otomatik başlayacak.');
});

svc.on('error', (err) => {
  console.error('Servis hatası:', err);
});

svc.install();
