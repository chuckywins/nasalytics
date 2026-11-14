# Araştırma Notları: Bilgi Bankası

Resmi metin: `docs/challenge.md` · OCHMO PDF'leri ve metin hâlleri: `docs/refs/` · Tüm URL'ler: `SOURCES.md`

## 1. Jürinin istediği (resmi metinden kontrol listesi)
| # | İstek | Bizim karşılığımız |
|---|---|---|
| 1 | Astronotun **kendi sağlığını değerlendirdiği görsel araç**, tedavi ve iyileştirme rehberliği | Astronot paneli + JARVIS rehberliği |
| 2 | Girdi: klavye, fare, **kamera görüntüsü** (ör. kan şekeri mg/dL, **ultrason görüntüsü**) | Manuel ölçüm girişi + kamera/ultrason yükleme (Claude vision ile yorum) |
| 3 | Önerilen göstergeler: **kan basıncı, nabız, kan şekeri, vücut ısısı, günlük uyku saati, ruh hâli** | Altısı da birinci sınıf gösterge olacak |
| 4 | Ne zaman **mürettebatın** ya da **yer uçuş cerrahının** dikkati gerekir? | Eskalasyon katmanları: kendi → mürettebat CMO → uçuş cerrahı (gecikmeli) |
| 5 | Kritik durumu önlemek için hangi aksiyonlar? | Protokol motoru + JARVIS |
| 6 | **Tıklanabilir insan figürü** (organ işlevi + sağlık durumu) | 3B/2B vücut haritası |
| 7 | Farklı ortamlar: **uzay aracı, istasyon, rover, gezegen/ay üssü** | Görev profili: ISS / Orion-Ay / Mars transit / Mars yüzeyi / rover |
| 8 | Rutin içinde **zaman zaman ölçüm ya da aksiyon isteme** | Görev takvimi + bildirimler |
| 9 | **Oyunlaştırma** | Görev/rozet/seri sistemi (egzersiz, uyku, hidrasyon, ölçüm) |
| 10 | **Zaman içinde dinamik grafikler** | Trend grafikleri, uçuş öncesi baz çizgiye göre |
| 11 | **Renk kodlama** | Yeşil / sarı / turuncu / kırmızı durum sistemi |
| 12 | Astronotun her şeyi bildiğini varsayma: **basit talimatlar ve açıklamalar** | Her ölçüm için "nasıl yapılır / neden önemli / uzay etkisi" kartları |

Difficulty: Intermediate · Konular: Human Exploration, Software, Space Exploration.

## 2. Beş tehlike (RIDGE) ve sağlığa etkileri
- **R, Radiation:** GCR (galaktik kozmik ışınlar, kalkanlaması zor), SPE (güneş parçacık olayları), yakalanmış kuşaklar. Etkiler: kanser, CNS (bilişsel ve motor), kardiyovasküler ve dejeneratif hastalık, katarakt, DNA hasarı. ISS'te dozun ~%30'u nötron (CSA). Ölçüm: TEPC, CPDS, RAM, CPD; pasif dozimetreler TLD/OSLD/PNTD (SRAG, JSC, 7/24). CSA aletleri: CANS, Bubble detector, MOSFET, EVARM, Radi-N2.
- **I, Isolation & Confinement:** uyku kaybı, sirkadiyen bozulma, iş yükü, anksiyete/depresyon, takım uyumu. Karşı önlemler: aktigrafi, LED ışık, **10 dakikalık uyanıklık öz testi (PVT)**, günlük tutma, VR, sera, pencere, mahremiyet, aile görüşmesi. Mars'ta gün 37 dk daha uzun. HERA 45 gün (650 ft²), CHAPEA 378 gün (1.700 ft²).
- **D, Distance:** Mars ortalama 140 milyon mil, görev ~3 yıl; **tek yön gecikme 20 dk'ya kadar** (HERA 5 dk ile test eder). Mürettebat IV sıvısı hazırlar, ultrason yapar. NASA AI/ML tabanlı klinik karar destek araçları geliştiriyor (NTRS 20200000567). Astronot ortalama 300 saat simülatör eğitimi alır.
- **G, Gravity:** Mars transit ~6 ay 0g, Mars 3/8 g (≈0,38 g). Kemik kaybı **ayda %1–1,5**; boy %3'e kadar uzar; sıvı kayması kafaya doğru (SANS); böbrek taşı (dehidrasyon + kalsiyum atılımı); ortostatik intolerans (inişte bayılma); hareket hastalığı (astronotların çoğu). Fitness kaybı ortalama %10–12; ekibin %12–38'i >%20 kaybeder. Egzersiz: haftada 6–7 gün, günde 1,5 saat.
- **E, Hostile/Closed:** sıcaklık, basınç, aydınlatma, gürültü, mikroplar; stres hormonları ↑, bağışıklık değişir, latent virüs reaktivasyonu (uçuk, zona), döküntü, alerji. Hava izleme: formaldehit, amonyak, CO.

