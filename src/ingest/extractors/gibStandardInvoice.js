'use strict';

const { parseTrNumber, parseTrPercent, parseTrDate } = require('../normalize');

/**
 * GİB standart e-Fatura PDF formatını (pdftotext -layout çıktısı) parse eder.
 * Birden fazla entegratör bu formatı kullanabilir (Logo, Mikro, Foriba vb.
 * GİB onaylı şablon aynıdır).
 *
 * @param {string} text - pdftotext -layout çıktısı
 * @returns {{ header: object, items: object[], confidence: number } | null}
 */
function extract(text) {
  if (!text) return null;

  // Temel tanıma: "E-Fatura" ve "Fatura No:" içermeli
  if (!/E-Fatura/i.test(text) || !/Fatura No:/i.test(text)) return null;

  const lines = text.split('\n');

  const header = {};
  header.belge_tipi = 'FATURA';

  // --- Tek satır anchor regex'leri ---
  header.belge_no = matchField(text, /Fatura No\s*:\s*(\S+)/);
  header.ettn = matchField(text, /ETTN\s*:\s*([0-9a-f-]{36})/i);
  header.senaryo = matchField(text, /Senaryo\s*:\s*(\S+)/);
  header.fatura_tipi = matchField(text, /Fatura Tipi\s*:\s*(\S+)/);

  // Tarih: "Düzenleme Tarihi: GG-AA-YYYY"
  const tarihRaw = matchField(text, /D[uü]zenleme Tarihi\s*:\s*(\d{2}-\d{2}-\d{4})/);
  header.duzenleme_tarihi = parseTrDate(tarihRaw);

  // Zaman: "HH:MM:SS" — "Düzenleme" etiketi ve "Zamanı" etiketiyle çevrili olabilir,
  // aralarında başka satırlar (adres vb.) olabilir; geniş arama kullan.
  const zamanM = text.match(/D[uü]zenleme[\s\S]{0,500}?(\d{2}:\d{2}:\d{2})/);
  header.duzenleme_zamani = zamanM ? zamanM[1] : null;

  // --- Satıcı (sayfanın sol üstü, TCKN veya VKN: ile identify edilir) ---
  // Satıcı = sayfanın sol üst bölümü, SAYIN kelimesinden önce gelen unvan bloku
  header.satici_unvan = extractSaticiUnvan(lines);
  header.satici_tckn = matchField(text, /TCKN\s*:\s*(\d+)/);
  // VKN'nin ikincisi satıcıya ait olabilir — sayfada iki VKN bulunabilir
  const vknMatches = [...text.matchAll(/VKN\s*:\s*(\d+)/g)];
  // İlk VKN: alıcı (SAYIN bloğu içindeki), ikinci: satıcı (sol üst)
  // Ama düzen değişken olduğundan: TCKN varsa satıcı gerçek kişi; VKN varsa tüzel
  header.satici_vkn_tckn = header.satici_tckn || (vknMatches.length >= 2 ? vknMatches[1][1] : vknMatches[0]?.[1] || null);
  header.satici_vergi_dairesi = matchField(text, /Vergi Dairesi\s*:\s*(.+?)(?:\n|$)/);
  header.satici_telefon = matchField(text, /Tel\s*:\s*(\+?\d[\d\s]+)/);

  // --- Alıcı (SAYIN bloğu) ---
  header.alici_unvan = extractAliciUnvan(lines);
  header.alici_vkn_tckn = vknMatches.length >= 2 ? vknMatches[0][1] : null;
  header.alici_vergi_dairesi = extractAliciVergiDairesi(lines);
  header.alici_eposta = matchField(text, /E-Posta\s*:\s*(\S+@\S+)/i);

  // --- Tutarlar ---
  header.mal_hizmet_toplam_tutari = parseTrNumber(
    matchField(text, /Mal Hizmet Toplam Tut[aA]r[ıi]\s+([\d.,]+)\s*TL/)
  );
  header.hesaplanan_kdv_toplam = parseTrNumber(
    matchField(text, /Hesaplanan KDV\s*\([^)]+\)\s+([\d.,]+)\s*TL/)
  );
  header.vergiler_dahil_toplam_tutar = parseTrNumber(
    matchField(text, /Vergiler Dahil Toplam Tutar\s+([\d.,]+)\s*TL/)
  );
  header.odenecek_tutar = parseTrNumber(
    matchField(text, /[ÖO]denecek Tutar\s+([\d.,]+)\s*TL/)
  );

  // --- Notlar (Yalnız + İrsaliye yerine geçer vb.) ---
  const notlarParts = [];
  const yalnizM = text.match(/Yaln[ıi]z\s*:\s*(.+)/);
  if (yalnizM) notlarParts.push(`Yalnız: ${yalnizM[1].trim()}`);
  if (/[İI]rsaliye yerine ge[çc]er/i.test(text)) notlarParts.push('İrsaliye yerine geçer.');
  header.notlar = notlarParts.length ? notlarParts.join(' ') : null;

  // --- Kalemler ---
  const items = extractItems(lines);

  const confidence = computeConfidence(header, items);

  return { header, items, confidence };
}

// ---------------------------------------------------------------------------
// Yardımcı fonksiyonlar
// ---------------------------------------------------------------------------

function matchField(text, regex) {
  const m = text.match(regex);
  return m ? m[1].trim() : null;
}

/**
 * Satıcı unvanı: sayfanın en üstündeki metin bloğu, "SAYIN" kelimesinden önce.
 * pdftotext -layout çıktısında satıcı sol üst köşede, alıcı "SAYIN" altında yer alır.
 * İlk boş-olmayan satırı alıyoruz (genellikle ad-soyad veya şirket unvanı).
 */
function extractSaticiUnvan(lines) {
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^E-Fatura$/i.test(t)) continue;
    return t;
  }
  return null;
}

