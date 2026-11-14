# Tasarım Sistemi: "Dark Cockpit + tek holografik kahraman"

> **v2 (15:55):** Kullanıcı kendi HUD hayal ekranını gösterdi. Fable kararı: HUD düzeni (yoğunluk, organ etiketleri, göstergeler, köşe parantezleri, ince camgöbeği çizgiler) uygulanır. Değişmez 4 kural: durum rengi yalnızca durum · ≥12 px metin · glow/scanline/glitch yok · her sayı gerçek veya etiketli. Mock'taki logolar, "AI prediction", bilişsel test ve stres metre (gerçek girdisi yok) alınmadı.
Karar: Fable (advisor), 2026-11-14 15:30. Girdiler: dataviz skill, ui-ux-pro-max veri tabanı (styles.csv: HUD/Sci-Fi FUI "yüksek erişilebilirlik riski", Cyberpunk "sağlıkta kaçın", Dark OLED, Data-Dense, Accessible & Ethical; ux-guidelines.csv: renk tek başına anlam taşımaz, kritik metin kesilmez, içerik zıplamaz, azaltılmış hareket).

## Felsefe
- **3B vücut tek gösteri unsuru.** Etrafı sakin, yoğun ve okunaklı. Yalnızca koyu tema.
- Futuristik his neon her yerden değil, şu üçünden gelir: **hologram + olay güdümlü hareket + hassas tipografi**.
- Jüri Bilimsel Geçerlilik ve Sunum puanlıyor: okunaklılık > süs.

## Üç kural
1. **Her şey normalse sessiz.** Sapma yoksa renk ve hareket yok. Sapma olunca **bir organ, bir kart ve bir uyarı birlikte** yanar.
2. **Durum rengi yalnızca durum içindir.** 4 seviye, her birinin kendi glifi ve etiketi var (renk tek başına anlam taşımaz). Değerler beyaz metin; durum kart kenar çizgisinde ve çipte. 4 renk dataviz validator ile koyu yüzeye karşı doğrulanır.
3. **Tek vurgu rengi: soğuk camgöbeği (cyan).** Arayüz kabuğu ve etkileşim için; durum için asla.

## Vücut
- Normal organlar tek **soğuk cam tonu + kenar ışığı (rim/fresnel)**. Doğal kırmızılar (kalp, kas) "kritik" gibi okunduğu için kullanılmaz.
- Sapma gösteren organ durum rengine boyanır ve yavaşça nabız atar.
- İskelet soluk bir "hayalet" olarak silüeti verir.
- Emissive + rim shading. **Bloom** yalnızca en zayıf laptop kare hızını koruyorsa.
- Uyarıda veya seçimde kamera organa yumuşakça yaklaşır.
- **Tıklama:** kaburgalar ve uyluk kasları organların önünde kalıyor. Vuruş listesinden **bölge önceliğine** göre seçilir (organ > kas > kemik). Vücudun yanında bölge çipleri de olur. 10 bölgenin hepsi elle tıklanarak test edilir.

## Yerleşim (üç görünüm için tek kabuk)
- **Üst bar:** ortam · görev günü · iletişim gecikmesi · doz göstergesi · rol rozeti · dil
- **Sol:** yaşamsal bulgular sabit slotlarda; jürinin 6 göstergesi önce (KB, nabız, kan şekeri, ısı, uyku, ruh hâli)
- **Orta:** vücut + altında bas-konuş JARVIS kontrolü ve canlı transkript
- **Sağ:** tek bağlam paneli (organ bilgisi ⇄ rehberlik ⇄ uyarılar); uyarı metni **asla kesilmez**
- **Alt şerit:** günün rutin görevleri ve seriler (oyunlaştırma)
- **Görev Kontrol:** kalıcı "veri T−mm:ss öncesinden" işareti
- **Boyutlar:** gövde metni 14 px, değerler 28 px, hiçbir şey 12 px altında değil. 1366×768 ve projektörde kontrol.

## Tipografi
Bir teknik sans + tabular rakamlı bir mono, **self-host** (demo internetsiz çalışsın). İkisinde de Türkçe glifler (ğ ş ı İ) kontrol edilir.

## Hareket (motion / Framer Motion 12, React 19 uyumlu)
- Yalnızca durum değişimleri, 150–250 ms.
- Tek döngüler: kritik nabız ve dinleme göstergesi.
- `prefers-reduced-motion` desteklenir. Glitch ve scanline yok.

## Grafikler (dataviz kuralları)
- y-aralığı klinik aralıktan **sabit**; eşik bantları etiketli arka plan.
- Tek eksen; crosshair tooltip; girilen ölçümler halka işaretçi.
- Fırtına tekrarlarında DONKI olayları etiketli dikey çizgiler.
- Durum renkleri ayrılmış, seri rengi olarak asla kullanılmaz; metin metin tokenı taşır.

## Köken etiketleri
Durum renklerini kullanmaz. **Nötr, çerçeveli etiket + küçük glif.**

## Sıra
Tokenlar + kabuk + vücut görünümü ≈ 90 dk. Sonra kalan özellikler bu kabuğun içine kurulur, ardından ikinci cila turu yapılır.
