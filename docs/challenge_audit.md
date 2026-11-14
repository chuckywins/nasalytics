# Yarışma metni ↔ sistem karşılaştırması (2026-11-14 gece)
Kaynak: `docs/challenge.md` (resmi metin + Resources sekmesi). ✓ = var · ◐ = kısmen · ✗ = yok.

| Yarışma cümlesi | Sistemde | Durum |
|---|---|---|
| "gathers health indicators" | Simüle akış (nabız, SpO₂, solunum, CO₂) + elle giriş + VEGA sesli giriş + yorgunluk kamerası + reaksiyon testi + sesli günlük | ✓ |
| "enables astronauts to evaluate and act" | Deterministik kural motoru + AI değerlendirme + adım adım yönerge + CMO müdahale kartları | ✓ |
| Göstergeler: BP, HR, blood sugar, body temp, sleep hours, mood | Altısı da var (açlık/tokluk bağlamı, aktiviteye göre nabız bandı) | ✓ |
| "guidance on treatments and health improvements" | Yönerge kartları, günlük rutin, CMO/yer kontrol protokol kartları (JSC-48031, ADA, AHA) | ✓ |
| "camera images ... ultrasound images" | Yorgunluk kamerası (MediaPipe) + VEGA'ya tek kare. Cihaz/ultrason fotoğrafı okuma (Camera.tsx, /api/vision) kodda var ama kullanıcı isteğiyle arayüzden kaldırıldı | ◐ (karar kullanıcıda) |
| "Which measurements can be performed in space?" | Her göstergede "i": uzayda nasıl ölçülür (CSA Bio-Monitor vb.) | ✓ |
| "Why is an exam needed?" | "i" kartlarında "neden önemli" | ✓ |
| "How do spaceflight hazards affect these indicators?" | Organ kartları "uzayda ne olur" + RIDGE etiketleri | ✓ |
| "When might a result warrant attention from the crew or from flight surgeons?" | Eskalasyon (kendin / CMO / uçuş cerrahı) + CMO ve yer kontrol görünümleri, gerçek iletişim gecikmesi | ✓ |
| "What actions can be taken to prevent a critical health condition?" | Egzersiz/uyku rutini, radyasyonda sığınak, CO₂'de EVA sonlandırma, kemik kaybı projeksiyonu | ✓ |
| Tıklanabilir insan figürü | 3B anatomi, organ tıklama + bilgi | ✓ |
| Farklı ortamlar: spacecraft, station, **rover**, base on planet/moon | ISS, Ay transferi, Ay üssü, Mars transferi, Mars üssü + EVA aktivitesi. **Rover yok** | ◐ |
| Rutin ölçüm hatırlatma | Açılır pencere hatırlatma (30 sn, sonra 5 dk) | ✓ |
| Oyunlaştırma | Puan, seri, rozet | ✓ |
| Dinamik grafikler | Trend, gerçek fırtına tekrarı, I4 lab eğilimleri | ✓ |
| Renk kodlama | Durum renkleri + simge (renk körlüğü için yalnız renk değil) | ✓ |
| Basit talimat ve açıklama | Bilgi ikonları, VEGA, senaryo anlatımı | ✓ |
| Sağlık sorunları: immune changes | I4 lab panelinde lenfosit R+1 −%31 (gerçek veri) gösteriliyor; canlı bağışıklık göstergesi yok (uzayda ölçümü kan örneği ister) | ◐ |
| bone density loss | Kemik kaybı projeksiyonu (NASA %1–1,5/ay) | ✓ |
| cardiovascular events | Nabız/KB/EKG, taşikardi senaryosu, göğüs ağrısı protokolü | ✓ |
| **inadequate nutrition** | Yalnız bilgi metni; beslenme göstergesi (kalori/sıvı/kilo) yok | ✗ |
| behavioral health | Ruh hâli, sesli günlük, yorgunluk kamerası, reaksiyon testi | ✓ |
| 5 tehlike (RIDGE) | Radyasyon (gerçek veri), izolasyon (ruh hâli/ses), uzaklık (gecikme, yer kontrol), yerçekimi (ortam, kemik, şok pozisyonu), kapalı ortam (CO₂/O₂/basınç) | ✓ |
| Resources: CSA radyasyon izleme | Doz hızı/kümülatif doz, TEPC + RadLab gerçek veri; CSA aletleri bilgi notlarında | ✓ |

## Bu turda düzeltilen hatalar
- Egzersiz nabız bandı (≤170 → AHA %85 ≈ 153, yaş 40 varsayımı ekranda).
- I4 referans aralıkları kişiye/örneğe göre (halkalar düzeltildi).
- ISS fırtına şiddeti ALARA uyarısına indirildi; Mars çarpanı tabanıyla birlikte gösteriliyor.

## Kullanıcı kararı bekleyen boşluklar
1. Beslenme göstergesi (ör. günlük sıvı/kalori/kilo girişi) — NASA HRP "Risk of Inadequate Food and Nutrition".
2. Cihaz/ultrason fotoğrafı okuma modülünü geri açmak (kod hazır).
3. Rover ortamı (ortam listesine eklemek; doz verisi için kaynak gerekir).
