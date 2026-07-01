'use strict';

// EFaturaArsivServisi Windows Service'ini kaldırır.
// Yönetici (Administrator) PowerShell'den çalıştırılmalı: npm run service:uninstall

const path = require('path');
const { Service } = require('node-windows');

const svc = new Service({
  name: 'EFaturaArsivServisi',
  script: path.join(__dirname, '..', 'src', 'server', 'app.js'),
});

svc.on('uninstall', () => {
  console.log('Servis kaldırıldı.');
});

svc.on('error', (err) => {
  console.error('Servis kaldırma hatası:', err);
});

svc.uninstall();
