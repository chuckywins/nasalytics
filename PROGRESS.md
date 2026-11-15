# İlerleme Günlüğü

> Not: 15:00 öncesi saatler tahminidir ve yaklaşık 1–2 saat ileri kaymış olabilir. 15:31 sonrası saatler `date` komutundan alınır.

Her adım buraya kısa notla eklenir (en yeni en altta).

## 2026-11-14
- **13:10** Araştırma: rakip projeler incelendi; çoğu simüle veri ve kural tabanlı çalışıyor. Ayrıntılar SOURCES.md §C.
- **13:25** Gerçek veri indirildi (login gerekmedi): I4 CBC/CMP/kardiyo, RadLab ISS ve derin uzay dozu, DONKI, GOES. Bkz. SOURCES.md §A.
- **13:35** Kullanıcı vizyonu alındı: simüle yaşamsal veriler, gerçek radyasyon telemetrisi, kıyafet içi şok, sesli JARVIS (Claude API, 500$ kredi), üç ekran (astronot / mürettebat / görev kontrol). Plan PLAN.md'ye yazıldı.
- **13:45** Resmi yarışma sayfası (.../2026/challenges/health-monitoring-software) SSL nedeniyle çekilemedi (curl, WebFetch ve web arşivi denendi). Kullanıcıdan kaydetmesi istendi. Rakip README'lerinden resmi kaynak adayları SOURCES.md §D2'ye eklendi.
- **14:10** Resmi metin ekran görüntülerinden `docs/challenge.md`'ye yazıldı. Resources sekmesindeki 5 kaynak ve tüm alt sayfaları (5 tehlike, 16 risk, ARCHeR, Standard Measures, Tempus Pro, CSA Bio-Monitor, CSA infografiği) tarandı. 6 OCHMO teknik özeti (NASA-STD-3001 eşikleri) `docs/refs/` altına indirilip metne çevrildi. Bilgi bankası: `docs/research_notes.md` (jüri kontrol listesi + eşik tablosu).
- **Önemli bulgu:** Yarışmanın merkezi "astronotun KENDİ sağlığını değerlendirdiği görsel araç". JARVIS, acil durum ve 3 ekran fikri bunun üstüne kurulacak; tıklanabilir vücut, rutin ölçüm hatırlatıcıları, oyunlaştırma, trend grafikleri, renk kodu, açıklama kartları, kamera/ultrason girişi ve çoklu ortam (araç/istasyon/rover/üs) mutlaka olmalı.
- **14:30** İlk advisor (Fable) danışması. Uygulananlar:
  - Eşik tablosu bağlamında doğrulandı. Düzeltmeler: kariyer limiti V1[4030], SPE V1[4031], habitat CO₂ V2[6004]; "2 saat" = EVA'nın 2 saatte sonlandırılması; 0,5 mSv/gün = yüzey görevi analizi; kemik %95/%90 = görev içi karşı önlem hedefi; DCS 60–240 dk referansı belirsiz.
  - I4 `hemoglobin_value_percent` aslında g/dL.
  - **ISS Mayıs 2024 fırtınası sakin haftadan (Nisan 17–23) ayırt edilemiyor**, tepeler SAA kaynaklı (`iss_dostel_quiet_apr2024.csv` indirildi). Fırtına tekrarı için LEO dışı veri seçildi: Mars yüzeyi 20 Mayıs 2024 275,9 μGy/sa (≈40×), 1 AU 13 Mayıs 567,9 (≈20×).
  - "Rakipler simüle veri kullanıyor" iddiası düzeltildi: gerçek veri giriş bileti; fark JARVIS (ses), vision, deterministik güvenlik çekirdeği, gerçek fırtına tekrarı, kalite.
  - Kıyafet içi şok %100 O₂ ortamında yangın riski taşıdığı için "concept hardware" olarak etiketlenecek.
  - PLAN.md v2: 12 maddelik jüri omurgası + fark katmanı + ince dilim önce + son 3–4 saat sunuma.
  - `git init` yapıldı, .gitignore (.env, 18 MB CSV). Commit henüz yok.
