@echo off
rem e-Fatura / e-Irsaliye Arsivi - kaldirma araci
rem Servisi ve zamanlanmis gorevleri kaldirir; verilere (data\) DOKUNMAZ.
rem Bu dosyaya cift tiklamak yeterlidir.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0kurulum\kaldir.ps1"
pause
