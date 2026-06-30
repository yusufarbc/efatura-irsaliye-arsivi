PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  belge_tipi TEXT NOT NULL CHECK(belge_tipi IN ('FATURA','IRSALIYE')),
  belge_no TEXT,
  ettn TEXT UNIQUE,
  duzenleme_tarihi TEXT,
  duzenleme_zamani TEXT,
  senaryo TEXT,
  fatura_tipi TEXT,
  satici_unvan TEXT,
  satici_vkn_tckn TEXT,
  satici_vergi_dairesi TEXT,
  satici_adres TEXT,
  satici_eposta TEXT,
  satici_telefon TEXT,
  alici_unvan TEXT,
  alici_vkn_tckn TEXT,
  alici_vergi_dairesi TEXT,
  alici_adres TEXT,
  alici_eposta TEXT,
  alici_telefon TEXT,
  mal_hizmet_toplam_tutari REAL,
  hesaplanan_kdv_toplam REAL,
  vergiler_dahil_toplam_tutar REAL,
  odenecek_tutar REAL,
  notlar TEXT,
  kaynak_dosya TEXT NOT NULL,
  parse_durumu TEXT NOT NULL CHECK(parse_durumu IN ('BASARILI','SUPHELI','HATALI')),
  parse_notu TEXT,
  olusturma_tarihi TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sira_no INTEGER,
  aciklama TEXT,
  miktar REAL,
  birim TEXT,
  birim_fiyat REAL,
  kdv_orani REAL,
  kdv_tutari REAL,
  mal_hizmet_tutari REAL
);

CREATE INDEX IF NOT EXISTS idx_documents_ettn ON documents(ettn);
CREATE INDEX IF NOT EXISTS idx_documents_tarih ON documents(duzenleme_tarihi);
CREATE INDEX IF NOT EXISTS idx_documents_satici ON documents(satici_unvan);
CREATE INDEX IF NOT EXISTS idx_documents_alici ON documents(alici_unvan);
CREATE INDEX IF NOT EXISTS idx_documents_parse_durumu ON documents(parse_durumu);
CREATE INDEX IF NOT EXISTS idx_items_aciklama ON items(aciklama);
CREATE INDEX IF NOT EXISTS idx_items_document ON items(document_id);