- **15:15** Teslim formu kuralları `docs/submission_rules.md`'ye yazıldı. data.nasa.gov (WebFetch ile) ve Earthdata CMR tarandı. **ISS TEPC** bulundu ve indirildi: ölçülen Q=2,18; 11 Eylül 2017 SEP'i bölge ayrıştırmasıyla doğrulandı (yüksek enlemde 6×, SAA sabit). NASA 3D Astronaut modeli, Astronaut Photography of Earth ve ACE SEPICA aday olarak kaydedildi. Earthdata'da doğrudan mürettebat sağlığı verisi yok.
- **15:20** Model dokümanı okundu: Haiku 5.5 (en hızlı, $0,10/$0,50) ses için, Sonnet 5.5 kamera/ultrason için. **Mythos 5.2 = Fable 5.2 ile aynı model** (yalnızca doğrulanmış kurumlar için), teknik avantaj yok. 2. advisor danışması: tarayıcıda TS motoru + statik site, ince FastAPI proxy, push-to-talk, ilk cümleyi hemen seslendirme, şablonla hızlı yol, köken etiketleri.
- **15:40** NASA API anahtarı `.env`'ye eklendi. DONKI ile 10 Eylül 2017 SEP'i (GOES >100 MeV, X8.2 FLR + CME) doğrulandı. 3B model rehberi `docs/3d_model_guide.md` yazıldı; kullanıcı önerisi anatomi-simulatoru repo'su incelendi, 1. aday (organlar + iskelet GLB, CC BY-SA 4.0).
- **15:05** Sivas yerel jüri kriterleri (Etki, Yaratıcılık, Bilimsel Geçerlilik, Uygunluk, Sunum) `docs/submission_rules.md` ve PLAN.md'ye işlendi. 3. advisor danışması: "soruyu cevaplıyor, koda geç, önce 3B'yi de-risk et".
- **15:12** 3B de-risk BAŞARILI: anatomi-simulatoru GLB'leri organ başına isimli düğüm içeriyor. Kalp `dolasim.glb`, beyin/göz/iç kulak `sinir.glb`, akciğer/böbrek/pankreas `ic-organlar.glb`, iskelet, kas. `frontend/scripts/build_body.mjs` gerekli 585 yapıyı seçip `public/models/body.glb`'ye birleştiriyor (6,3 MB, 329k üçgen, extras.region etiketli). Kaynak repo klonu scratchpad'de (yeniden derlemek için tekrar klonlanır).
- **15:18** Frontend iskeleti: Vite 6 + React 19 + TS + three 0.170 + R3F 9.1.2 + drei 10.0.7 + zustand. Veri hattı `tools/build_data.py` → `frontend/src/data/{i4_clinical,environments,storms}.json` (kökenli). Not: BPD 1 AU medyanı 6,86 μGy/sa (ortalama 27 fırtınalarla şişkin; medyan kullanılıyor).
- **15:22** **Dilim 0 çalışıyor** (localhost:5180, 5173 başka uygulamada): 10 gösterge kartı (renk kodu + köken etiketi), ölçüm girişi, 3B tıklanabilir vücut (bölge durum rengi), bölge paneli (işlev, uzay etkisi, RIDGE, kaynak), trend grafiği + eşik kaynağı, TR/EN. Çekirdek: `src/engine/{types,indicators,regions}.ts`, `src/store.ts`, `src/i18n.ts`.
- Ortam: Node 24.21, Python 3.12.6; fastapi, uvicorn, anthropic, numpy ve pandas kurulu.
- **15:31** Tasarım kararı Fable'dan: "Dark cockpit + tek holografik kahraman" (`docs/design_system.md`). Girdiler: dataviz skill + ui-ux-pro-max veri tabanı (kodu çalıştırılmadı, CSV'ler okundu). `motion` 12 (Framer Motion) React 19 uyumlu.
- **15:41** Tasarım v1 uygulandı: cam organlar + fresnel kenar ışığı, iskelet hayaleti, durum rengi yalnızca sapmada (kritikte nabız), bölge öncelikli tıklama (organ > kas > kemik), nötr köken etiketleri (glif). **Sorun ve çözüm:** React 19.3 + R3F 9.1.2 uyumsuz → **R3F 9.8.2 + drei 10.7.9**'a yükseltildi. Headless Chrome ekran görüntüsü kararsız (bazen canvas boyutsuz); en az 2 çekim al. Eski Vite süreçleri TaskStop sonrası yaşayabiliyor: `netstat -ano | grep :5180` + taskkill.
- **16:04** **HUD kabuğu v2** (kullanıcının hayal ekranı + 4. advisor danışması): üst bar (ortam seçimi, görev günü, Dünya gecikmesi, gerçek doz hızı, kümülatif doz), 8 satırlık kompakt yaşamsal bulgular (KB birleşik), sentetik EKG (nabza bağlı, SİMÜLE), ölçüm girişi (glukozda açlık/tokluk), 3B vücut + katman anahtarları + 4 organ etiketi (DOM izdüşümü), sağlık değerlendirmesi (deterministik öneri + eskalasyon KENDİN/CMO/UÇUŞ CERRAHI + kaynak, `engine/guidance.ts`), organ paneli, kabin atmosferi (NASA-STD 6004/6006), görev zaman çizelgesi + kümülatif doz/600 mSv + kemik kaybı tahmini, trend (sabit klinik aralık + eşik bantları). Düzeltilen bilimsel hatalar: girilen değer SİMÜLE diye etiketlenmesi (stream/spot ayrımı), glukoz bağlamı, ateşin beyne bağlanması. Fontlar: Chakra Petch + JetBrains Mono (self-host). 1536×700 en kötü durum TR/EN test edildi (`?test=worst&lang=en`).
- **16:34** Commit 1 (`2f95c03`). Kullanıcı istekleri PLAN.md backlog'una yazıldı. 5. advisor: AI her yerde, eskalasyon = max(kural, AI), yüz-duygu analizi kesildi → reaksiyon testi + göz kırpma; rPPG alarma girmez; aktivite durumu.
- **16:34** **AI katmanı çalışıyor:** `backend/server.py` (FastAPI, 127.0.0.1:**8790**; 8787 kullanıcının Express'inde). /api/assess = Sonnet 5.5 + effort low (13,6→~6–9 sn; zorunlu tool_choice desteklenmiyor → auto + talimat), /api/jarvis = Haiku 5.5 + thinking disabled + effort low (TTFT ~1,1 sn; thinking açıkken tüm bütçeyi düşünmeye harcıyordu). Bilgi bankası prompt cache (8.880 token okuma). IP hız sınırı + günlük 40$ tavan. Frontend: `src/ai.ts` (snapshot, debounce'lu değerlendirme, SSE + cümle cümle TTS), `src/audio.ts` (Web Audio 3+2 alarm, speechSynthesis), `components/Ai.tsx` (AI kartı, oturum kapısı, kritik alarm + ONAYLA, aktivite seçici, JARVIS bas-konuş/Boşluk + yazı yedeği). Aktiviteye duyarlı nabız/solunum bantları (AHA hedef nabız). Vite proxy /api → 8790. Döngüsel import TDZ çökmesi düzeltildi.
- **17:02** **Info ikonları + link yerine adımlar:** `engine/measurement.ts` (her gösterge/alan için: uzayda nasıl ölçülür / prototipte nasıl alınır / neden önemli + kaynak), `components/Info.tsx` (portal'lı bilgi kutusu: hover/odak/tıkla-sabitle; kompakt kaynak etiketleri; öneriyi ≤3 numaralı adıma bölme). Yerleşim: 8 yaşamsal satır, EKG, üst bar doz, kabin göstergeleri, kümülatif doz, kemik kaybı. **Kaynak denetimi:** Bio-Monitor deri ısısı ölçer (çekirdek değil); Bio-Analyzer sayfasında glukoz yok (öyle yazıldı); rakiplerin atıf yaptığı NTRS 20190000238 = Astroskin/HERA (ISS kiti değil), 20110011351 = CHeCS stajı (cihaz listesi yok), 20090014820 = sonuçsuz özet → kullanılmadı.
- **17:04** **Kamera + AI görme:** `/api/vision` (Sonnet 5.5, effort low, şemalı okuma; sentetik glukometre testinde 112 mg/dL doğru, 2,6 sn). `components/Camera.tsx`: cihaz ekranı modu (okuma → astronot onayı → köken KAMERA+AI) ve ultrason modu (yalnız tarafsız gözlem, teşhis yok), dosya yükleme yedeği, gizlilik notu. Backend artık --reload olmadan çalışıyor (WatchFiles değişikliği kaçırdı); backend değişince elle yeniden başlat.
- **17:23** Kullanıcı isteğiyle kamera butonu arayüzden kaldırıldı (Camera.tsx ve /api/vision duruyor, ileride farklı şekilde eklenecek).
- **17:47** **Günlük check-in (backlog 1–4):** `src/checkin.ts` (7 rutin görev, ölçümle otomatik tamamlanma, XP/seri/5 rozet, yalnız gerçek tamamlamalar, localStorage), `components/Checkin.tsx` (RoutinePanel: alt orta panel sekmesi "Günlük rutin | Görev"; ReactionTest: 10 denemelik PVT tarzı, medyan/gecikme >500 ms/erken tepki, kişisel baz çizgi, eşikler VARSAYIM; VoiceLog: Web Speech transkript + mikrofon RMS ile duraklama oranı, kelime/dk → `/api/voicelog` (Sonnet, ~4,7 sn, her ipucu transkript alıntılı); RoutineReminder: 20 sn sonra, sonra 3 dk'da bir 6 sn'lik bildirim). AI snapshot'ına check-in sonuçları eklendi. Bilgi kartları: routine/reaction/voice.
- **17:57** **Hata düzeltmesi:** reaksiyon testi hiç "ŞİMDİ!" göstermiyordu (klavye efektinin temizliği her render'da bekleyen zamanlayıcıyı iptal ediyordu). Ayrı efektlere bölündü; 8 deneme, 1–3 sn bekleme (~20 sn). `?rtSelfTest` öz-test modu ile headless doğrulandı (8/8, medyan 250 ms). Kullanıcı kararı: kamera geri gelirse MediaPipe.
- **18:07** **JARVIS → VEGA** (kullanıcı seçimi; Marvel telif riski). UI, bileşen/fonksiyon adları, CSS, `/api/vega`, sistem istemi değişti.
- **18:07** **Kamera yorgunluk modülü (MediaPipe, cihazda):** `src/fatigue.ts` (FatigueAnalyzer: göz kırpma/dk, PERCLOS 60 sn pencere, ≥1,5 sn göz kapanması, esneme, görünen ifade; 20 sn kalibrasyon; eşikler VARSAYIM), `components/FatigueCam.tsx` (orta panel sol alt; sayfa açılınca otomatik başlar, kapat/aç tercihi localStorage; GPU→CPU yedek), WASM `public/mediapipe/`, model `public/models/face_landmarker.task` (3,8 MB). Değerlendirme paneline yorgunluk ipucu kartı, AI snapshot'ına kamera verisi. Headless sahte kamerayla analiz döngüsü doğrulandı (yüz yok → "Yüz algılanmadı"). Gerçek yüz testi kullanıcıda.
- **18:14** Rutin hatırlatma artık **ortada açılan pencere** (bekleyen görevler + doğrudan başlat butonları + "5 dk sonra hatırlat"); ilk 30 sn, sonra 5 dk'da bir; kritik alarm veya başka pencere açıkken gösterilmez. Test pencereleri genel store'a taşındı (`CheckinModals`). Esneme eşiği gevşetildi (çene > 0,35, ≥0,8 sn, < 0,2 ile biter; ilk sürüm gerçek esnemeyi kaçırdı). `?fcDebug` ham göz/çene değerlerini gösterir. Kamera "Kapat" → izler durur, döngü iptal, model kapanır (arka planda izleme yok).
- **18:15** **VEGA kamerayı görebiliyor:** VEGA çubuğunda "◉ Görüntü" anahtarı → açıkken bir sonraki soruyla birlikte yorgunluk kamerasından TEK KARE Haiku 5.5'e gider (TTFT ~4 sn). Yanıtta "✦ AI · ◉" işareti. Kamera metrikleri + görünen ifade her soruda snapshot'ta. Sistem istemine kural motorunun klinik eşikleri eklendi (ADA/AHA/CDC/AASM/NASA), VEGA ile kural motoru aynı sayılarla konuşuyor.

## 2026-11-14 19:52 — VEGA sesli değer girişi + gerçekçi ses altyapısı
- VEGA `update_reading` aracı: "nabzımı 150 yap", "açlık şekerimi 50 olarak güncelle", "tansiyonum 145/95 kaydet" → USER_INPUT kaydı; istemci fizyolojik aralığı doğrular, kural motoru anında değerlendirir (alarm). Sorular ("150 olsa tehlikeli mi?") kayıt yapmaz — test edildi.
- Model yalnızca aracı çağırırsa ikinci kısa tur ile sözlü onay üretilir (test: 6/6 onaylı).
- /api/tts: Google Gemini TTS (cevap başına tek istek, sakin/acil ton). GEMINI_API_KEY yoksa tarayıcı sesine düşer. Alarm anonsları her zaman tarayıcı sesi (çevrimdışı).

## 2026-11-14 20:22 — VEGA sesi: Azure nöral TTS
- /api/tts sırası: Azure Speech (tr-TR-AhmetNeural / en-US-AndrewNeural, F0 ücretsiz katman) → Gemini TTS → tarayıcı sesi.
- İstemci cümle cümle boru hattı: her cümlenin sesi hemen istenir, sırayla çalınır. Ölçülen: cümle başına 0,5–1,0 sn (eastus).
- Değer kaydedilen cevaplarda hafif hızlı (acil) ton. Alarm anonsları tarayıcı sesi (çevrimdışı güvence).

## 2026-11-14 20:32 — VEGA güncelleme hatası düzeltildi + Gemini çoklu anahtar
- Hata: Vite izleyicisi ai.ts değişikliğini kaçırmış, tarayıcı eski kodu çalıştırıyordu (eylem olayı "undefined" metin olarak eklendi). Vite yeniden başlatıldı.
- Model bazen "kaydettim" deyip aracı çağırmıyordu → güncelleme niyetli mesajlarda araç seçimi zorunlu (update_reading | no_update); onay ayrı turda, iç anlatım konuşulmaz.
- Uçtan uca tarayıcı testi (Playwright, headless Chrome): nabız 150 → taşikardi alarmı; açlık şekeri 50 → ciddi hipoglisemi; tansiyon 145/95 → evre 2; uyku 5 sa → kısa uyku; "kaydetme sadece sor" → kayıt yok.
- TTS sırası: Gemini (GEMINI_API_KEYS, anahtar × model döngüsü, kota dolanı atlanır) → Azure → tarayıcı. Cevabın tamamı tek istekte; ton metinleri: sakin/endişeli.

## 2026-11-14 20:52 — Ses gecikmesi + sakin acil ton + sessiz güncelleme + Gemini alarm sesi
- Acil durum tonu: "sakin, istikrarlı, güven veren, net ve biraz yavaş" (endişeli değil).
- Değer güncellemede VEGA konuşmaz/yazmaz; ✓ satırı + kural motoru alarmı + AI değerlendirme kartı yeterli.
- Kök neden bulundu: /api/assess (Sonnet, ~10 sn) async uçta senkron çağrı → olay döngüsünü kilitliyordu; VEGA ve ses akışı bekliyordu. run_in_threadpool ile düzeltildi.
- Akışlı Gemini TTS (/api/tts_stream, ham PCM 24 kHz) + Web Audio zamanlayıcı; disk önbelleği (backend/tts_cache, gitignore).
- Alarm anonsu Gemini sesiyle; değer içermez (ekranda) → metin sabit, oturum başında önceden üretilir, önbellekten anında çalar.
- Mandallı alarm: son 30 sn'de kritik varsa alarm sürer; eşikte salınan değer alarmı/AI isteğini tekrar tetiklemez (stableStatus).
- Prompt önbelleği 1 saat TTL + açılışta/50 dk'da ısıtma.
- Ölçüm (headless Chrome, uçtan uca): VEGA metni ~1,4 sn; ses başlangıcı 13,3 sn → 4,7 sn; alarm sesi önbellekten ~0 sn ek gecikme.

## 2026-11-14 21:53 — Senaryolar (B paketi, kalp durması hariç — kullanıcı kararı)
- Takvim (kullanıcı): proje 15 Kas 15:00'te biter, sunumlar 18:00'e kadar, detaylar NASA sitesine 23:59'a kadar.
- Advisor tasarım uyarıları uygulandı: senaryolar addReading kullanmaz (sahte check-in puanı olmasın), koşulla ilerler, Durdur eski hâle döner, hatırlatma penceresi senaryoda çıkmaz, ek uyarılar (radyasyon/kıyafet/DCS) alarm + AI imzası + snapshot'a bağlı.
- Kural motoru düzeltmesi: egzersiz nabız bandı yanlıştı (≤170 "beklenen"); AHA %85 × (220−40) ≈ 153 → ≤153 beklenen, 153–180 izle, ≥180 uyarı, ≥200 kritik (yaş 40 VARSAYIM).
- Hata düzeltmesi: aktivite değişince 30 sn kararlı durum penceresi eski aktivitedeki okumaları yeni eşiklerle değerlendiriyordu (egzersizden dinlenmeye dönünce yanlış kritik alarm) → pencere aktivite değişiminden başlar.
- 1) Taşikardi: dinlenmede 151 → kritik alarm + AI; aynı nabız egzersizde → alarm yok; dinlenmeye dönüş. 2a) ISS Eylül 2017 gerçek TEPC tekrarı (×6000), SAA ve yüksek enlem ayrımı, DONKI X8.2 + SEP olayları, pencere dozu vs 250 mSv. 2b) Mars Mayıs 2024 gerçek MSL-RAD tekrarı (×9000), ≈67× (taban 4,11 medyan), DONKI CME, Dünya gecikmesi 3–22 dk (environments.json). 3a) EVA kıyafet CO₂ (TB-004 belirti aralıkları; V2 [11039] Tablo 35 okunmadı, açıkça yazılır). 3b) EVA DCS: belirti bildirimiyle tetiklenir (TB-037), ilaç yok.
- Üst bar doz hızı tekrar sırasında tekrar değerini gösterir (çelişki yok). Önbellek isabeti hız sınırına sayılmaz; otomatik testler (?test) ses kotası harcamaz.
- Playwright testleri (1536×700): 5 senaryo tr/en karışık çalıştı, sayfa hatası yok.

