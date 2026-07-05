'use strict';

// EFaturaArsivServisi Windows Service'ini kaldırır.
// Normal terminalden çalıştırılabilir (tek UAC onayı): npm run service:uninstall

const path = require('path');
const { execFileSync } = require('child_process');
const { Service } = require('node-windows');
const { ensureElevated } = require('./elevate');

ensureElevated(__filename);

const svc = new Service({
  name: 'EFaturaArsivServisi',
  script: path.join(__dirname, '..', 'src', 'server', 'app.js'),
});

svc.on('uninstall', () => {
  console.log('Servis kaldırıldı.');
  try {
    execFileSync('netsh', ['advfirewall', 'firewall', 'delete', 'rule', 'name=EFaturaArsivi'], { stdio: 'ignore' });
    console.log('Güvenlik duvarı kuralı kaldırıldı (EFaturaArsivi).');
  } catch { /* kural yoktu */ }
});

svc.on('error', (err) => {
  console.error('Servis kaldırma hatası:', err);
});

svc.uninstall();
