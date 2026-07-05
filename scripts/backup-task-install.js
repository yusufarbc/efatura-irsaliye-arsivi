'use strict';

// backup-db.js'i her gün belirli saatte çalıştıran Windows Görev Zamanlayıcı
// görevi oluşturur. Yedek, %OneDrive%\EFaturaArsivYedek klasörüne yazılır ve
// OneDrive bunu kendisi buluta senkronlar.
//
// Kullanım: npm run task:install-backup
// Saat değiştirmek için: $env:BACKUP_TIME='23:30'; npm run task:install-backup

const path = require('path');
const { execFileSync } = require('child_process');

const TASK_NAME = 'EFaturaArsivYedek';
const projectRoot = path.join(__dirname, '..');
const time = process.env.BACKUP_TIME || '21:00';
const scriptPath = path.join(projectRoot, 'scripts', 'backup-db.js');
const taskCommand = `"${process.execPath}" --experimental-sqlite "${scriptPath}"`;

execFileSync('schtasks', [
  '/Create',
  '/TN', TASK_NAME,
  '/TR', taskCommand,
  '/SC', 'DAILY',
  '/ST', time,
  '/F',
], { stdio: 'inherit', cwd: projectRoot });

console.log(`Zamanlanmış yedek görevi oluşturuldu: ${TASK_NAME}`);
console.log(`Her gün ${time} → %OneDrive%\\EFaturaArsivYedek (varsayılan 14 yedek tutulur)`);