## 2026-11-14 22:02 — Inspiration4 lab paneli + üç görünüm (astronot / CMO / yer kontrol)
- Lab (I4) sekmesi: OSD-569/575 gerçek CBC/CMP, 4 mürettebat × 7 zaman noktası; yalnız veri seti referans aralığı (canlı değerlendirici/durum rengi yok), "n=4 mürettebat ortalaması, kişisel taban değil", "uçuş içi örnek yok". R+45 glukoz (3 kişide <65) açıklanmadan, yorumsuz gösterilir. Büyüt penceresi.
- Görünümler: üst barda Görünüm seçici (Astronot / Mürettebat CMO / Yer kontrol) + astronot kimliği (C-01..C-04). Astronot cihazı her 2 sn telemetri yayınlar (/ws/telemetry, FastAPI WebSocket aktarıcı). CMO gecikmesiz; yer kontrol paketi "gönderim + tek yön gecikme" anında gösterir (environments.json), henüz ulaşmamışsa geri sayım ("Sinyal yolda"). ÷60 sıkıştırma isteğe bağlı ve ekranda yazılı.
- Tek cihazda da çalışır (yerel tampon). Çoklu laptop: backend --host 0.0.0.0, Vite host:true; ekip aynı ağda http://<ana-bilgisayar-IP>:5180 açar.
- Test (Playwright, 3 eşzamanlı tarayıcı): C-02 Mars senaryosu → yer kontrolde "Sinyal yolda 2 dk 57 sn", sıkıştırmada kritik radyasyon alarmı + senaryo anlatımı; CMO gecikmesiz. Astronot görünümü regresyon temiz.
- Not: Vite izleyicisi python ile yazılan dosyaları zaman zaman kaçırıyor → değişiklikten sonra curl ile sunulan modülü doğrula, gerekirse touch.