## 3. Eşik değerler (kural motoru için, kaynaklı)
Bu tablo `grep -B4 -A5` ile bağlamında doğrulandı (2026-11-14, advisor uyarısı üzerine).

| Parametre | Değer | Kaynak |
|---|---|---|
| Kariyer radyasyon limiti | **< 600 mSv** efektif doz (tüm yaş/cinsiyet; NASA Q, 35 yaş kadın modeli, REID tabanlı) | NASA-STD-3001 **V1 [4030]**, OCHMO-TB-020 Rev E |
| SPE olay başı | **< 250 mSv** (tasarım referansı: Ekim 1989 olaylarının toplam proton spektrumu) | **V1 [4031]** |
| Nükleer kaynak | < 20 mSv/görev yılı | V1 [4032] |
| ALARA ilkesi | dozlar makul ölçüde mümkün olan en düşükte tutulur | V1 [4029] |
| Yüzey görevi ortam dozu | **~0,5 mSv/gün** (bir *yüzey görevi* analizinden; nükleer limit hesabının dayanağı). 1,5 mSv/gün değeri yalnızca bir hesap örneği | OCHMO-TB-020 |
| SPE ve EVA | SPE'lerin ~%95'i yalnızca ALARA gerektirir. Gerçek zamanlı alarm dozimetrisi, **EVA 2 saat içinde sonlandırılır ve kalkana erişim olursa** çok yüksek koruma sağlar. Erken uyarı, aracı güvenli hâle getirip sığınak kurmaya imkân verir | OCHMO-TB-020 |
| Doz birimi notu | RadLab **emilen doz (μGy/sa)** verir, limitler **efektif doz (mSv)**. Dönüşüm için kalite faktörü Q gerekir. OCHMO "NASA Q" der ama sayı vermez; yayımlanmış ölçümler: MSL-RAD Mars transit ort. Q≈3,8 (Zeitlin+ 2013, Science), Mars yüzeyi Q≈3,05 (Hassler+ 2014, Science). **Doğrulanacak**, ekranda dönüşüm açıkça gösterilecek | |
| Habitat CO₂ | 1 saatlik ortalama **≤ 3 mmHg** (baş ağrısı < %1,4). Baş ağrısı < %1 için 7 günlük ortalama < 2,5 mmHg. ISS aralığı 1–9 mmHg | NASA-STD-3001 **V2 [6004]**, OCHMO-TB-004 |
| Kıyafet CO₂ | kıyafet solunan CO₂ (PICO₂) limitleri "Table 35"e göre | **V2 [11039]** (tablo değerleri henüz okunmadı) |
| CO₂ semptomları | 2,8–4,5 mmHg baş ağrısı; >4,5 mmHg yorgunluk, uyku azalması, bulantı; 4,5–5,0 mmHg trigeminal disestezi. Astronotların %38,7'si baş ağrısı bildirdi. 0,5% CO₂ = 3,8 mmHg | OCHMO CO₂ |
| Kıyafet ekranı | Kıyafet **basıncı, ppO₂ ve ppCO₂ göstermeli** [V2 11035]; EVA **metabolik hız ölçülmeli/gösterilmeli** [V2 11037/11038] | OCHMO CO₂ |
| Kabin basıncı | 5,0–15,0 psia (34,5–103 kPa) süresiz maruziyet; diluent gaz ≥ %30 | V2 [6002], OCHMO atmosfer |
| Normoksi | PIO₂ = 149 mmHg (deniz seviyesi). PaO₂ ~80 mmHg'de hafif bozulma, 30 mmHg'de bilinç kaybı. Ruh hâli ve reaksiyon etkisi ~9.000 ft EAA | OCHMO atmosfer |
| Hipoksi semptomları | konfüzyon, baş ağrısı, görme bozukluğu, uyku sorunu | NASA risk sayfası |
| EVA kıyafet basıncı | tarihsel olarak **4,3 psia**; kabin 14,7 psia | OCHMO DCS |
| Prebreathe | 4 saat %100 O₂ (14,7 psia); kamp: 10,2 psia / %26,5 O₂; egzersizli prebreathe | OCHMO DCS |
| DCS kabul edilebilir risk | < %4 olasılık (%95 güven). Belge "vakaların çoğu 60–240 dakika arasında ortaya çıkar, inflamatuvar yanıt 24 saati aşabilir" der; **neye göre (dekompresyon başlangıcı) açıkça belirtilmemiş**, sunumda "dekompresyondan sonra" diye dikkatli ifade edilecek | OCHMO-TB-037 (Garbino+ 2026) |
| Kıyafet atmosferi | **%100 O₂, ~4,3 psia**. Yüksek O₂ ortamında elektrik şoku ve kıvılcım **yangın riski** taşır (Apollo 1 dersleri; atmosfer özetinde yanıcılık sınırı %30 O₂ çizgisi). Kıyafet içi defibrilatör bu yüzden "konsept donanım" olarak etiketlenecek | OCHMO-TB-037, TB-003 |
| DCS tedavisi | EVA'yı güvenle ve hızla bitirip basınçlı ortama dönmek; hiperbarik %100 O₂ (16,4 psia) | OCHMO DCS, NASA risk |
| Kemik | FRAX kalça >%3 veya majör kırık >%20 ise uzmana sevk. **Karşı önlemler** BMD'yi kalça/omurgada görev öncesinin ≥%95'inde, femur boynunda ≥%90'ında tutmalı (V1 [4027]); dönüş sonrası hedef baz çizgiye dönüş (V1 [4028]) | OCHMO-TB-030 |
| En uzun EVA | 8 sa 56 dk (Voss ve Helms, 2001) | NASA EVA risk |

