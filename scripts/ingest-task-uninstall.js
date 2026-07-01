'use strict';

// EFaturaArsivIngest zamanlanmış görevini kaldırır.
// Kullanım: npm run task:uninstall-ingest

const { execFileSync } = require('child_process');

const TASK_NAME = 'EFaturaArsivIngest';

execFileSync('schtasks', ['/Delete', '/TN', TASK_NAME, '/F'], { stdio: 'inherit' });

console.log(`Zamanlanmış görev kaldırıldı: ${TASK_NAME}`);
