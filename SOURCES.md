# Kaynaklar ve Veri Setleri (Sources & Datasets)

Proje teslimi için kullanılan tüm veri ve referansların kaydı. Her yeni kaynak eklendiğinde buraya yazılır.
Erişim tarihi: 2026-11-14 (aksi belirtilmedikçe).

## A. İndirilen NASA verileri (`data/raw/`)

| Dosya | Kaynak | İçerik | Erişim |
|---|---|---|---|
| `i4_cbc.csv` | NASA OSDR **OSD-569** (LSDS-7), SpaceX Inspiration4 | Tam kan sayımı (CBC), 4 mürettebat (C001–C004) × 7 zaman noktası (L-92, L-44, L-3, R+1, R+45, R+82, R+194), referans aralıkları dahil | https://osdr.nasa.gov/bio/repo/data/studies/OSD-569 |
| `i4_cmp.csv` | NASA OSDR **OSD-575** (LSDS-8) | Kapsamlı metabolik panel (CMP): glukoz, elektrolitler, böbrek/karaciğer fonksiyonları vb. | https://osdr.nasa.gov/bio/repo/data/studies/OSD-575 |
| `i4_cardio.csv` | NASA OSDR **OSD-575** (LSDS-8) | Serum kardiyovasküler biyobelirteç paneli (Eve Technologies) | aynı |
| `iss_dostel_may2024.csv` | NASA OSDR **RadLab** API, ISS DOSTEL1/2 | 8–14 Mayıs 2024 (Gannon güneş fırtınası) emilen doz hızı, μGy/saat. n=11116, ort. 18.6, maks. 527 (SAA geçişleri dahil) | https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel |
| `bleo_dose_hourly.csv` | NASA OSDR **RadLab** API, LEO ötesi tüm aletler (saatlik ortalamaya indirgenmiş; ham hali 438 MB) | Artemis I (M-42, EAD, HERA), Mars yörünge ve yolculuk (ExoMars TGO Liulin-MO), Mars yüzeyi (MSL-RAD/Curiosity), Ay yörüngesi (LRO CRaTER), 1 AU heliosentrik (BPD) | https://visualization.osdr.nasa.gov/radlab/api/?trajectory=BLEO&absorbed_dose_rate&format=csv |
| `iss_dostel_quiet_apr2024.csv` | NASA OSDR **RadLab** API, ISS DOSTEL1/2 | 17–23 Nisan 2024 sakin hafta, fırtınayla kıyas için (sonuç: ISS'te fark yok, tepeler SAA) | aynı API, timestamp filtresiyle |
| `iss_tepc_sep2017.csv` | **data.nasa.gov**: "ISS Tissue-Equivalent Proportional Counter (TEPC), Dose Analyzer, 10 s Data" → NASA SPDF/CDAWeb HAPI `ISS_DOSANL_TEPC` (kapsam 2010-04-29 → 2018-04-11) | 1–15 Eylül 2017, 21.475 dakikalık kayıt: emilen doz (μGy/dk) + **ICRP-60 doz eşdeğeri (μSv/dk)** + ISS konumu. **Ölçülen Q = 2,18**; günlük 0,44 mGy / 0,96 mSv. **11 Eylül 2017 (X8.2 patlaması ertesi): 0,83 mGy/gün, 1,71 mSv/gün ≈ 2×** | https://data.nasa.gov/dataset/iss-tissue-equivalent-proportional-counter-tepc-dose-analyzer-10-s-data-61b24 · DOI https://doi.org/10.48322/0ba1-1764 · API https://cdaweb.gsfc.nasa.gov/hapi/data?id=ISS_DOSANL_TEPC |
| `donki_sep/cme/gst_may2024.json` | NASA CCMC **DONKI** API (api.nasa.gov) | 20 Nis–15 Haz 2024 güneş enerjik parçacık olayları (27), CME (246), jeomanyetik fırtınalar (6). FLR ucu erişim günü 404 verdi | https://api.nasa.gov/ (DONKI) |
| `goes_protons_3day.json` | NOAA SWPC GOES (NASA dışı, kamu) | Son 3 günün integral proton akısı, canlı uzay havası beslemesi | https://services.swpc.noaa.gov/json/goes/primary/integral-protons-3-day.json |

### Deep-space doz özeti (RadLab, ortalama emilen doz hızı)
| Ortam | Alet | Ortalama μGy/saat |
|---|---|---|
| Mars yüzeyi | MSL-RAD | 7.8 |
| Mars yörüngesi | Liulin-MO | ~15 |
| Mars yolculuğu | Liulin-MO cruise | ~16 |
| Ay geçişi (Artemis I) | M-42 / EAD / HERA | 18–22 |
| 1 AU gezegenler arası | BPD | 27 |
| Ay yörüngesi | CRaTER D1D2 | 59 (detektör konfigürasyonu farklı, doğrudan kıyas için dikkat) |
| ISS (LEO) | DOSTEL, Mayıs 2024 | 18.6 |

## B. İncelenen ama henüz indirilmeyen kaynaklar
- OSDR **OSD-656**: Inspiration4 idrar inflamasyon paneli
- OSDR **OSD-353**: insan plazma proteomu (uçuş ve yer analogları)
- OSDR **OSD-195 / OSD-942 / OSD-946**: yatak istirahati (bed rest, mikrogravite analoğu) kas çalışmaları
- OSDR **OSD-140**: Mars-520 izolasyon simülasyonu
- **SOMA**, Space Omics and Medical Atlas (Weill Cornell): I4, Polaris Dawn, Axiom, NASA Twins Study, https://soma.weill.cornell.edu
- **NASA LSDA / NLSP Standard Measures**: HERA/CHAPEA analog fizyoloji verisi. Erişim için başvuru gerekiyor, hackathon süresine uygun değil. https://nlsp.nasa.gov/explore/home/lsda_sm
- NASA Spaceflight Standard Measures: https://www.nasa.gov/humans-in-space/spaceflight-standard-measures-characterizing-how-humans-adapt-in-space

## C. Rakip ve önceki projeler (fark yaratmak için incelendi)
- AURORA (2026): https://github.com/fabriciojunio/aurora-astronaut-health (RadLab + GOES, Isolation Forest, offline PWA, şifreleme)
- Crew-Health-Monitor (2026): https://github.com/AdityaK0804/Crew-Health-Monitor (OSD-569 referans aralıkları, 3D vücut, kural tabanlı, simüle veri)
- VITA: https://github.com/Nav33dCodes/vita-astronaut-health-monitor
- AUREON: https://github.com/adityabiswas108/AUREON
- AL-KASAV ASTROHEALTH: https://github.com/meherpurtv71-sketch/AL-KASAV-ASTROHEALTH
- AURA-EIMO (Peru): https://github.com/quirocode/aura-space-health-monitor (offline PWA, 60 FPS EKG, POCUS ultrason, 30/60/90 günlük tahmin ikizi, NASA-STD-3001 Vol.2 ekran standardı)
- Astro Sağlık / AstroPulse (Türkiye, tek kişi): https://github.com/cemyurtlak/astro-saglik (3B web oyunu, simüle veri)
- COSMOCare: https://github.com/omkargurav0216-code/COSMOCare
- 2014 Astronaut Health Monitoring System: https://2014.spaceappschallenge.org/project/astronaut-health-monitoring-system/
- Fit as a MOoSE (2014/2015): https://2015.spaceappschallenge.org/challenge/fit-moose-metabolic-observations-space-explorers/

## D. Bilimsel ve teknik referanslar
- Inspiration4 OSDR veri erişim makalesi: https://pmc.ncbi.nlm.nih.gov/articles/PMC11094041
- npj Microgravity, I4 veri kaynağı: https://www.nature.com/articles/s41526-024-00393-5
- OSDR SSS: https://science.nasa.gov/reference/osdr-faq
- RadLab Data API dokümantasyonu: https://visualization.osdr.nasa.gov/radlab/gui/data-api/

## D1. RESMİ YARIŞMA KAYNAKLARI (Resources sekmesi, doğrulandı; metin: docs/challenge.md)
- Yarışma: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/
- NASA: 5 Hazards of Human Spaceflight, https://www.nasa.gov/hrp/hazards/
  - Alt sayfalar: hazard-space-radiation, hazard-isolation-and-confinement, hazard-distance-from-earth, hazard-gravity-fields, hazard-hostile-closed-environments (hepsi https://www.nasa.gov/hrp/<ad>/)
- NASA: Risks of Human Spaceflight, https://www.nasa.gov/hrp/risks/ (17 risk; incelenenler: cardiovascular, EVA, DCS, hypoxia, SANS, sleep, behavioral, immune, nutrition, bone, fitness, radiation cancers, sensorimotor, host-microorganism, teamwork, systems-ops; https://www.nasa.gov/reference/risk-of-...)
- NASA: Ongoing HRP Research, https://www.nasa.gov/hrp/ongoing-hrp-research/ (ARCHeR, Standard Measures, Tempus Pro ve diğerleri incelendi)
- CSA: Monitoring Radiation for Astronaut Health, https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
- CSA: Why Do We Conduct Science Experiments in Space?, https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp
  - Bağlantılı CSA infografiği "How does space affect the human body?": https://www.asc-csa.gc.ca/eng/multimedia/search/image/8056

## D1b. Resmi kaynaklardan dallanan, kullanılan NASA belgeleri
- NASA, The Human Body in Space: https://www.nasa.gov/humans-in-space/the-human-body-in-space/
- NASA SRAG, radyasyon izleme: https://www.nasa.gov/directorates/esdmd/hhp/space-radiation/
- CSA Bio-Monitor: https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp
- OCHMO teknik özetleri (NASA-STD-3001 eşikleri; PDF ve metin `docs/refs/` altında):
  - Radyasyon: https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf
  - CO₂: https://nasa.gov/wp-content/uploads/2023/03/co2-technical-brief-ochmo.pdf
  - Habitable Atmosphere (hipoksi): https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-003-habitable-atmosphere.pdf
  - DCS: https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-037-decompression-sickness.pdf
  - Kemik kaybı: https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-030-bone-loss.pdf
  - ECLSS: https://www.nasa.gov/wp-content/uploads/2023/07/eclss-technical-brief-ochmo.pdf
- Human Research Roadmap kanıt raporları (henüz indirilmedi): Cardio 2022, Fracture, Renal, BMed (sirkadiyen), Team, Cancer, Degen; https://humanresearchroadmap.nasa.gov/evidence/
- Klinik karar destek, NTRS: https://ntrs.nasa.gov/archive/nasa/casi.ntrs.nasa.gov/20200000567.pdf

## D2. Rakiplerin kullandığı kaynaklar
- NASA HRP, insan uzay uçuşunun 5 tehlikesi: https://www.nasa.gov/hrp/hazards/
- NASA HRP riskleri: https://www.nasa.gov/hrp/risks/ (kemik kaybı ayda %1–1,5; ISS astronotlarının ~%70'inde göz arkasında ödem, SANS)
- NASA HRP devam eden araştırmalar: https://www.nasa.gov/hrp/ongoing-hrp-research/ (ARCHeR: Artemis II'de aktivite, uyku ve ışık izleme)
- CSA Bio-Monitor akıllı tişört (EKG/nabız, kan basıncı, solunum, SpO₂, deri ısısı, aktivite): https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp
- CSA, radyasyon izleme (ISS'te dozun ~%30'u nötron): https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
- CSA, neden uzayda bilim: https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp
- NTRS, ISS kan basıncı/EKG kiti: https://ntrs.nasa.gov/api/citations/20190000238
- NTRS, Tıbbi Teşhis Paketi: https://ntrs.nasa.gov/api/citations/20110011351
- NTRS, uyku/Actiwatch: https://ntrs.nasa.gov/api/citations/20090014820
- NTRS, iletişim gecikmesi ve otonom tıp: https://ntrs.nasa.gov/citations/20240004905
- NASA Open Data: https://data.nasa.gov/ · NASA API: https://api.nasa.gov/

## D2b. data.nasa.gov ve Earthdata taraması (2026-11-14)
data.nasa.gov bu bilgisayardan curl ile bağlantıyı sıfırlıyor, WebFetch ile erişildi. Earthdata CMR API'si çalışıyor.
**Kullanılacak / adaylar:**
- ✅ ISS TEPC (yukarıda, indirildi)
- 🟡 **NASA 3D Models: Astronaut** (NASA-316, 3DS, 6.381 poligon, lisans belirtilmemiş): https://data.nasa.gov/dataset/nasa-3d-models-astronaut, dosya http://nasa3d.arc.nasa.gov/shared_assets/models/astronaut/astronaut1.zip. Ayrıca *Helmet*, *ISS* modelleri. Not: tıklanabilir organlar için anatomik model gerekir (ör. BodyParts3D, CC BY 4.0); NASA logolu doku kullanılmamalı (teslim kuralı).
- 🟡 **Gateway to Astronaut Photography of Earth** (data.nasa.gov) = Earthdata `JSC_CEO_ESRS_ASTRONAUT_PHOTOGRAPHY` (Crew Earth Observations). Kullanım fikri: davranışsal sağlık. NASA "pencereler monotonluğu ve kapatılmışlık hissini azaltır" diyor; "Earth Window" rahatlama modülü. https://eol.jsc.nasa.gov/
- 🟡 Earthdata `ACE_SEPICA_LEVEL2`: ACE güneş enerjik parçacık verisi (DONKI'ye ek uzay havası kaynağı)
- 🟡 data.nasa.gov **NASA Life Sciences Portal (NLSP)**: `nasa-life-sciences-portal-nlsp`
- 🟡 data.nasa.gov **Space Mission Human Reliability Analysis (HRA) Project**
- ⚪ Mars-520 epigenetik, bed rest kas transkriptomu, plazma proteomu: omik veri, izleme yazılımına doğrudan girdi değil
- ⚪ Earthdata genel olarak Dünya bilimi; "astronaut / human health / radiation dose" aramalarında astronot sağlığına doğrudan veri yok (yalnızca ARMAS uçak radyasyonu, OMI UV vb.)

## D2c. 3B anatomi (NASA dışı, aday)
- anatomi-simulatoru (Dr. Murat Altun), kod MIT, veri CC BY-SA 4.0: https://github.com/DrMuratAltun/anatomi-simulatoru
  - Kaynakları: BodyParts3D (DBCLS, CC BY-SA 2.1 JP) https://lifesciencedb.jp/bp3d/ · Z-Anatomy (CC BY-SA 4.0) https://www.z-anatomy.com/
- NASA 3D Models: Astronaut (NASA-316): https://data.nasa.gov/dataset/nasa-3d-models-astronaut

## D2d. Kamera yorgunluk modülü (NASA dışı)
- MediaPipe Face Landmarker (Google, Apache-2.0), tarayıcıda/cihazda: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker · model: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task (yerelde `frontend/public/models/`)
- FHWA Tech Brief FHWA-MCRT-98-006 (Ekim 1998), "PERCLOS: A Valid Psychophysiological Measure of Alertness As Assessed by Psychomotor Vigilance": https://rosap.ntl.bts.gov/view/dot/113 · TRID: https://trid.trb.org/view/498744 (PERCLOS = göz kapaklarının ≥%80 kapalı olduğu zaman yüzdesi; PVT ile doğrulanmış). Yazar atfı doğrulanamadı → yazar adı verilmedi. Eşikler (%8/%15) VARSAYIM.
- Değerlendirilip KULLANILMAYAN: github.com/NkL-M/Real-Time-Facial-Emotion-Recognition (lisans yok).

## D3. Doğrulanacak bilimsel makaleler (kalite faktörü Q)
- Zeitlin et al. 2013, *Science* 340:1080, "Measurements of energetic particle radiation in transit to Mars on the Mars Science Laboratory" (transit Q≈3,8)
- Hassler et al. 2014, *Science* 343:1244797, "Mars' surface radiation environment measured with the Mars Science Laboratory's Curiosity rover" (yüzey Q≈3,05)

## E. Yapılacak: eklenecek referanslar
- Resmi yarışma sayfası: SSL hatası nedeniyle kullanıcı ekran görüntüsüyle iletti, `docs/challenge.md` içinde. (TAMAM)
- Teslim kuralı (rakip README'sinden): "Project Demo" en fazla 7 slayt, İngilizce, herkese açık link (Drive/OneDrive) olarak proje sayfasına eklenir.
- NASA-STD-3001 Vol.1 (mürettebat sağlığı standartları, radyasyon kariyer limiti 600 mSv)
- NASA Human Research Program, Human Research Roadmap (5 tehlike: radyasyon, izolasyon, uzaklık, yerçekimi, kapalı ortam)
- Resmi yarışma sayfası metni (spaceappschallenge.org 2026), WebFetch SSL hatası verdi

## Senaryo kaynakları (2026-11-14 gece)
- **DONKI CME 2024-05-20T05:36Z** (hızlı halo CME; "kaynağın Güneş'in arka yüzü olduğu düşünülüyor"; aynı saatte AR 3683 C6.7 parlaması kaynak DEĞİL): https://ccmc.gsfc.nasa.gov/DONKI/view/CME/31034/-1 — Mars RAD doz artışı (05:00 saatlik kutu) ile aynı saat. Yerel kopya `data/raw/donki_cme_may2024.json`.
- **DONKI Eylül 2017**: FLR 2017-09-10T15:35 (X8.2), CME 16:09, SEP 16:25 (GOES-13 >100 MeV) — `data/raw/donki_sep_sep2017.json` ve storms.json olayları.
- **OCHMO-TB-037 DCS**: Tip I/II sınıflaması, tedavi "EVA'yı güvenle ve hızla sonlandır, basınçlı ortama dön; ≥16,4 psia belirtileri hafifletebilir": https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-037-decompression-sickness.pdf
- **OCHMO-TB-004 CO₂**: belirti aralıkları (2,8–4,5 mmHg baş ağrısı; >4,5 yorgunluk/bulantı), V2 [11035]/[11036] kıyafet ekranı ve alarmı. Kıyafet PICO₂ limitleri V2 [11039] Tablo 35'tedir ve OKUNMADI (ekranda yazılır).
- **Inspiration4 referans aralıkları** kişiye (cinsiyete) ve örneğe göre değişir (OSD-569/575 CSV'lerinde örnek başına range_min/max) → halkalar kişinin kendi aralığına göre.

## Müdahale protokolleri (2026-11-14 gece)
- **NASA JSC-48031 Medical Checklist, Generic Rev K PCN-4 (Space Shuttle, 2008)** — kamuya açık kopya: https://ibiblio.org/apollo/Shuttle/Medical%20Checklist/Medical%20Checklist%20Rev%20K%20PCN-4.pdf (yerel: `docs/refs/shuttle_med_checklist_revK.pdf/.txt`). Kullanılan sayfalar (pdftotext -layout ile tek tek kontrol): Breathing Difficulty 1-3 (PDF s.25), Chest Pain 1-36/37 (s.58–60), Shock 1-44/45 (s.66–67), DCS Treatment/Aftercare 3-8 (s.84), "*Contact Surgeon before giving any medication marked w/asterisk" 6-2 (s.172), Aspirin WARNING 6-3 (s.173). Dozlar 2008 Shuttle kit birimleridir; güncel ISS kontrol listesi kamuya açık değildir.
- **NASA OCHMO-TB-033 Spaceflight Experience & Medical Care (Rev C)**: https://www.nasa.gov/wp-content/uploads/2023/07/ochmo-tb-033-spaceflight-experience-medical-care-rev-c.pdf (yerel metin `docs/refs/ochmo_tb033_medical_care.txt`; henüz ayrıntılı okunmadı).
- **ADA hipoglisemi (15-15 kuralı)**: https://professional.diabetes.org/sites/dpro/files/2023-12/hypoglycemia_in_diabetes.pdf ; **CDC** (<55 mg/dL ciddi): https://www.cdc.gov/diabetes/treatment/treatment-low-blood-sugar-hypoglycemia.html — arama alıntısıyla doğrulandı.
- **AHA hipertansif kriz (>180/120, belirtiler)**: https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/hypertensive-crisis-when-you-should-call-911-for-high-blood-pressure — site bot korumalı, arama alıntısıyla doğrulandı; tekrar ölçüm bekleme süresi (1 vs 5 dk) çelişkili olduğu için sayı yazılmadı.
- **AHA/Red Cross ilk yardım, şok pozisyonu** (sırtüstü Sınıf 2a; ayak kaldırma Sınıf 2b; ağrı yaparsa Sınıf 3): https://cpr.heart.org/en/resuscitation-science/first-aid-guidelines/first-aid — arama alıntısı kısmi; kısmi yerçekimine uygulanması VARSAYIM.
- Okunmadığı için KULLANILMAYAN: ISS Medical Emergency Manual 2016 (governmentattic, erişim engelli), WikEM ISS ilaç listesi (ikincil kaynak), npj Microgravity 2024 ISS formüler analizi.
- **NASA-STD-3001 Vol 2 Rev B (2019-09-09)**: https://standards.nasa.gov/sites/default/files/standards/NASA/C/Historical/nasa-std-3001_vol_2_rev_b.pdf (yerel `docs/refs/nasa_std_3001_v2_revB.pdf/.txt`). [V2 11039] Tablo 23 kıyafet PICO₂ süre limitleri → EVA CO₂ senaryosu bu tabloya göre.
- **ADA hypoglycemia PDF** indirildi: `docs/refs/ada_hypoglycemia.pdf/.txt` ("Have 15 grams of fast-acting carbohydrates, recheck in 15 minutes" doğrulandı).
- JSC-48031 ek sayfalar (layout ile kontrol): Severe allergic 1-29/30 (PDF 51–52), Seizures 1-42 (64), Altitude sickness 2-4 (72), Nausea/vomiting 4-39 (139), Pain relief 5-3 (147), Insomnia 5-13 (157), Medication side effects + general WARNING 6-2 (172: "*Contact Surgeon before giving any medication marked w/asterisk. In emergency or when orbiter LOS, begin appropriate treatment; call Surgeon as soon as possible").
- **Diaz et al. 2024, npj Microgravity 10:76** "Expiration analysis of the ISS formulary" (DOI 10.1038/s41526-024-00414-3) — bulundu, henüz okunmadı.