## 4. Gerçekte uzayda yapılabilen ölçümler (jüri sorusu: "Which measurements can be performed in space?")
- **CSA Bio-Monitor** (Aralık 2018'den beri ISS'te, akıllı tişört + kafa bandı): EKG/nabız, kan basıncı, solunum hızı ve hacmi, deri ısısı, SpO₂, aktivite; sürekli kayıt, verisi Dünya'ya iner. Ticari sürümü Hexoskin.
- **ARCHeR (Artemis II):** bilek aktigrafisi (aktivite, uyku, ışık) + davranış anketleri.
- **Standard Measures:** aktivite/ışık bilekliği, uyku raporu, sıvı/tükürük/dışkı/kan, **bilişsel testler**, denge/iç kulak testleri, tüm vücut kuvvet testi.
- **Tempus Pro** (Polaris Dawn): ticari telemedisin cihazı; yaşamsal bulgular, görüntüleme, gerçek zamanlıya yakın teşhis; mürettebat tıbbi görevlisi (CMO) senaryosu.
- **Ultrason:** kalp yapısı ve işlevi (Vascular Echo), uzaktan rehberlikli.
- **Fundoskop:** retina görüntüleme (SANS).
- Kan basıncı manşonları ve EKG kiti, Tıbbi Teşhis Paketi (NTRS).
- Radyasyon: kişisel dozimetreler + aktif alan monitörleri.

## 5. Devam eden HRP çalışmaları (bağlam ve atıf için)
Artemis II: ARCHeR, Immune Biomarkers, Artemis II Standard Measures · ISS: B-Complex (göz ve beyin), Brain Fluid Pressure, CIPHER, Simulating Manual Piloting, Spacecraft Occupant Protection, Spinal Fluid Biomarkers, Standard Measures, Thigh Cuff (sıvı kayması), Venous Haemostasis (pıhtı), Zero T2 (koşu bandısız egzersiz) · Geçmiş: Altered Immunity, Food Acceptability/Physiology, Omics Archive, Space Gardening, Spinal Health, Tempus Pro, Veggie Monitoring.

