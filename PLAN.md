# NASALYTIC: Plan v2 (resmi metne göre yeniden yazıldı, 2026-11-14 14:30)

**Son teslim:** 15 Kasım 2026, 15:00. **Son 3–4 saat** (≈11:00'den itibaren) yalnızca sunum (≤7 slayt, İngilizce, doğrulanacak), video, proje sayfası ve kaynakça için ayrılır.
**Kaynaklar:** resmi metin `docs/challenge.md` · bilgi bankası `docs/research_notes.md` · kaynakça `SOURCES.md` · günlük `PROGRESS.md`

## Jüri kriterleri → bunları kazandıran özellik (Sivas yerel jüri, canlı sunum + soru-cevap)
| Kriter | Bizi öne çıkaracak özellik |
|---|---|
| **Etki** | Dünya'dan bağımsız (Mars gecikmesi) öz-değerlendirme + erken uyarı + eskalasyon; Dünya'da uzak bölgeler ve ICU için de geçerli |
| **Yaratıcılık** | Sesli JARVIS, 3B hologram vücut, kamera ve ultrason yorumu, gerçek güneş fırtınası tekrarı |
| **Bilimsel geçerlilik** | NASA-STD-3001 madde numaralı eşikler, gerçek NASA ölçümleri (TEPC, RadLab, DONKI, I4), her sayıda köken etiketi, deterministik güvenlik çekirdeği |
| **Challenge'a uygunluk** | Resmi metindeki 12 maddenin hepsi + 5 tehlike (RIDGE) |
| **Sunum** | Canlı çok bilgisayarlı demo, yedek video, soru-cevap hazırlık sayfası; **10:00'da özellik dondurma, prova** |

**Açık noktalar:** sunum süresi ve formatı ile gerçek teslim saati Sivas organizasyonuna sorulacak. Proje adındaki "NASA" kelimesine izin olup olmadığı belirsiz; gerekirse nötr bir ad seçilecek.

## Kullanıcı istekleri: backlog (2026-11-14 ~16:00, unutulmayacak)
1. **rPPG:** kameradan yüzdeki renk değişiminden nabız ölçümü (temassız)
2. **Ses analizi + duygu durumu:** günlük sesli görev kaydı → ses titremesi, konuşma hızı, kelime seçimi → depresyon, izolasyon, stres, bilişsel yorgunluk işaretleri
3. **AI her yerde:** sağlık değerlendirmesini de yapay zekâ yapsın; anlık ekran uyarısı + **sesli tehlike alarmı**. API bütçesi sorun değil (~500$).
4. **Görüntü işleme:** anlık duygu durumu analizi, jest/mimik kontrolü
5. **Klinik kılavuz linkleri sorunu:** kötü durumdaki astronot linke tıklayıp okuyamaz → uygulama içinde **özet + ne yapılacağı** gösterilmeli; link yalnızca ek kaynak olmalı
6. **Her alanın yanında info (i) ikonu:** üzerine gelince "bu değer nereden, hangi cihazla, nasıl ölçülüyor" (ör. nabız → Bio-Monitor tişört EKG'si; kan şekeri → parmak ucu glukometre) gerçek bilgiyle
7. **Senaryolar** (sonraki aşama): taşikardi riskinde sistemin tepkisi vb.
8. Proje başlığına ve yarışmanın isteğine sadık kalmak

### Fable kararı (5. danışma): AI her yerde, tek koşulla
Her AI çıktısı neyi hesapladığını adlandırır (kamera nabzı, konuşma hızı, göz kırpma). Çıkarılan durumlar (yorgunluk, düşük ruh hâli) **teşhis değil, astronotun onaylayacağı ipucu** olarak sunulur.
- **Kurallar** alarmı anında ve internetsiz verir. **Claude** üstüne değerlendirmeyi yazar. Eskalasyon = max(kural, AI): **AI uyarı yükseltebilir, asla kapatamaz.**
- **Sıra:** (1) proxy + AI değerlendirme (durum değişiminde, debounce, "AI" etiketi) → (2) Web Audio alarm + "oturumu başlat" tıklaması + onay butonu → (3) JARVIS bas-konuş → (4) info popover'ları + link yerine ≤3 adım → (5) kamera: ölçüm cihazı fotoğrafı (Sonnet okur, astronot onaylar), ardından rPPG → (6) sesli günlük → (7) senaryolar. (5) ve (6) seri sayaçlı **"günlük check-in"** olarak paketlenir (rutin + oyunlaştırma).
- **Kesilen:** yüz ifadesinden duygu analizi (bilimsel olarak tartışmalı). Kalırsa yalnız göz kırpma hızı / göz kapanması (yorgunluk ipucu). Yerine **reaksiyon süresi testi** (NASA'nın 10 dk uyanıklık öz testine dayanır).
- **rPPG:** yüz oval rehberi, ROI ortalama yeşil kanal, 40–180 bpm bant geçiren filtre, 10–15 sn spektral tepe. Sinyal zayıfsa sayı yerine "zayıf sinyal". Alarmlara GİRMEZ. 2 takım üyesinde saatle kıyaslanıp hata raporlanır.
- **Sesli günlük:** konuşma hızı + duraklama oranı hesaplanır; Claude kanıtı transkriptten alıntılar. "Titreme" ancak hesaplanırsa gösterilir.
- **Tuzak:** nabız ≥150 her zaman "kritik" → egzersiz/EVA'da yanlış alarm. **Aktivite durumu** (dinlenme / egzersiz / EVA) nabız ve solunum bantlarını kaydırır. Taşikardi senaryosu tam olarak bu.
- **Popover içerikleri** yalnızca eldeki kaynaklardan: uzayda nasıl ölçülür / prototip nasıl alır / neden önemli. Bio-Monitor deri ısısı ölçer, çekirdek ısı değil (ateş için kaynak gösterilmez). Glukoz ölçümü için kaynak: CSA Bio-Analyzer sayfası.
- **Kamera/mikrofon:** veri yalnızca açık "yakala" eyleminde cihazdan çıkar, ekranda yazılır. Kamera reddedilse de her şey çalışmalı.

### Yüz duygu tanıma değerlendirmesi (2026-11-14 17:30)
github.com/NkL-M/Real-Time-Facial-Emotion-Recognition: **LİSANS YOK** (GitHub API license=None → tüm hakları saklı), doğruluk raporlanmamış, FER-2013 7 sınıf, Python/Streamlit (ONNX 24,5 MB var). **Kullanılmayacak** (teslim beyanı riski + bilimsel geçerlilik). **KARAR (kullanıcı, 17:40): kamera geri geldiğinde MediaPipe kullanılacak.** Alternatif: **MediaPipe Face Landmarker (Apache 2.0, tarayıcıda)** → göz kırpma hızı, PERCLOS (yorgunluk), "görünen ifade" (duygu değil, onaylanacak ipucu), ileride rPPG aynı akıştan.

## Omurga: jürinin 12 maddesi (eksiksiz karşılanacak)
1. Astronotun **kendi sağlığını değerlendirdiği görsel araç** + tedavi ve iyileştirme rehberliği
2. Girdi: klavye, fare, **kamera** (ör. glukometre ekranı fotoğrafı, **ultrason görüntüsü**)
3. Altı ana gösterge: **kan basıncı, nabız, kan şekeri, vücut ısısı, uyku saati, ruh hâli** (+ SpO₂, solunum, CO₂, radyasyon dozu)
4. Eskalasyon: **ben → mürettebat CMO → yer uçuş cerrahı** (gecikmeli)
5. Kritik durumu önleme aksiyonları (protokol kartları)
6. **Tıklanabilir insan figürü** (organ işlevi + durum + uzay etkisi; CSA infografiğine dayalı)
7. **Ortam profilleri:** ISS · Orion/Ay transit · Ay üssü · Mars transit · Mars üssü · rover (gecikme, yerçekimi, doz hızı değişir)
8. **Rutin ölçüm ve aksiyon hatırlatıcıları** (görev takvimi)
9. **Oyunlaştırma** (seriler, rozetler, ekip görevleri)
10. **Trend grafikleri** (kişisel baz çizgisine göre)
11. **Renk kodlama** (yeşil / sarı / turuncu / kırmızı)
12. **Basit açıklamalar** (her ölçüm için nasıl, neden, uzay etkisi)

## Fark katmanı (omurganın üstüne)
- **JARVIS:** sesli ve eller serbest asistan (Claude + Web Speech). EVA'da elle giriş yapılamaz, ses gerekir.
- **Kamera ile görme:** Claude vision ölçüm cihazı ekranını okur ve ultrason görüntüsü hakkında gözlem verir (teşhis koymaz).
- **Üç görünüm:** Astronot HUD · Mürettebat (CMO) · Görev Kontrol (gerçek gecikmeyle).
- **Gerçek fırtına tekrarı:** Mars yüzeyi 20 Mayıs 2024 (MSL-RAD, ≈40×) ve 1 AU 13 Mayıs 2024 (BPD, ≈20×).
- **Acil durum senaryosu:** EVA'da ani kardiyak olay → WCD ritim analizi → şok kararı (konsept donanım).

## Güvenlik mimarisi ilkesi (jüri sorusu: "20 dk gecikmede bulut AI nasıl çalışır?")
- **Deterministik güvenlik çekirdeği** (kural motoru, eskalasyon, WCD durum makinesi) internet ve LLM olmadan çalışır. Tüm alarmlar ve kararlar buradan gelir.
- **LLM (JARVIS) yalnızca açıklama ve etkileşim katmanıdır:** araçlarla değerleri okur, kural motorunun ve bilgi bankasının sayılarını aktarır, kendisi eşik uydurmaz. Gerçek görevde araç içi (onboard) model varsayımı açıkça belirtilir.
- **Demo yedeği:** Wi-Fi bozulursa önceden hazırlanmış yanıtlarla çalışır (canned fallback).
- Claude anahtarı yalnızca backend'de durur; herkese açık demo gerekiyorsa hız sınırı + gizli erişim kodu olur.

## Kıyafet içi şok: bilimsel çerçeve
- Kalp krizi (MI) ≠ kalp durması. Şok yalnızca VF/nabızsız VT'de. Akış: WCD (ZOLL LifeVest benzeri) → ritim analizi → sesli uyarı → yanıt yok ve CMO iptal etmedi → şok → yeniden analiz.
- **Kısıt:** kıyafet atmosferi %100 O₂ / ~4,3 psia, kıvılcım yangın riski taşır. Ekranda "**concept hardware**" etiketi ve bu kısıt yazılır.
- Yanında **NASA'nın belgelenmiş aksiyonuyla** biten EVA senaryoları: CO₂ artışı veya DCS belirtisi → **EVA'yı güvenle ve hızla sonlandır, basınçlı ortama dön**.

## Senaryolar
1. **Rutin gün (ana demo):** sabah ölçümleri (manuel + kamera) → renk kodu → vücut haritası → trend → JARVIS rehberliği → rozet
2. **Mars üssü güneş fırtınası (gerçek veri):** doz artışı → alarm → sığınak → EVA iptali; Dünya 12 dk sonra görür
3. **EVA'da CO₂ birikimi / hiperkapni:** solunum ↑, baş ağrısı → JARVIS → EVA sonlandırma
4. **EVA'da DCS belirtisi:** eklem ağrısı bildirimi (sesle) → protokol → dönüş
5. **EVA'da kardiyak arrest (konsept):** VF → WCD → CMO onayı veya iptali → şok
6. **Uzun dönem:** kemik/kas kaybı (ayda %1–1,5), kümülatif doz → 600 mSv kariyer limitine oran, uyku ve ruh hâli trendi

## Mimari
```
[Simülasyon + senaryo motoru (Python)]  gerçek veri: RadLab, DONKI, I4 baz çizgileri
        ▼
[FastAPI]  WebSocket · deterministik kural motoru · eskalasyon · WCD durum makinesi · gecikme kuyruğu
        └── /api/jarvis → Claude (tool use, vision), anahtar yalnızca sunucuda
        ▼
[React + Vite]  /astronaut · /crew · /mission-control   (Web Speech API: STT + TTS)
```
Barındırma kararı, jüri ve teslim kuralları öğrenildikten sonra verilecek (canlı link gerekiyor mu?).

## İş sırası (ince uçtan uca dilim önce)
1. **Dilim 0:** ölçüm gir → renk kodu → vücut haritasında organ yanar → trend grafiği → rehberlik kartı
2. Kural motoru + eşikler (research_notes §3), ortam profilleri, gerçek doz verisi
3. Rutin hatırlatıcılar, oyunlaştırma, açıklama kartları
4. JARVIS (metin → ses → vision), canned fallback
5. Üç görünüm + gecikme + eskalasyon
6. Senaryo motoru (fırtına tekrarı, EVA senaryoları, WCD)
7. Cila → **11:00'den sonra** sunum, video, proje sayfası
