# Teslim Formu Kuralları (kullanıcı ekran görüntülerinden, 2026-11-14)

- **Project Name:** "Project NASAlytics" (formda girili)
- **Summary\*:** 50–200 kelime önerilir, en fazla 1.500 karakter. Ne geliştirdik, yarışmayı nasıl karşılıyor, neden önemli.
- **Project Demonstration\*:** **en fazla 7 slayt** (başlık ve giriş dahil) **YA DA en fazla 30 saniyelik video**. YouTube, Drive, GitHub, OneDrive veya Dropbox'ta; **şifre, izin ya da kayıt gerektirmeyen** tam URL. Global Award için zorunlu.
- **Project\*:** herkese açık proje linki (site, bulut, repo, YouTube...). **Şifre, izin ya da kayıt olmadan erişilebilir olmalı.** Global Award için zorunlu.
- **Project Details\*:** Ne yapıyor, nasıl çalışıyor, faydası, hedeflenen etki, kullanılan araç/dil/donanım/yazılım, neden yaratıcı, ekip hangi faktörleri dikkate aldı.
- **Use of Super Intelligence (SI)\*:** AI kullanımı serbest, ancak:
  - Üretilen içerik **NASA logosu, bayrağı, görev kimliği gibi NASA marka ve tasarım öğelerini kullanamaz, içeremez, değiştiremez.**
  - **Görsel ve videolar:** AI üretimi olduğunu gösteren **görünür filigran** olmalı.
  - **Ses:** açıklama metni ve metadata'da AI üretimi belirtilmeli (JARVIS TTS sesi de dahil).
  - **Kod ve veri:** açıklama metni ve metadata'da AI üretimi belirtilmeli (README + kod başlıkları).
  - Bu alan jüriye gösterilmez, ama jüri projedeki AI işaretlerini görür ve özgünlüğü, niyeti ve uygulamayı buna göre değerlendirir.
- **NASA Data\*:** Global Award için **NASA verisi veya kaynağı kullanmak zorunlu.** Her biri için Link Text ve Link URL listelenir.
- **Space Agency Partner & Other Data:** NASA dışı tüm veri, kaynak ve araçlar (açık kaynak kod, metin, görseller dahil). Telifli materyal izin gerektirir. Tüm linkler herkese açık olmalı.
- **Doğrulama:** Project Submission Guide + Participant Terms; "tüm iş özgün, tüm dış kaynaklar listelendi" onayı.

## Sivas yerel etkinliği (kullanıcının paylaştığı metin, 2026-11-14)
- Projeler resmî platforma teslim süresi içinde yüklenir.
- Takımlar projeyi **yerel jüriye canlı sunar**: çözüm, kullanılan teknolojiler, işleyiş + **jüri soruları**.
- **5 değerlendirme kriteri:** **Etki (Impact) · Yaratıcılık (Creativity) · Bilimsel ve Teknik Geçerlilik (Validity) · Challenge'a Uygunluk (Relevance) · Sunum (Presentation)**
- Beklenenler: çözümün açıklaması, **veri kaynaklarının belirtilmesi**, kaynak kod, demo bağlantıları, destekleyici materyaller.
- Sunum süresi ve formatı etkinlik öncesinde duyurulacak (henüz bilinmiyor).
- Güncel bilgiler: https://www.spaceappschallenge.org/resources/
- Resmi 2026 teslim penceresi: 14 Kasım 09:00 → 15 Kasım 23:59 (yerel). Kullanıcının söylediği bitiş 15:00 (yerel etkinlik), plan 15:00'e göre.

## Mimari sonuçları
- Proje linki olarak **kod reposu (GitHub) da kabul ediliyor**, canlı site artı puan. Jüri linki sonra, kendi bilgisayarında, büyük ihtimalle mikrofon kullanmadan açar. Bu yüzden:
  - Simülatör ve kural motoru **TypeScript ile tarayıcıda** çalışır, NASA serileri statik JSON olur. **Statik site** olarak yayınlanır (sunucusuz da tam çalışır).
  - FastAPI yalnızca ince bir Claude proxy'si + çoklu bilgisayar demosu için röle olur. Herkese açık sitede sekmeler arası iletişim BroadcastChannel ile.
  - Herkese açık endpoint için **ayrı API anahtarı + harcama tavanı + IP başına hız sınırı**.
- Okunacak: formdaki "NASA Space Apps Project Submission Guide" (proje adında "NASA" kullanımına izin var mı?).
- Demo: 30 sn video (kısa) veya 7 slayt. Muhtemelen ikisi de hazırlanır ve en güçlüsü verilir.
- 3B modeller ve dokularda NASA logosu olmamalı.
