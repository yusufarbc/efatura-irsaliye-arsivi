-- Satıcı/alıcı bilgilerini (VKN/TCKN ile) ayrı bir "taraflar" tablosunda
-- toplar; aynı taraf birden çok faturada geçtiğinde unvan/adres/vergi
-- dairesi bilgisi her belgede tekrar yazılmaz, tek satırda tutulur.

CREATE TABLE IF NOT EXISTS taraflar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unvan TEXT NOT NULL,
  vkn_tckn TEXT UNIQUE,
  vergi_dairesi TEXT,
  adres TEXT,
  eposta TEXT,
  telefon TEXT,
  olusturma_tarihi TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_taraflar_vkn_tckn ON taraflar(vkn_tckn);
CREATE INDEX IF NOT EXISTS idx_taraflar_unvan ON taraflar(unvan);

ALTER TABLE documents ADD COLUMN satici_id INTEGER REFERENCES taraflar(id);
ALTER TABLE documents ADD COLUMN alici_id INTEGER REFERENCES taraflar(id);

DROP INDEX IF EXISTS idx_documents_satici;
DROP INDEX IF EXISTS idx_documents_alici;

ALTER TABLE documents DROP COLUMN satici_unvan;
ALTER TABLE documents DROP COLUMN satici_vkn_tckn;
ALTER TABLE documents DROP COLUMN satici_vergi_dairesi;
ALTER TABLE documents DROP COLUMN satici_adres;
ALTER TABLE documents DROP COLUMN satici_eposta;
ALTER TABLE documents DROP COLUMN satici_telefon;
ALTER TABLE documents DROP COLUMN alici_unvan;
ALTER TABLE documents DROP COLUMN alici_vkn_tckn;
ALTER TABLE documents DROP COLUMN alici_vergi_dairesi;
ALTER TABLE documents DROP COLUMN alici_adres;
ALTER TABLE documents DROP COLUMN alici_eposta;
ALTER TABLE documents DROP COLUMN alici_telefon;

CREATE INDEX IF NOT EXISTS idx_documents_satici_id ON documents(satici_id);
CREATE INDEX IF NOT EXISTS idx_documents_alici_id ON documents(alici_id);