## 6. 17 HRP riski (risk ID → Human Research Roadmap)
Bağışıklık · Sensorimotor/vestibüler (i=88) · Kardiyovasküler (i=179; aritmi, pıhtı, hipotansiyon, kalp küreselleşmesi) · DCS · Mikrop-konak (i=80) · Hipoksi (i=85) · Beslenme (i=176) · EVA yaralanma (i=84) · Kardiyorespiratuvar/kas-iskelet fitness (i=180) · SANS (i=105; ISS astronotlarının ~%70'i, **NASA'nın 1 numaralı riski**) · Kemik (i=77) · Davranış/psikiyatri (i=99) · Takım (i=101) · Uyku (i=100; ISS'te günde 16 gün doğumu) · Sistem operasyonu/Dünya'dan bağımsızlık (i=175) · Dinamik yük yaralanması · Radyasyon kanseri (i=96).

## 7. CSA "Uzay vücudu nasıl etkiler" infografiği (vücut haritası içeriği)
- **Kan:** kemik iliği daha az hücre üretir → anemi; WBC ↓ → enfeksiyon, radyasyon duyarlılığı ↑
- **Radyasyon:** katarakt, DNA hasarı, kanser
- **Beyin:** oryantasyon kaybı, uzay tutması
- **Kalp ve damarlar:** damarlar sertleşir ve hızlı yaşlanır; insülin direnci → Tip 2 diyabet riski (**kan şekeri göstergesini destekler**)
- **Kas ve sinir:** kas kütlesi ↓, reflekslerde yavaşlama
- **Kemik:** ayda %1,5'e kadar kayıp (Dünya'da 50 yaş üstü yılda ~%1)
- Genel ifade: "mikrogravitenin etkileri yaşlanmayı ve hareketsiz yaşamı taklit eder"

