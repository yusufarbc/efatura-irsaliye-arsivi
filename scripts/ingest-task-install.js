'use strict';

// ingestRunner.js'i her gün belirli saatte otomatik çalıştıran bir Windows
// Görev Zamanlayıcı (Task Scheduler) görevi oluşturur. Servis değil, çünkü
// ingest sürekli çalışan bir süreç değil, periyodik toplu bir iştir.
//
// Kullanım: npm run task:install-ingest
// Klasör değiştirmek için: INGEST_DIR=D:\belgeler npm run task:install-ingest
// Saat değiştirmek için:   INGEST_TIME=23:00 npm run task:install-ingest
//
// NOT: Görev, oluşturan kullanıcı hesabı altında ve varsayılan olarak yalnızca
// o kullanıcı oturum açmışken çalışır. Kullanıcı oturumu kapalıyken de
// çalışması isteniyorsa `schtasks /Change /TN EFaturaArsivIngest /RU SYSTEM`
// ile SYSTEM hesabına taşınabilir (bu durumda ingest'in okuduğu/yazdığı
// klasörlerde SYSTEM'in erişim izni olduğundan emin olun).

const path = require('path');
const { execFileSync } = require('child_process');

const TASK_NAME = 'EFaturaArsivIngest';
const projectRoot = path.join(__dirname, '..');
const ingestDir = process.env.INGEST_DIR || path.join(projectRoot, 'belgeler');
const time = process.env.INGEST_TIME || '07:00';
const scriptPath = path.join(projectRoot, 'src', 'ingest', 'ingestRunner.js');
const taskCommand = `"${process.execPath}" --experimental-sqlite "${scriptPath}" --dir "${ingestDir}"`;

execFileSync('schtasks', [
  '/Create',
  '/TN', TASK_NAME,
  '/TR', taskCommand,
  '/SC', 'DAILY',
  '/ST', time,
  '/F',
], { stdio: 'inherit', cwd: projectRoot });

console.log(`Zamanlanmış görev oluşturuldu: ${TASK_NAME}`);
console.log(`Her gün ${time}, klasör: ${ingestDir}`);
