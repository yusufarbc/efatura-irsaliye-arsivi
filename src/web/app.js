'use strict';

// --- Tab yönetimi ---
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'gozden-gecir') loadGozdenGecir();
  });
});

// --- Belgeler sekmesi ---
let currentPage = 0;
const PAGE_SIZE = 50;

function buildFilters() {
  return {
    tarih_baslangic: document.getElementById('f-tarih-bas').value || undefined,
    tarih_bitis: document.getElementById('f-tarih-bit').value || undefined,
    belge_tipi: document.getElementById('f-tip').value || undefined,
    satici: document.getElementById('f-satici').value.trim() || undefined,
    alici: document.getElementById('f-alici').value.trim() || undefined,
    belge_no: document.getElementById('f-belge-no').value.trim() || undefined,
  };
}

async function loadBelgeler(page = 0) {
  currentPage = page;
  const filters = buildFilters();
  const params = new URLSearchParams({ ...filters, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  try {
    const res = await fetch('/api/documents?' + params);
    if (!res.ok) throw new Error(`Sunucu hatası: ${res.status}`);
    const json = await res.json();
    renderBelgeler(json, page);
  } catch (err) {
    document.getElementById('belgeler-sonuc').innerHTML = `<p class="error">Yüklenemedi: ${esc(err.message)}</p>`;
  }
}

function renderBelgeler({ total, data }, page) {
  const el = document.getElementById('belgeler-sonuc');
  if (!data.length) { el.innerHTML = '<p class="empty">Sonuç bulunamadı.</p>'; document.getElementById('pagination').innerHTML = ''; return; }

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>#</th><th>Tarih</th><th>Tip</th><th>Belge No</th>
          <th>Satıcı</th><th>Alıcı</th>
          <th>Toplam (TL)</th><th>Durum</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((d) => `
          <tr data-id="${d.id}">
            <td>${d.id}</td>
            <td>${d.duzenleme_tarihi || '-'}</td>
            <td>${d.belge_tipi}</td>
            <td>${d.belge_no || '-'}</td>
            <td>${esc(d.satici_unvan || '-')}</td>
            <td>${esc(d.alici_unvan || '-')}</td>
            <td>${d.odenecek_tutar != null ? fmtPara(d.odenecek_tutar) : '-'}</td>
            <td><span class="badge badge-${d.parse_durumu}">${d.parse_durumu}</span></td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  document.querySelectorAll('#belgeler-sonuc tr[data-id]').forEach((tr) => {
    tr.addEventListener('click', () => openDetail(tr.dataset.id));
  });

  renderPagination(total, page);
}

function renderPagination(total, page) {
  const pages = Math.ceil(total / PAGE_SIZE);
  const el = document.getElementById('pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }

  const btns = [];
  btns.push(`<button ${page === 0 ? 'disabled' : ''} data-p="${page - 1}">‹</button>`);
  for (let i = 0; i < pages; i++) {
    btns.push(`<button class="${i === page ? 'active' : ''}" data-p="${i}">${i + 1}</button>`);
  }
  btns.push(`<button ${page >= pages - 1 ? 'disabled' : ''} data-p="${page + 1}">›</button>`);
  el.innerHTML = btns.join('');
  el.querySelectorAll('button[data-p]').forEach((b) => {
    b.addEventListener('click', () => loadBelgeler(parseInt(b.dataset.p)));
  });
}

document.getElementById('btn-ara').addEventListener('click', () => loadBelgeler(0));
document.getElementById('btn-temizle').addEventListener('click', () => {
  ['f-tarih-bas','f-tarih-bit','f-satici','f-alici','f-belge-no'].forEach((id) => document.getElementById(id).value = '');
  document.getElementById('f-tip').value = '';
  loadBelgeler(0);
});
document.querySelectorAll('#tab-belgeler input, #tab-belgeler select').forEach((el) => {
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadBelgeler(0); });
});

// --- Kalem arama ---
document.getElementById('btn-kalem-ara').addEventListener('click', loadKalemArama);
document.getElementById('kalem-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadKalemArama(); });

async function loadKalemArama() {
  const q = document.getElementById('kalem-q').value.trim();
  const el = document.getElementById('kalem-sonuc');
  if (q.length < 2) { el.innerHTML = '<p class="info">En az 2 karakter girin.</p>'; return; }

  try {
    const res = await fetch('/api/items?' + new URLSearchParams({ q, limit: 100 }));
    if (!res.ok) throw new Error(`Sunucu hatası: ${res.status}`);
    const json = await res.json();
    if (!json.data.length) { el.innerHTML = '<p class="empty">Sonuç bulunamadı.</p>'; return; }

    el.innerHTML = `
      <p class="info">${json.total} kalem bulundu.</p>
      <table>
        <thead>
          <tr><th>Belge No</th><th>Tarih</th><th>Satıcı</th><th>Açıklama</th><th>Miktar</th><th>Birim Fiyat</th><th>KDV%</th><th>Tutar</th></tr>
        </thead>
        <tbody>
          ${json.data.map((i) => `
            <tr data-id="${i.document_id}">
              <td>${i.belge_no || '-'}</td>
              <td>${i.duzenleme_tarihi || '-'}</td>
              <td>${esc(i.satici_unvan || '-')}</td>
              <td>${esc(i.aciklama || '-')}</td>
              <td>${i.miktar != null ? i.miktar : '-'} ${i.birim || ''}</td>
              <td>${i.birim_fiyat != null ? fmtPara(i.birim_fiyat) : '-'}</td>
              <td>${i.kdv_orani != null ? '%' + i.kdv_orani : '-'}</td>
              <td>${i.mal_hizmet_tutari != null ? fmtPara(i.mal_hizmet_tutari) : '-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    document.querySelectorAll('#kalem-sonuc tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', () => openDetail(tr.dataset.id));
    });
  } catch (err) {
    el.innerHTML = `<p class="error">Yüklenemedi: ${esc(err.message)}</p>`;
  }
}

// --- Gözden geçir sekmesi ---
async function loadGozdenGecir() {
  const el = document.getElementById('gozden-sonuc');
  el.innerHTML = '<p class="info">Yükleniyor...</p>';
  try {
    const [res1, res2] = await Promise.all([
      fetch('/api/documents?' + new URLSearchParams({ parse_durumu: 'SUPHELI', limit: 200 })),
      fetch('/api/documents?' + new URLSearchParams({ parse_durumu: 'HATALI', limit: 200 })),
    ]);
    if (!res1.ok || !res2.ok) throw new Error('Sunucu hatası');
    const [json1, json2] = await Promise.all([res1.json(), res2.json()]);

    const data = [...json1.data, ...json2.data];
    if (!data.length) { el.innerHTML = '<p class="empty">Harika! Gözden geçirilecek belge yok.</p>'; return; }

    el.innerHTML = `
      <p class="info">${data.length} belge gözden geçirme bekliyor.</p>
      <table>
        <thead><tr><th>#</th><th>Tarih</th><th>Belge No</th><th>Satıcı</th><th>Durum</th><th>Not</th></tr></thead>
        <tbody>
          ${data.map((d) => `
            <tr data-id="${d.id}">
              <td>${d.id}</td>
              <td>${d.duzenleme_tarihi || '-'}</td>
              <td>${d.belge_no || '-'}</td>
              <td>${esc(d.satici_unvan || '-')}</td>
              <td><span class="badge badge-${d.parse_durumu}">${d.parse_durumu}</span></td>
              <td>${esc(d.parse_notu || '-')}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    document.querySelectorAll('#gozden-sonuc tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', () => openDetail(tr.dataset.id));
    });
  } catch (err) {
    el.innerHTML = `<p class="error">Yüklenemedi: ${esc(err.message)}</p>`;
  }
}

// --- Belge detay modal ---
async function openDetail(id) {
  try {
    const res = await fetch(`/api/documents/${id}`);
    if (!res.ok) throw new Error(`Belge yüklenemedi (${res.status})`);
    const d = await res.json();
    document.getElementById('modal-icerik').innerHTML = renderDetail(d);
    document.getElementById('modal-overlay').classList.remove('hidden');
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('modal-kapat').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

function renderDetail(d) {
  const field = (label, val) => val != null && val !== ''
    ? `<dt>${label}</dt><dd>${esc(String(val))}</dd>` : '';

  return `
    <h2 style="margin-bottom:12px">${d.belge_tipi} — ${d.belge_no || d.ettn || '#' + d.id}</h2>
    <div class="detail-grid">
      ${field('Düzenleme Tarihi', d.duzenleme_tarihi)}
      ${field('Düzenleme Zamanı', d.duzenleme_zamani)}
      ${field('Senaryo', d.senaryo)}
      ${field('Fatura Tipi', d.fatura_tipi)}
      ${field('ETTN', d.ettn)}
      ${field('Parse Durumu', d.parse_durumu)}
      ${d.parse_notu ? field('Parse Notu', d.parse_notu) : ''}
    </div>

    <p class="detail-section-title">Satıcı</p>
    <div class="detail-grid">
      ${field('Unvan', d.satici_unvan)}
      ${field('VKN/TCKN', d.satici_vkn_tckn)}
      ${field('Vergi Dairesi', d.satici_vergi_dairesi)}
      ${field('Adres', d.satici_adres)}
      ${field('E-Posta', d.satici_eposta)}
      ${field('Telefon', d.satici_telefon)}
    </div>

    <p class="detail-section-title">Alıcı</p>
    <div class="detail-grid">
      ${field('Unvan', d.alici_unvan)}
      ${field('VKN/TCKN', d.alici_vkn_tckn)}
      ${field('Vergi Dairesi', d.alici_vergi_dairesi)}
      ${field('Adres', d.alici_adres)}
      ${field('E-Posta', d.alici_eposta)}
    </div>

    <p class="detail-section-title">Tutarlar</p>
    <div class="detail-grid">
      ${field('Mal/Hizmet Toplam', d.mal_hizmet_toplam_tutari != null ? fmtPara(d.mal_hizmet_toplam_tutari) + ' TL' : null)}
      ${field('Hesaplanan KDV', d.hesaplanan_kdv_toplam != null ? fmtPara(d.hesaplanan_kdv_toplam) + ' TL' : null)}
      ${field('Vergiler Dahil Toplam', d.vergiler_dahil_toplam_tutar != null ? fmtPara(d.vergiler_dahil_toplam_tutar) + ' TL' : null)}
      ${field('Ödenecek Tutar', d.odenecek_tutar != null ? fmtPara(d.odenecek_tutar) + ' TL' : null)}
    </div>

    ${d.notlar ? `<p class="detail-section-title">Notlar</p><p style="font-size:13px;color:#555">${esc(d.notlar)}</p>` : ''}

    <p class="detail-section-title">Kalemler (${d.items.length})</p>
    ${d.items.length ? `
      <table>
        <thead>
          <tr><th>#</th><th>Açıklama</th><th>Miktar</th><th>Birim</th><th>Birim Fiyat</th><th>KDV%</th><th>KDV Tutarı</th><th>Tutar</th></tr>
        </thead>
        <tbody>
          ${d.items.map((i) => `
            <tr>
              <td>${i.sira_no || '-'}</td>
              <td>${esc(i.aciklama || '-')}</td>
              <td>${i.miktar != null ? i.miktar : '-'}</td>
              <td>${esc(i.birim || '-')}</td>
              <td>${i.birim_fiyat != null ? fmtPara(i.birim_fiyat) : '-'}</td>
              <td>${i.kdv_orani != null ? '%' + i.kdv_orani : '-'}</td>
              <td>${i.kdv_tutari != null ? fmtPara(i.kdv_tutari) : '-'}</td>
              <td>${i.mal_hizmet_tutari != null ? fmtPara(i.mal_hizmet_tutari) : '-'}</td>
            </tr>`).join('')}
        </tbody>
      </table>` : '<p class="empty">Kalem bulunamadı.</p>'}

    ${d.kaynak_dosya ? `<p style="margin-top:14px;font-size:12px;color:#aaa">Kaynak: ${esc(d.kaynak_dosya)}</p>` : ''}
  `;
}

// --- Yardımcılar ---
function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtPara(n) {
  return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// İlk yükleme
loadBelgeler(0);