## 8. Gerçek veri ile bağlantı (sınırlarıyla birlikte)
- **I4 CBC/CMP (OSD-569/575):** yalnızca uçuş öncesi (L-92/-44/-3) ve sonrası (R+1/45/82/194), 4 kişi, **3 günlük** görev. Kullanım: gerçek baz çizgileri, referans aralıkları, R+1 değişimleri. **Uçuş içi "dijital ikiz" olarak sunulmayacak.** Not: `hemoglobin_value_percent` sütunu yanlış etiketli; değerler (14,7, ref. 13,2–17,1) **g/dL**.
- **RadLab:** görev profiline göre gerçek ortalama emilen doz hızı (ISS DOSTEL medyan ~4,4, ortalama ~18 μGy/sa (SAA tepeleri dahil), günlük ~0,4–0,5 mGy; Mars yüzeyi 7,8; Mars transit ~16; Artemis I 18–22; 1 AU 27).
- **Fırtına tekrarı, doğrulandı:** ISS'te Mayıs 2024 fırtınası sakin haftadan (17–23 Nisan 2024) ayırt edilemiyor; iki haftada da günlük doz ~0,5 mGy, maksimumlar ~400–540 μGy/sa ve **SAA geçişlerinden** geliyor (manyetosfer koruması). Fırtına senaryosu bu yüzden **LEO dışı** ölçümlerle oynatılacak:
  - **Mars yüzeyi MSL-RAD, 2024-05-20 06:00 UTC: 275,9 μGy/sa** (uzun dönem ortalaması ~6,7'ye göre ≈40×; senaryonun tabanı olan 15–19 Mayıs medyanı 4,11'e göre ≈67×; çarpan tabana bağlıdır, ekranda taban yazılır). Yükseliş 05:00 saatlik kutusunda başlar; DONKI aynı saatte hızlı halo CME kaydeder (2024-05-20T05:36Z, kaynak "Güneş'in arka yüzü olduğu düşünülüyor", https://ccmc.gsfc.nasa.gov/DONKI/view/CME/31034/-1). Mars üssü senaryosu.
  - **ISS Eylül 2017 (TEPC 10 dk):** olay öncesi yüksek enlem kutularının (highLatFraction=1) ortalaması ~10 µGy/sa ve hiçbiri 17'yi geçmiyor; 11 Eylül'de yüksek enlem kutuları 408'e çıkıyor (≈39×). Günlük yüksek enlem ortalaması 9,7 → 83,1 µGy/sa. SAA kutuları her gün ~400–436'ya çıkar; bu yüzden tespit yalnız yüksek enlem kutularında yapılır. Eşik çarpanları ×3 (uyarı) ve ×10 (kritik) VARSAYIMDIR; eylemler OCHMO-TB-020.
  - **1 AU BPD, 2024-05-13 20:00: 567,9 μGy/sa** (ortalama ~27, ≈20×). Transit/Gateway senaryosu.
  - **Ay yörüngesi CRaTER, 2024-05-14 02:00: 2.757 μGy/sa** (detektör konfigürasyonu farklı, dikkatli kullanılacak).
  - DONKI SEP olayları (`donki_sep_may2024.json`) zaman çizelgesine eklenir.
- **ISS TEPC (data.nasa.gov → CDAWeb), doz eşdeğeri sorununu çözer:** ölçülen **Q = H/D = 2,18** (1–15 Eylül 2017). Günlük 0,44 mGy emilen, **0,96 mSv eşdeğer** (ICRP-60). **ISS fırtına tekrarı:** 11 Eylül 2017'de (10 Eylül X8.2 / GLE olayı ertesi) 0,83 mGy/gün, **1,71 mSv/gün (≈2×)**. ISS dozu mSv'ye bu gerçek Q ile çevrilir. LEO dışı için Q≈3,8 (transit) ve 3,05 (Mars yüzeyi) makalelerden, doğrulanacak.
- **Sebep doğrulaması (bölge ayrıştırması, TEPC konum verisiyle):** 11 Eylül 2017'de **yüksek enlem (|lat|>40°) dozu 0,16 → 1,02 μGy/dk (≈6×)**, SAA dozu değişmedi (~1,3), diğer bölgeler sabit (~0,05). Jeomanyetik kesme eşiğinin düşük olduğu kutuplarda artış, **güneş enerjik parçacık imzasıdır**. 12 Eylül'de 0,26'ya iner. **DONKI ile doğrulandı** (`donki_sep_sep2017.json`): `2017-09-10T16:25:00-SEP-001` GOES13 SEM/EPS **>100 MeV**, bağlı olaylar `2017-09-10T15:35:00-FLR-001` (X8.2) + `2017-09-10T16:09:00-CME-001`. ISS fırtına tekrarı artık NASA ölçümü + NASA olay kaydıyla iki kaynaktan doğrulanmış.
- ⚠️ **Birim uyarısı (advisor):** TEPC değeri *dedektördeki doz eşdeğeri* (ICRP-60), 600 mSv limiti ise *efektif doz*. Ekranda "kariyer bütçesi" gösterilirse "**dedektör vekil değerinden tahmin**" etiketi zorunlu; kesin "X gün" iddiası yapılmaz.
- **Mars 20 Mayıs 2024:** sebebi için NASA kaynağı bulunana kadar ifade "**RAD bu tepeyi kaydetti**" şeklinde olacak.

## 10. Veri kökeni etiketleri (ekrandaki her sayı için zorunlu)
`NASA ÖLÇÜMÜ` · `NASA STANDARDI` · `YAYIMLANMIŞ` · `SİMÜLE` · `VARSAYIM`. Simüle yaşamsal bulgular her zaman "SİMÜLE" etiketiyle görünür.

## 9. Rakip gerçekliği (düzeltme)
"Rakipler simüle veri kullanıyor" iddiası **yanlıştı**. AURORA RadLab + GOES + Isolation Forest kullanıyor; Crew-Health-Monitor OSD-569; AL-KASAV ISS radyasyonu; başka bir ekip OSD-575. Roller ve iletişim gecikmesi de bazılarında var. **Gerçek veri giriş biletidir, fark değildir.** Asıl farkımız:
1. Sesli ve eller serbest JARVIS (EVA'da elle giriş yapılamaz)
2. Kamera/ultrason görüntüsünün Claude vision ile yorumlanması
3. Deterministik güvenlik çekirdeği + LLM açıklama katmanı ayrımı
4. Gerçek fırtına tekrarları (LEO dışı) ve NASA-STD-3001 madde numaralarıyla eşikler
5. Uygulama kalitesi ve tasarım
