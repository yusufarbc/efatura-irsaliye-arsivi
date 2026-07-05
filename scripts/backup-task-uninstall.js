'use strict';

// EFaturaArsivYedek zamanlanmış görevini kaldırır: npm run task:uninstall-backup

const { execFileSync } = require('child_process');

execFileSync('schtasks', ['/Delete', '/TN', 'EFaturaArsivYedek', '/F'], { stdio: 'inherit' });
console.log('Zamanlanmış yedek görevi kaldırıldı.');