/**
 * Alıcı unvanı: "SAYIN" satırından sonraki ilk anlamlı metin satırı.
 */
function extractAliciUnvan(lines) {
  let sayinIdx = lines.findIndex((l) => /^\s*SAYIN\s*$/.test(l));
  if (sayinIdx === -1) sayinIdx = lines.findIndex((l) => /SAYIN/.test(l));
  if (sayinIdx === -1) return null;

  for (let i = sayinIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    // Alıcı unvanı çok satırlı olabilir (ör. "Örnek Sistem... A.Ş.")
    // İlk anlamlı satırı al, sonraki kısa devam satırlarını da ekle
    let unvan = t;
    // Sonraki satır sadece kısa bir devam parçasıysa (tek kelime, A.Ş. gibi) ekle
    if (i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (next && next.length < 20 && /^[A-ZÇĞİÖŞÜa-zçğışöşü.\s]+$/.test(next) && !/:\s/.test(next)) {
        unvan += ' ' + next;
      }
    }
    return unvan;
  }
  return null;
}

/**
 * Alıcı vergi dairesi: "SAYIN" bloğu içindeki "Vergi Dairesi:" satırı.
 * Satıcı Vergi Dairesi de var, bu yüzden SAYIN bloğundan sonrasını arıyoruz.
 */
function extractAliciVergiDairesi(lines) {
  let sayinIdx = lines.findIndex((l) => /SAYIN/.test(l));
  if (sayinIdx === -1) return null;
  for (let i = sayinIdx; i < Math.min(sayinIdx + 30, lines.length); i++) {
    const m = lines[i].match(/Vergi Dairesi\s*:\s*(.+)/);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * Kalem satırlarını çıkarır.
 * Gerçek kalem satırı pattern'i: bir satırda miktar+birim+birim fiyat+KDV%+KDV tutarı+mal hizmet tutarı.
 *
 * Örnek satır (tek satırda):
 *   "1                                                     1 Adet       15.000 TL         %20,00         3.000,00 TL             15.000,00 TL"
 *
 * Regex: sıra_no? ... miktar birim birim_fiyat TL kdv_oran% kdv_tutar TL mal_hizmet_tutar TL
 */
function extractItems(lines) {
  const items = [];

  // Kalem veri satırı regex'i — tüm sayısal alanları tek seferde yakalar
  // Gruplar: [sira_no, aciklama_prefix, miktar, birim, birim_fiyat, kdv_orani, kdv_tutari, mal_hizmet_tutari]
  const itemLineRe = /(\d[\d.,]*)\s+(Adet|Kg|KG|Litre|Lt|m²|m2|Metre|Ton|Paket|Kutu|Hizmet|Saat)\s+([\d.,]+)\s*TL\s+%?([\d.,]+)\s+([\d.,]+)\s*TL\s+([\d.,]+)\s*TL/i;

  // Sıra no satırı (sadece rakam, opsiyonel boşluk)
  const siraNoRe = /^\s*(\d+)\s*$/;

  // Başlık satırını atlamak için
  const headerLineRe = /Sıra|Malzeme|Açıklama|Miktar|Birim Fiyat|KDV Oranı|KDV Tutarı|Mal Hizmet/;

  let pendingAciklama = [];
  let pendingSiraNo = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trim();

    if (!stripped || headerLineRe.test(stripped)) {
      continue;
    }

    const itemMatch = line.match(itemLineRe);
    if (itemMatch) {
      const [, miktar, birim, birim_fiyat, kdv_orani, kdv_tutari, mal_hizmet_tutari] = itemMatch;

      // Açıklama: sıra no ile bu kalem satırı arasındaki metin
      const aciklama = pendingAciklama.join(' ').replace(/\s+/g, ' ').trim();

      items.push({
        sira_no: pendingSiraNo != null ? parseInt(pendingSiraNo, 10) : items.length + 1,
        aciklama: aciklama || null,
        miktar: parseTrNumber(miktar),
        birim: birim.trim(),
        birim_fiyat: parseTrNumber(birim_fiyat),
        kdv_orani: parseTrPercent(kdv_orani),
        kdv_tutari: parseTrNumber(kdv_tutari),
        mal_hizmet_tutari: parseTrNumber(mal_hizmet_tutari),
      });

      pendingAciklama = [];
      pendingSiraNo = null;
      continue;
    }

    // Sıra no satırı mı?
    const siraMatch = stripped.match(siraNoRe);
    if (siraMatch && parseInt(siraMatch[1], 10) <= 999) {
      pendingSiraNo = siraMatch[1];
      pendingAciklama = [];
      continue;
    }

    // Tablo başlığı veya tutar özeti satırları (kalem dışı) — bunları atla
    if (
      /Toplam Tutar|Hesaplanan KDV|Vergiler Dahil|[ÖO]denecek Tutar|Yaln[ıi]z|[İI]rsaliye yerine/i.test(stripped)
    ) {
      pendingAciklama = [];
      pendingSiraNo = null;
      continue;
    }

    // Eğer sıra no bekliyorsak (pendingSiraNo set), bu satır açıklamanın parçası
    if (pendingSiraNo != null) {
      // Çok uzun değilse ve sayısal olmayan içerik varsa açıklamaya ekle
      if (stripped.length > 0 && stripped.length < 200) {
        pendingAciklama.push(stripped);
      }
    }
  }

  return items;
}

function computeConfidence(header, items) {
  let score = 0;
  if (header.belge_no) score += 20;
  if (header.ettn) score += 20;
  if (header.duzenleme_tarihi) score += 15;
  if (header.mal_hizmet_toplam_tutari != null) score += 20;
  if (items.length > 0) score += 25;
  return score;
}

module.exports = { extract };
