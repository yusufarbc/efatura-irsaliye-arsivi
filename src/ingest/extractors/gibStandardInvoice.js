'use strict';

const { parseTrNumber, parseTrPercent, parseTrDate } = require('../normalize');

// "-layout" çıktısında iki sütunlu satırlarda etiketin değeri ile sağdaki
// başka bir sütunun metni aynı fiziksel satıra düşebilir (örn. "Vergi Dairesi: X
// Örnek Dairesi                    10:09:13"). Değeri, tek boşlukla ayrılmış
// kelimeler olarak alıp 2+ boşluk (bir sonraki sütuna geçiş) veya satır sonunda durdur.
const VERGI_DAIRESI_RE = /Vergi Dairesi\s*:\s*(\S+(?:[ \t]+\S+)*?)(?:[ \t]{2,}|\n|$)/;

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

  // CRLF gelirse (Windows pdftotext, CRLF'li fixture dosyaları) regex'lerdeki
  // \n / satır-sonu varsayımları bozulur — girişte normalize et.
  text = text.replace(/\r\n?/g, '\n');

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
  const saticiTckn = matchField(text, /TCKN\s*:\s*(\d+)/);
  // VKN'nin ikincisi satıcıya ait olabilir — sayfada iki VKN bulunabilir
  const vknMatches = [...text.matchAll(/VKN\s*:\s*(\d+)/g)];
  // İlk VKN: alıcı (SAYIN bloğu içindeki), ikinci: satıcı (sol üst)
  // Ama düzen değişken olduğundan: TCKN varsa satıcı gerçek kişi; VKN varsa tüzel
  header.satici_vkn_tckn = saticiTckn || (vknMatches.length >= 2 ? vknMatches[1][1] : vknMatches[0]?.[1] || null);
  header.satici_vergi_dairesi = matchField(text, VERGI_DAIRESI_RE);
  header.satici_telefon = matchField(text, /Tel\s*:\s*(\+?\d[\d\s]+)/);

  // --- Alıcı (SAYIN bloğu) ---
  header.alici_unvan = extractAliciUnvan(lines);
  // İki VKN varsa ilki alıcıya ait; tek VKN varsa ve satıcı zaten TCKN ile
  // tanımlıysa (gerçek kişi satıcı), o tek VKN alıcıya (tüzel kişi) aittir.
  header.alici_vkn_tckn = vknMatches.length >= 2
    ? vknMatches[0][1]
    : (saticiTckn && vknMatches.length === 1 ? vknMatches[0][1] : null);
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
    // Sonraki satır, sağdaki başka bir sütunla ("Özelleştirme No: ..." gibi)
    // aynı fiziksel satırda gelebilir — sadece 2+ boşluktan önceki sol sütun
    // parçasına (ör. "A.Ş.") bakılmalı, satırın tamamına değil.
    if (i + 1 < lines.length) {
      const nextLeftCol = lines[i + 1].split(/[ \t]{2,}/)[0].trim();
      if (nextLeftCol && nextLeftCol.length < 20 && /^[A-ZÇĞİÖŞÜa-zçğışöşü.\s]+$/.test(nextLeftCol) && !/:\s/.test(nextLeftCol)) {
        unvan += ' ' + nextLeftCol;
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
    const m = lines[i].match(VERGI_DAIRESI_RE);
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
 * Sıra no ("1") bu satırın en başında, itemLineRe'nin eşleştiği kısımdan önce
 * duruyor — ayrı bir satır olarak gelmiyor. Açıklama ("Siber Güvenlik
 * Danışmanlığı Hizmet Bedeli") ise kalem satırının hem ÖNCESİNE hem SONRASINA
 * bölünmüş halde yayılabiliyor. Bu yüzden açıklama, kalem satırından önceki
 * düz metin satırları ile hemen sonraki düz metin satırları birleştirilerek
 * oluşturuluyor.
 *
 * Not: Aynı anda birden fazla kalem varsa ve aralarında bağımsız bir sıra no
 * satırı yoksa (her kalemin sıra no'su da kendi veri satırının başında ise),
 * bir kalemin son açıklama satırı ile bir sonrakinin ilk açıklama satırını
 * ayırt etmenin güvenilir bir yolu yok — bu durumda açıklama her iki kaleme de
 * (fazladan) eklenebilir. Şimdiye kadar gözlemlenen tüm gerçek örnekler tek
 * kalemli olduğu için bu kenar durumu netleşmedi; çok kalemli gerçek bir örnek
 * geldiğinde tekrar gözden geçirilmeli.
 */
function extractItems(lines) {
  const items = [];

  // Kalem veri satırı regex'i — tüm sayısal alanları tek seferde yakalar
  // Gruplar: [miktar, birim, birim_fiyat, kdv_orani, kdv_tutari, mal_hizmet_tutari]
  const itemLineRe = /(\d[\d.,]*)\s+(Adet|Kg|KG|Litre|Lt|m²|m2|Metre|Ton|Paket|Kutu|Hizmet|Saat)\s+([\d.,]+)\s*TL\s+%?([\d.,]+)\s+([\d.,]+)\s*TL\s+([\d.,]+)\s*TL/i;

  // Sıra no satırı (sadece rakam, opsiyonel boşluk) — bazı şablonlarda ayrı satırda gelebilir
  const siraNoRe = /^\s*(\d+)\s*$/;

  // Tablo başlığı satırlarını atlamak için ("Sıra" / "No" iki satıra bölünmüş olabilir)
  const headerLineRe = /Sıra|^No$|Malzeme|Açıklama|Miktar|Birim Fiyat|KDV Oranı|KDV Tutarı|Mal Hizmet/;

  const totalsLineRe = /Toplam Tutar|Hesaplanan KDV|Vergiler Dahil|[ÖO]denecek Tutar|Yaln[ıi]z|[İI]rsaliye yerine/i;

  let leadingLines = [];   // sıradaki kalemden önce biriken açıklama satırları
  let pendingSiraNo = null; // bağımsız bir sıra no satırı görüldüyse
  let lastItem = null;      // az önce eklenen kalem — devam satırlarını buna ekle
  let inTable = false;      // kalem tablosu başlığı görülmeden hiçbir satır açıklama sayılmaz

  for (const line of lines) {
    const stripped = line.trim();

    if (headerLineRe.test(stripped)) {
      inTable = true;
      continue;
    }

    if (!stripped || !inTable) {
      continue;
    }

    if (totalsLineRe.test(stripped)) {
      // Kalem tablosu bitti, açık kalan her şeyi kapat
      leadingLines = [];
      pendingSiraNo = null;
      lastItem = null;
      continue;
    }

    const itemMatch = line.match(itemLineRe);
    if (itemMatch) {
      const [, miktar, birim, birim_fiyat, kdv_orani, kdv_tutari, mal_hizmet_tutari] = itemMatch;

      // Sıra no ayrı bir satırda gelmediyse, kalem satırının eşleşmeden önceki
      // kısmında (satır başında) bağımsız bir rakam olarak durabilir.
      let siraNo = pendingSiraNo;
      if (siraNo == null) {
        const prefix = line.slice(0, itemMatch.index).trim();
        if (/^\d+$/.test(prefix)) siraNo = prefix;
      }

      const aciklama = leadingLines.join(' ').replace(/\s+/g, ' ').trim();

      const item = {
        sira_no: siraNo != null ? parseInt(siraNo, 10) : items.length + 1,
        aciklama: aciklama || null,
        miktar: parseTrNumber(miktar),
        birim: birim.trim(),
        birim_fiyat: parseTrNumber(birim_fiyat),
        kdv_orani: parseTrPercent(kdv_orani),
        kdv_tutari: parseTrNumber(kdv_tutari),
        mal_hizmet_tutari: parseTrNumber(mal_hizmet_tutari),
      };
      items.push(item);

      leadingLines = [];
      pendingSiraNo = null;
      lastItem = item;
      continue;
    }

    // Bağımsız bir sıra no satırı mı? Yeni kalem başlıyor demektir —
    // önceki kalemin devam açıklaması artık kapanır.
    const siraMatch = stripped.match(siraNoRe);
    if (siraMatch && parseInt(siraMatch[1], 10) <= 999) {
      lastItem = null;
      pendingSiraNo = siraMatch[1];
      leadingLines = [];
      continue;
    }

    // Düz metin satırı: hem bir önceki kalemin devamı olabilir hem de
    // sıradaki kalemin açıklamasının başlangıcı — ikisine de ekleniyor.
    if (stripped.length > 0 && stripped.length < 200) {
      if (lastItem) {
        lastItem.aciklama = lastItem.aciklama ? `${lastItem.aciklama} ${stripped}` : stripped;
      }
      leadingLines.push(stripped);
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