## 2026-11-14 22:23 — Advisor incelemesi sonrası düzeltmeler + gerçek ses yolu testi
- Senaryo bandı alarm bandını örtüyordu (ONAYLA görünmüyordu) → bant VEGA çubuğunun üstüne taşındı.
- Anlatım beklenebilir (ses bitince ilerler); tekrar anlatımda durur; alarm anonsu senaryo anlatımını kesmez (sıraya girer). Tekrar duvar saatiyle sürülür → ×5000 (ISS) / ×9000 (Mars) etiketleri gerçek.
- ISS kartı bir kutu geriden geliyordu → düzeltildi. ISS şiddeti en fazla UYARI (LEO'da SPE'lerin çoğu ALARA, TB-020); Mars kritik: "başlangıçta nihai büyüklük bilinmez, sığınak önlemdir".
- I4: referans aralıkları kişiye/cinsiyete ve örneğe göre değişiyor (Hb 11,7–15,5 vs 13,2–17,1; C003'te örnekler arası farklı) → build_data.py crewRef; halkalar kişinin kendi aralığına göre; "*" aralık değişir notu.
- DCS kartı SIMULATED; egzersiz bandı etiketi "yaş 40 vars." ekranda; tachy anlatımı 153 üst sınırını söyler; toparlanmada önce nabız düşer sonra dinlenmeye geçilir (yanlış alarm yok).
- Telemetri varışta yeniden damgalanır (laptop saat farkı); hız sınırı 120/dk (ekip Vite vekili üzerinden tek IP).
- Gemini kota bulgusu: kota dolunca HTTP 200 içinde "event: error" (günde 10 istek/model/anahtar, ücretsiz katman; sıfırlanma ~11:00 TR). Akış artık ilk ses parçasını görmeden yanıt vermez; hata → sıradaki anahtar. Sıra: en iyi model tüm anahtarlarda önce.
- Gerçek ses yolu testi (oturum açık, ?test yok): taşikardi 8 akış başlatıldı, tarayıcı sesine düşüş yok; Mars anlatımı sıralı. Önbellek: 83 dosya (tr+en alarm + anlatım).
- Lab.tsx'te tırnak hatası Vite'ı 500'e düşürdü (tsc yakalamadı) → doğrulamaya esbuild ayrıştırma eklendi.

## 2026-11-14 22:50 — CMO / yer kontrol müdahale paneli (Fable ile tasarım)
- Kullanıcı isteği: tüm metrikleri okuyup müdahale önerisi (ilaç/doz dahil). Fable kararı: deterministik, kaynaklı protokol kütüphanesi; AI yalnızca KİMLİK seçer/sıralar + gerekçe; doz asla modelden geçmez; sunucu AI metninde ilaç adı/doz kalıbı görürse metni siler.
- 6 kart (engine/protocols.ts): göğüs ağrısı, şok, solunum güçlüğü, DCS bakımı (JSC-48031 Rev K, 2008, sayfa sayfa doğrulandı), hipoglisemi (ADA/CDC), hipertansif kriz (AHA). İlaç satırları kaynaktan birebir İngilizce ("Dose: 1 tab" = 2008 kit birimi).
- Vitaller teşhis koymaz: kartlar "ADAY · CMO doğrular"; kontrol listesinin kendi belirti listesi işaretlenmeden ilaç/sıvı adımı görünmez. "*" ilaçlar kilitli: uçuş cerrahı onayı (yer kontrol "Onayla"; onay gidiş-dönüş = 2 × tek yön gecikme sonra ulaşır; yerel durum, aktarılmaz).
- Şok: 0 g'de kontrol listesi hasta sabitleme; kısmi yerçekiminde AHA sırtüstü (2a) / ayak kaldırma (2b) — uygulama VARSAYIM etiketli. VEGA ve research_notes'a protokol eklenmedi (VEGA doz söylemesin).
- Test (Playwright, 2 tarayıcı): C-02'de nabız 151 + şeker 50 + KB 190/125 → CMO panelinde 3 aday kart, AI özeti ve kart gerekçeleri Türkçe, ilaç adı yok; belirti işaretlenince aspirin satırı + WARNING 6-3 göründü.

## 2026-11-14 23:03 — Müdahale paneli: advisor incelemesi düzeltmeleri + veri karşılaştırması
- Kart titremesi: eşleşen kart 60 sn sabitlenir; AI isteği yalnız kart kümesi değişince (60 sn testte 2 çağrı).
- "Birebir" satırlar tam kaynak cümlesi (şok I.V., DCS sıvı); kendi notasyonumuz kaldırıldı. DCS "14,7 psi" adımı Shuttle'a özgü olarak etiketlendi (ISS kabini zaten ~14,7; TB-037 ≥16,4 psia).
- CMO ↔ yer kontrol ayrıldı: CMO belirti işaretler, ilaç adımı işaretlenmeden gizli; uçuş cerrahı tam protokolü salt okunur görür ve her kartta "Onayla/Planı onayla" (astronota tek yön gecikmeyle ulaşır, ÷60'a uyar; yerel durum, CMO'ya aktarılmaz — ekranda yazılı).
- Mars gibi ≥60 sn gecikmede "gerçek zamanlı yer desteği yok → tıbbi otonomi" notu (OCHMO-TB-033).
- CO₂ tutarlılığı: kıyafet CO₂ artık kabin ile aynı bantlar (>4,5 kritik, kritik kademe VARSAYIM); kıyafet CO₂ alarm anonsu eklendi.
- Türkçe ilaç adları süzgece eklendi; AI özeti süzgeçte boşalırsa satır gizlenir.
- Veri karşılaştırması: kullanılmayan indirilmiş veri: i4_cardio.csv (kardiyovasküler biyobelirteçler), deep_space_may2024 (storms.json'da, senaryo yok), DONKI GST, GOES protonları, ISS DOSTEL (yalnız araştırmada). TB-033: uyku ilaçları uçuşta en sık akut ilaç nedeni (~%71); uzak görevlerde tıbbi otonomi.
- Test (Playwright): ISS SpO₂ 90 + KB 75 → şok + solunum + göğüs ağrısı adayları; Mars KB 75 → kısmi yerçekimi dalı + otonomi notu; DCS (arayüzden başlatılan senaryo) → DCS kartı; yer kontrol EN, Onayla → "astronota ulaştı".

## 2026-11-14 23:18 — AI reçete önerisi (Fable ile), kütüphane 12 karta, NASA kıyafet CO₂ Tablo 23
- Kullanıcı: yarışma prototipi, AI ilaç önerebilmeli. Fable: AI açıkça reçete önersin ama KİMLİKLE; ad/doz/sayfa NASA listesinden; kütüphane dışı yalnız ad/sınıf "miktar uçuş cerrahına göre", "KAYNAKSIZ" etiketli ayrı blok; dozu modelin yazdığı sayı ekrana çıkmaz (sunucu yalnız kütüphane dozlarına izin verir).
- İlaç adımları artık gizli değil; "Koşul: göğüs ağrısı doğrulanırsa" ile her zaman görünür. CMO serbest metinle belirti yazar → AI'ye gider.
- Yeni kartlar (JSC-48031, sayfa sayfa doğrulandı): ağır alerji (Epi Pen, *Epinephrine, *Benadryl), nöbet (*Valium IM/IV), uykusuzluk (*Ambien/*Restoril; TB-033: uyku ilacı en sık), irtifa hastalığı (*Diamox), bulantı (*Phenergan), ağrı/baş ağrısı (Aspirin/Tylenol/Motrin). Genel UYARI 6-2 (uyuşukluk yapan ilaçlar birlikte kullanılmaz) ilgili ilaçlarda.
- "*" kuralının tam metni: acil durumda veya iletişim kopukken tedaviye başla, cerrahı en kısa sürede ara → kilit metnine eklendi (Mars gecikmesi sorununu NASA kuralı çözer).
- NASA-STD-3001 V2 Rev B indirildi: kıyafet PICO₂ Tablo 23 (≤4: 14 sa … >15 asla). EVA CO₂ senaryosu, kıyafet göstergesi ve anlatım bu tabloya göre; eski "kıyafet 4,5 kritik" varsayımı kaldırıldı.
- Test: C-21 (nabız 151, KB 150/95, uyku 4,2 sa) + CMO belirti "göğüste baskı, sol kola yayılıyor, terleme" → AI planı: aspirin (JSC-48031 1-37, WARNING 6-3) + kütüphane dışı "nitrat sınıfı · miktar uçuş cerrahına göre"; kartlar göğüs ağrısı, şok, hipertansif kriz, uykusuzluk.

## 2026-11-15 00:01 — ISS 2016 tıbbi el kitabı + AHA 2024 ilk yardım entegrasyonu (Fable planı)
- Kullanıcı erişemediğim 3 kaynağı getirdi: ISS acil tıbbi prosedürleri (FOIA 2016), AHA 2024 ilk yardım, AHA yüksek tansiyon (AI Türkçe özet).
- Alerji, nöbet, solunum kartları Shuttle 2008 yerine ISS 2015 prosedürlerine geçti (birebir doz satırları). ISS'te kilit yok: EpiPen/Diazepam/Albuterol kilitsiz, Phenytoin "as directed by Surgeon". Kilit metni kaynak türüne göre ayrıldı.
- ISS ilaç kiti (3.001, 27 kalem) eklendi: AI kütüphanede olmayan ama kitte bulunan ilacı kitId ile önerir; ekranda "ISS KİTİNDE (2015) · prosedür yayımlanmadı · kit birimi, doz değil · miktar uçuş cerrahına göre". Kitte yoksa "KAYNAKSIZ". Test: göğüs ağrısında Nitroglycerin (Nitrostat) 0,4 mg artık "kitte" etiketiyle; alerjide ISS EpiPen + Albuterol + kitten Benadryl.
- Düzeltme: şok kısmi yerçekimi adımında "ağrı yaparsa kaldırma (Sınıf 3: zarar)" yanlıştı → AHA 2024: sırtüstüne geri al (2b), açı ≈30°–45°, bilinç azalmışsa derlenme pozisyonu (2a).
- Tansiyon: "en az 1 dk bekle, tekrar ölç"; terimler AHA 2025 ("şiddetli hipertansiyon" / "hipertansif acil durum"). Hipoglisemi: ADA 15 g ve AHA ≥20 g ayrı kaynaklarla; yutamayana ağızdan verilmez; 10 dk'da düzelmezse üst düzey.
- Sunucu: model metnindeki tüm doz kalıpları artık siliniyor (izin listesi kaldırıldı; doz yalnız kütüphane/kit satırından gelir).

## 2026-11-15 00:35 — VEGA belirti bildirimi (CMO + mürettebat) ve 5 yeni senaryo (Fable planı)
- Kullanıcı: astronot VEGA'ya "kendimi iyi hissetmiyorum / başım ağrıyor / midem bulanıyor / göğsüm ağrıyor" derse, merkeze ayrıca bildirmesine gerek kalmadan VEGA CMO'ya ve mürettebata bildirsin.
- Algılama ayrı Haiku çağrısı (report_symptom / no_symptom zorunlu seçim, ucuz ön süzgeçle), ses akışına paralel → ilk ses gecikmesi değişmedi. Test: "başım ağrıyor" → bildirim; "başım ağrırsa ne yapmalıyım" ve "başım ağrımıyor" → bildirim YOK; "nabzımı 150 güncelle, midem de bulanıyor" → kayıt + bildirim.
- Onay deterministik: model "bildirdim" demez; olay gelince istemci sabit, önbellekli cümleyi söyler ("Bunu mürettebat sağlık görevlisine ve ekibe bildirdim").
- Taşıma: belirti anlık duruma (snapshot.reportedSymptoms) girer → CMO'da anında açılır bildirim + kart rozeti + müdahale panelinde "Astronot bildirimi" kutusu, aday kart (göğüs ağrısı/solunum/bulantı/ağrı/alerji) ve AI planı. Diğer astronot cihazlarına sunucu üzerinden kısa "notice". Yer kontrolü açılır bildirim almaz; veri kartta tek yön gecikmeyle görünür.
- Yeni senaryolar (hepsi SİMÜLE, belirti VEGA ile aynı kanaldan): ağır alerji (ISS 1.101), düşük kan şekeri (ADA/AHA), çok yüksek tansiyon + belirti (AHA 2025), kabin basıncı düşüşü (irtifa kartı; varsayımsal kaçak), uzay adaptasyon sendromu 2. gün (OCHMO-TB-033: %50–70).
- Motor düzeltmeleri: nokta ölçümler (tansiyon, şeker) SIMULATED okuma ile sürülür; Durdur tansiyon/şeker/kabin/görev gününü geri yükler (test edildi); kabin basıncı hedefi eklendi.
- Küçük düzeltmeler: AI aciliyet değeri dizi gelirse normalize; senaryo değişince sabitlenmiş kartlar temizlenir; senaryo listesi 5 sütun (1536×700'de 10 senaryo görünür).

## 2026-11-15 01:12 — Günlük rutin hatırlatma açılır penceresi kaldırıldı
- Kullanıcı isteği: periyodik "rutin görevler" popup'ı artık çıkmıyor; görevler eskisi gibi alttaki "Günlük rutin" sekmesinde. (Bileşen kodu Checkin.tsx içinde duruyor, yalnızca ekrana eklenmiyor.)

## 2026-11-15 01:33 — Telefon uyumu + kendi sunucuya kurulum (Fable planı)
- Kullanıcı: jüri bilgisayar değil telefonla test edecek; kurulum kendi sunucumuza GitHub'dan yapılacak.
- Tek adres: FastAPI derlenmiş arayüzü (frontend/dist) de sunar → /api ve /ws aynı köken; HTTPS'te mikrofon/kamera çalışır. DEPLOY.md (Caddy/nginx, WebSocket, SSE ayarları) ve backend/requirements.txt eklendi.
- Çoklu telefon: her cihaz ilk açılışta kendi kimliğini alır (C-10…C-99; önceden hepsi C-01'di ve birbirinin üzerine yazacaktı); 3 dk veri göndermeyen cihaz kartı düşer (sunucu + istemci); istek sınırı ters vekil arkasında gerçek IP'ye göre (X-Forwarded-For).
- Telefon düzeni (≤760 px veya kısa yatay dokunmatik; masaüstü CSS'i değişmedi, 1536×700 yeniden çekildi): astronot için alt sekmeler (Yaşamsal · Gövde · AI · Görevler), VEGA altta sabit ve yazı alanı tam genişlik, alarm/senaryo bantları akış içinde, yorgunluk kamerası telefonda yok (izin istemi çıkmasın), gövde etiketleri telefonda gizli. CMO/yer: kart listesi, karta dokununca müdahale paneli tam ekran + geri. Açılış ekranında görünüm seçimi (Astronot / CMO / Yer kontrol).
- iOS: giriş alanları 16 px (odakta yakınlaştırma yok), güvenli alan boşlukları, 100dvh.
- Test: 390×844 (TR) ve 360×640 (EN), ?test=worst, dört sekmede yatay taşma yok; üretim derlemesi 8790'dan tek adreste: iki telefon farklı kimlik aldı, CMO canlı bağlandı.
- Sayfa başlığı "Vite + React + TS" idi → "Astronot Sağlık Monitörü".
- Kalan: gerçek iPhone ve Android ile HTTPS adresinde test (mikrofon izni, ses, klavye, senaryo).

## 2026-11-15 01:44 — VEGA: dokun-konuş + ses dalgası; telefonda gövde değerleri
- Kullanıcı: basılı tutmak telefonda tarayıcı menülerini açıyor → VEGA artık dokun-başlat / dokun-gönder (masaüstünde Boşluk basılı tutma sürüyor). Tarayıcı dinlemeyi kendisi kapatırsa elde olan gönderilir; 30 sn güvenlik sınırı; uzun basma menüsü engellendi.
- Ses dalgası (VegaWave): dinlerken cyan, VEGA konuşurken mor. Masaüstünde gerçek mikrofon seviyesi; telefonda konuşma tanımanın ara sonuçlarıyla (mikrofonu ikinci kez açmak Android/iOS'ta tanımayı bozabildiği için). VEGA sesi Web Audio analizöründen geçer (ses değişmez).
- Telefonda Gövde sekmesi: taşan etiket/çizgi yerine gövdenin altında 4 renkli değer kutusu (beyin, kalp, akciğer, metabolizma); dokununca organ seçilir. Masaüstü etiketleri aynı.
- Test: sahte konuşma tanımayla 390×844'te iki dokunuş → "nabzım kaç acaba" gönderildi, VEGA cevap verdi.

## 2026-11-15 01:55 — asicservices.com/nasalytics (AlmaLinux 8) alt dizin kurulumu
- Tüm yollar derleme tabanından türetildi (src/base.ts): API, WebSocket, 3D model, MediaPipe; derleme: NASA_BASE=/nasalytics/ npm run build. Yerel geliştirme "/" ile aynen çalışır.
- deploy/: systemd hizmeti, Apache (cPanel dahil) ve nginx ayarı (önek soyma, WebSocket, akış tamponsuz), update.sh. DEPLOY.md AlmaLinux 8 adımlarıyla yeniden yazıldı (deploy key, SELinux httpd_can_network_connect, Node 20, Python 3.11).
- Yerel deneme: /nasalytics önekini soyan küçük bir ters vekil arkasında telefon boyutunda uçtan uca: yönlendirme, arayüz, 3D model, VEGA akışı, WebSocket canlı aktarım, belirti bildirimi; HTTP hatası yok.
- VEGA iç terim ("snapshot") söylemesin kuralı eklendi.

## 2026-11-15 09:08 — Kemik/kas kaybına karşı egzersiz (NASA; Fable ile)
- Kullanıcı: belgelerde astronot egzersiz hareketleri var mı, yoksa NASA kaynaklarında araştır. Var: OCHMO-MTB-013 Bone Loss (zaten indirilmişti) + yeni indirilen OCHMO-TB-031 Exercise Overview.
- Yeni "NASA egzersiz planı" (engine/exercise.ts + ExercisePlan): hedefler V1 4003/4024/4027; seans ~30 dk aerobik + 30–60 dk direnç, CEVIS %70–100 VO₂peak / T2 %70–100 HRmax, haftada 6–7 seans; hareket → kemik bölgesi (squat, tek bacak squat, deadlift, good morning, topuk kaldırma, kalça abdüktörü, bench press, parmak şınavı, sprint/sıçrama); ortama göre cihaz (ISS: ARED/T2/CEVIS; Orion: volan; Ay/Mars yüzeyi: yayımlanmış protokol yok). Yük/set/tekrar bilerek yok (ASCR kişiye özel belirler).
- Yerleri: kemik/kas seçilince organ paneli; Günlük rutin → Egzersiz satırındaki "NASA planı" (telefonda da). Görev adı "Egzersiz ~1–1,5 sa" (TB-031: 30 + 30–60 dk).
- VEGA egzersiz sorusunu yalnız bu özetten cevaplıyor (test edildi).
- Düzeltmeler: kemik özetinin kodda tahmin edilmiş adresi 404'tü → ochmo-tb-030-bone-loss.pdf; "deep short-arc squat" yanlış çevrilmişti, düzeltildi. ochmo_bone.txt UTF-8 ile yeniden çıkarıldı.

## 2026-11-15 09:22 — Egzersiz modu: NASA hareketleri animasyonlu ayrı pencerede (Fable ile)
- Kullanıcının iki reposu incelendi: forge-motion görüntüleri CC0 → kullanıldı; exercise-animations lisanssız → kullanılmadı.
- Yalnızca NASA belgelerinde adı geçen 10 hareket animasyonlu (squat, deadlift, Romanian deadlift, good morning, topuk kaldırma, bench press, koşu/T2, bisiklet/CEVIS, sıçrama). Animasyonu olmayan NASA hareketleri yalnız yazı (tek bacak/sumo/kısa açılı squat, tek bacak topuk kaldırma, parmak şınavı, sprint). Benzer-ama-farklı hareket konmadı.
- Ayrı "Egzersiz modu" penceresi (Hareketler / Plan ve hedefler sekmeleri); açılır: üst çubukta Egzersiz seçilince, Günlük rutin → Egzersiz modu, organ panelinde kemik/kas. Her kartta: kemik bölgesi, ISS cihazı, NASA sayfa bağlantısı; üstte "Dünya gösterimi; ISS'te ARED/T2/CEVIS" notu. Yük/set/tekrar yok.
- Test: masaüstü + 390×844; 10 görüntü yüklendi, HTTP hatası yok.

## 2026-11-15 10:02 — Hareket işaretleme + telefonda yorgunluk kamerası
- Egzersiz modunda her animasyonlu kartın altında "Yaptım / Bugün yapıldı" düğmesi; gün bazında cihazda saklanır (son 14 gün), üstte "X/9 hareket bugün" sayacı; işaretlenenler AI anlık durumuna da girer (exerciseMovesDoneToday).
- Telefonda yorgunluk kamerası AI sekmesinde; varsayılan KAPALI (açılışta izin istemi yok), kullanıcı "Aç" deyince başlar ve tercih saklanır. Masaüstü davranışı aynı.
- Test (390×844, sahte kamera): kamera kapalı başladı, açınca görüntü aktı ve kalibrasyon başladı; 2 hareket işaretlendi, sayfa yenilenince korundu.

## 2026-11-15 11:54 — Tek telefonda rol değişimi düzeltmesi
- Astronottan CMO ekranına aynı telefonda geçilince sunucunun tekrar oynattığı eski paket cihazın canlı verisini gizliyordu (kart donuyordu). Artık yerel/uzak kopyadan daha yeni olan gösteriliyor; test edildi.
- Sunucuda ses (TTS) denetlendi: /nasalytics/api/tts ve tts_stream 200 dönüyor (Gemini; önbellekte <1 sn).

## 2026-11-15 12:40 — Altı yeni özellik
- **Dokun-bildir çipleri** (sol sütun; telefonda Yaşamsal sekmesinin üstü): İyiyim / Biraz kötüyüm / Kötüyüm / Baş dönmesi / Baş ağrısı / Bulantı / Göğüs ağrısı. VEGA'ya konuşmadan tek dokunuşla CMO ve mürettebata bildirim; "İyiyim" kendi dokunuş bildirimlerini kapatır. Bildirimlerde kaynak yazılı: VEGA / dokun-bildir / sistem / senaryo.
- **Yer bağlantısı kesintisi (LOS)**: astronot ekranında "Yer bağlantısı" düğmesi (telefonda Görevler sekmesi). LOS sırasında CMO (gemi içi) canlı sürer; yer kontrol yeni veri görmez, kartta "N paket gemide bekliyor" yazar, bağlantı dönünce paketler sırayla aktarılır. Bulut AI (değerlendirme, VEGA, müdahale önerisi) çağrılmaz; kural motoru ve kaynaklı kartlar çalışır. Müdahale panelinde NASA LOS kuralı öne çıkar: yıldızlı ilaçta önce cerrah, acil durumda veya LOS'ta tedaviye başla ve cerrahı en kısa sürede ara (JSC-48031 s. 6-2, yerel metinden doğrulandı).
- **Yanıtsız alarm**: astronot cihazında onaylanmayan kritik alarm 60 sn sürerse CMO ve mürettebata otomatik "yanıt vermiyor olabilir" bildirimi. Alarmda geri sayım ve "süre varsayımımız, NASA değeri değil" etiketi. Senaryo sürerken duraklatılır.
- **Mürettebat sağlık kaydı** (üst çubukta "Kayıt"): yaş, cinsiyet, boy, kütle, kan grubu, dinlenme nabzı, alerjiler, ilaçlar; cihazda saklanır, CMO kartına ve AI'ye gider. Alerji, önerilen ilaç/kit kalemiyle ad veya eş adla eşleşirse satır üstü çizili ve "ALERJİ KAYDIYLA EŞLEŞİYOR, VERME" uyarısı (ör. aspirin → Aspirin). AI kuralına da eklendi.
- **NASA DONKI uzay havası (canlı)**: Görev paneline "Uzay havası" sekmesi. Sunucu son 7 günün FLR/SEP/CME/GST kayıtlarını NASA API'den alır (30 dk önbellek), alınma saati gösterilir. Yalnız NASA'nın olay türleri ve alanları; yorum veya risk kararı yok. Bir tür alınamazsa "NASA'dan alınamadı" yazar (bugün FLR uç noktası 404 döndü).
- **Kişisel taban**: dinlenmede ve senaryo dışında 10 sn'de bir örneklenen nabzın oturum medyanı; nabız satırında "taban 67 (−2)", CMO kartında da. Yalnız bağlam, alarm eşikleri değişmedi.
- Düzeltme: CMO başka mürettebatı seçince önceki AI önerisi kalıyordu, artık sıfırlanıyor.
- Test (4 tarayıcı: astronot, kritik astronot, CMO, yer; ayrıca 390×844): hepsi beklendiği gibi; sayfa hatası yok, telefonda yatay taşma yok.

## 2026-11-15 12:50 — Kurgusal mürettebat, kişisel egzersiz programı, okuma geçmişi
- Rastgele C-xx kimlikleri kaldırıldı; 3 kişilik kurgusal ekip (C-01 Elif Arslan, C-02 Mateo Ruiz, C-03 Hana Sato) yaş, boy, kütle, kan grubu, alerji, dinlenme nabzı ile hazır. Kimlik seçicide adlarıyla; CMO kartında ad görünür. Kayıt üye başına cihazda saklanır, "Örnek kayda dön" ile sıfırlanır.
- Kayıt penceresi üç sekme: Profil (BMI anlık, CDC sınıfı), Kişisel egzersiz programı, Geçmiş ve dışa aktar.
- Kişisel program yalnız kaynaklı hesap: BMI (CDC), tahmini maks. nabız 220−yaş (AHA), T2 hedef nabız bandı %70–100 HRmax (TB-031 s. 11), ARED hareketleri (TB-031 s. 16) ve bugün işaretlenenler, haftada 6–7 seans (MTB-013 s. 14), ortama göre cihaz. CEVIS hedefi VO₂peak testi olmadığı için hesaplanmadı; kütleden yük hesaplanmaz; yük/set/tekrar ASCR'ye bırakıldı. Program AI anlık durumuna da girer.
- Geçmiş: 2 sn'de bir satır (24 saate kadar), 15 dk / 1 sa / 6 sa / tümü, her okuma / 1 dk ortalama, nabız çizgisi, tablo (kritik satırlar kırmızı, LOS işaretli), CSV ve JSON indirme (SİMÜLE etiketli).
- Test: masaüstü ve 390×844; CSV indirildi, sayfa hatası yok, telefonda taşma yok.

## 2026-11-15 13:00 — Üst çubuk düzeltmesi
- Başlık daralınca "Ortam" seçiminin altına taşıyordu; 2100 px altında başlık iki satıra bölünüyor, 1750 px altında rol/kimlik seçicileri daraltıldı. 1920 ve 1536 genişlikte çakışma ve taşma yok (tasarım hedefi 1536+).

## 2026-11-15 13:50 — Teslim hazırlığı
- README.md (İngilizce: fikir, özellikler, veri, yerel kurulum, anahtarlar, AI kullanımı, sınırlar) ve .env.example eklendi; Vite şablon README silindi.
- Sunumlar: sunum/ altında Türkçe ve İngilizce 7 slaytlık PDF (kaynak HTML ve ekran görüntüleriyle).
- Oturum başlatma penceresine "VEGA sesi ve sesli alarmlar yapay zekâ ile üretilmiş sentetik sestir" notu (TR/EN).
- ADA hipoglisemi makalesi depodan çıkarıldı (telifli; bağlantısı SOURCES.md içinde kalıyor).
- SOURCES.md başlıkları: "benzer projeler" olarak yeniden adlandırıldı.

## 2026-11-15 14:15 — Güvenlik incelemesi ve sıkılaştırma
Bulunan ve kapatılan açıklar (ayrıntı ve test: 35 saldırı testi + CSP altında işlev testi geçti):
- Hız sınırı, uydurma X-Forwarded-For ile deliniyordu (ilk girdi kullanılıyordu) → vekilin eklediği son girdi; hız sözlüğü sınırlı.
- İstek gövdesi sınırsızdı (bellek ve AI bütçesi tüketilebiliyordu) → 200 KB (görüntülü 4,2 MB), anlık durum 60 KB, kütüphane 60 KB; bozuk JSON 400.
- CORS herkese açıktı ("*") → kaldırıldı; POST ve WebSocket'te köken (Origin) denetimi (ALLOWED_HOSTS).
- Serbest metin `lang`/`role` sistem istemine giriyordu → beyaz liste. VEGA geçmişi yalnız düz metin, sınırlı.
- Görüntü türü denetlenmiyordu, bozuk veri 500 veriyordu → jpeg/png/webp beyaz listesi, 400.
- /api/vision arayüzde kullanılmıyordu ama açıktı → varsayılan kapalı (ENABLE_VISION=1 ile açılır).
- /docs, /redoc, /openapi.json dışarı açıktı → kapatıldı. /api/health harcama bilgisini gösteriyordu → kaldırıldı. VEGA akışı iç hata metnini sızdırıyordu → genel mesaj.
- Güvenlik başlıkları yoktu → CSP, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- TTS önbelleği sınırsızdı (bellek ~800 MB'a, disk sınırsız büyüyebiliyordu) → bellek 40 MB, disk 3000 dosya / 400 MB, en eski silinir.
- WebSocket: köken denetimi yoktu; kare boyutu, ileti hızı, bağlantı sayısı ve mürettebat kimliği sayısı sınırsızdı; biçimsiz paket izleyicilere iletiliyordu; yavaş alıcı herkesi bekletiyordu → hepsi sınırlandı, bağlantı başına tek kimlik, kadro kimlikleri sahte kimliklerle düşürülemez.
- Arayüz: gelen paket ve bildirimler biçim denetiminden geçiyor (validate.ts); hata sınırı (ErrorBoundary) eklendi; DONKI bağlantıları yalnız nasa.gov https.
- Anthropic çağrıları 60 sn zaman aşımı (asılı çağrılar havuzu tüketmesin). Model çıktısı da tür denetiminden geçiyor.
- Dağıtım: systemd sertleştirme (NoNewPrivileges, PrivateTmp, ProtectSystem, ProtectHome), --ws-max-size, .env 600; update.sh hizmet dosyasını eşitliyor.
- Temiz çıkanlar: git geçmişinde ve derlemede gizli anahtar yok; arayüzde ham HTML basan kod yok; npm audit 0 açık; dizin dışına çıkma (path traversal) yok.
- Kalan, bilinçli kabul edilen risk: telemetri kimlik doğrulamasız (jüri telefonları girişsiz bağlanabilsin diye); aynı ağdaki biri sahte mürettebat verisi yollayabilir. Veriler simülasyon olduğu için kabul edildi.
