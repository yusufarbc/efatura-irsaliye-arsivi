'use strict';

// Express sunucusunu Windows Service olarak kaydeder (node-windows).
// Normal (yükseltilmemiş) terminalden çalıştırılabilir: npm run service:install
// — tek bir UAC onayı istenir (bkz. elevate.js).
//
// Ortam değişkenleri (kurulum sırasında okunur, servise gömülür):
//   PORT        → dinlenecek port (varsayılan 8888)
//   HOST        → varsayılan 0.0.0.0 (kurum ağından, makinenin IP'siyle erişim).
//                 Yalnızca bu makineden erişim için: $env:HOST='127.0.0.1'
//   PANEL_USER / PANEL_PASS → ayarlanırsa panel parola ister (ağa açıkken önerilir)
//   DB_PATH     → farklı bir veritabanı konumu
//
// HOST=0.0.0.0 (varsayılan) ise, yalnızca yerel alt ağa izin veren güvenlik
// duvarı kuralı da otomatik eklenir (zaten yönetici yetkisiyle çalışıyoruz).

const path = require('path');
const { execFileSync } = require('child_process');
const { Service } = require('node-windows');
const { ensureElevated } = require('./elevate');

// Yönetici değilsek tek UAC onayıyla kendimizi yükseltip yeniden başlarız;
// aşağıdaki kod her durumda yönetici yetkisiyle çalışır (node-windows'un
// her adım için ayrı UAC sorması böylece engellenir).
ensureElevated(__filename);

const PORT = process.env.PORT || '8888';
const HOST = process.env.HOST || '0.0.0.0';

const env = [
  { name: 'PORT', value: PORT },
  { name: 'HOST', value: HOST },
];
if (process.env.PANEL_USER && process.env.PANEL_PASS) {
  env.push({ name: 'PANEL_USER', value: process.env.PANEL_USER });
  env.push({ name: 'PANEL_PASS', value: process.env.PANEL_PASS });
}
if (process.env.DB_PATH) {
  env.push({ name: 'DB_PATH', value: process.env.DB_PATH });
}

const svc = new Service({
  name: 'EFaturaArsivServisi',
  description: 'e-Fatura/e-İrsaliye arşiv web sunucusu.',
  script: path.join(__dirname, '..', 'src', 'server', 'app.js'),
  nodeOptions: ['--experimental-sqlite'],
  workingDirectory: path.join(__dirname, '..'),
  env,
});

svc.on('install', () => {
  console.log('Servis kuruldu, başlatılıyor...');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('Servis zaten kurulu. Ayar değiştirmek için önce: npm run service:uninstall');
});

svc.on('start', () => {
  console.log(`Servis çalışıyor: http://localhost:${PORT} (bind: ${HOST})`);
  console.log('Bilgisayar her açıldığında otomatik başlayacak.');
  if (HOST === '0.0.0.0') {
    kurGuvenlikDuvariKurali();
    console.log('');
    console.log('Sunucu kurum ağına açık — diğer bilgisayarlar http://<bu-makinenin-ip\'si>:' + PORT + ' adresinden erişir.');
    if (!process.env.PANEL_USER) {
      console.log('UYARI: Parola KORUMASIZ kurulum yapıldı — DB kişisel veri içeriyor. Önerilen:');
      console.log("  npm run service:uninstall");
      console.log("  $env:PANEL_USER='kullanici'; $env:PANEL_PASS='guclu-parola'; npm run service:install");
    }
  }
});

// Yalnızca yerel alt ağdan (localsubnet) erişime izin veren güvenlik duvarı
// kuralı. Aynı adlı eski kural varsa önce silinir (port değişikliğinde
// bayat kural kalmasın).
function kurGuvenlikDuvariKurali() {
  try {
    execFileSync('netsh', ['advfirewall', 'firewall', 'delete', 'rule', 'name=EFaturaArsivi'], { stdio: 'ignore' });
  } catch { /* kural yoktu, sorun değil */ }
  try {
    execFileSync('netsh', [
      'advfirewall', 'firewall', 'add', 'rule',
      'name=EFaturaArsivi', 'dir=in', 'action=allow', 'protocol=TCP',
      `localport=${PORT}`, 'remoteip=localsubnet',
    ], { stdio: 'ignore' });
    console.log(`Güvenlik duvarı kuralı eklendi: TCP ${PORT}, yalnızca yerel alt ağ (EFaturaArsivi).`);
  } catch (err) {
    console.log('Güvenlik duvarı kuralı eklenemedi: ' + err.message);
    console.log('Elle eklemek için: netsh advfirewall firewall add rule name="EFaturaArsivi" dir=in action=allow protocol=TCP localport=' + PORT + ' remoteip=localsubnet');
  }
}

svc.on('error', (err) => {
  console.error('Servis hatası:', err);
});

svc.install();
