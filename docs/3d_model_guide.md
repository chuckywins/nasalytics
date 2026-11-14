# 3B İnsan Modeli Bulma Rehberi (ekipteki model sorumlusu için)

## Neye ihtiyacımız var
1. **Dış gövde (silüet):** yarı saydam "hologram" kabuk. Astronot ya da sade bir insan figürü.
2. **İç organlar ayrı parçalar hâlinde:** kalp, akciğerler, beyin, gözler, böbrekler, kemikler (iskelet), kaslar, iç kulak (vestibüler). Her organ tıklanabilir olacak ve durum rengine boyanacak.

## Kabul kriterleri (hepsi şart)
- **Format:** `.glb` veya `.gltf` (Three.js'e doğrudan girer). `.fbx`, `.obj` ya da `.blend` Blender'da GLB'ye çevrilebilir.
- **Organlar ayrı ve isimli mesh olmalı** (ör. `Heart`, `Lung_L`). Tek parça model işe yaramaz.
- **Poligon:** toplam < ~150k; web'de akıcı dönmeli.
- **Lisans:** **CC0** veya **CC BY** (atıf yaparız). CC BY-NC (ticari olmayan) kabul edilebilir ama son seçenek. Lisans sayfasının ekran görüntüsünü alın.
- **NASA logosu, bayrağı veya görev arması OLMAMALI** (teslim kuralı). Astronot kıyafetinde arma varsa dokusu silinir.
- Kaynak linki ve yazar adı `SOURCES.md` §"Space Agency Partner & Other Data" bölümüne yazılır.

## Nereden bakılmalı (öncelik sırasıyla)
| Site | Ne var | Lisans notu |
|---|---|---|
| **HRA / HuBMAP 3D Reference Library**, https://humanatlas.io/3d-reference-library | Erkek ve kadın **referans organlar** (kalp, akciğer, böbrek, beyin, göz, kemik iliği...), GLB, bilimsel kaynaklı | CC BY 4.0 (sayfadan doğrulayın). **Organlar için 1. tercih** |
| **Z-Anatomy**, https://www.z-anatomy.com/ | BodyParts3D tabanlı, tam segmentli anatomi atlası (Blender) | CC BY-SA 4.0; Blender'dan seçili organlar GLB'ye çıkarılır |
| **BodyParts3D** (DBCLS), https://lifesciencedb.jp/bp3d/ | Japonya'nın açık anatomi veritabanı, organ organ OBJ | CC BY-SA (sürümüne göre doğrulayın) |
| **NIH 3D**, https://3d.nih.gov/ | Anatomik modeller, çoğu açık lisans | Model başına kontrol |
| **Sketchfab**, https://sketchfab.com/ | Çok sayıda anatomi ve hologram modeli | Filtre: *Downloadable* + lisans *CC0 / CC BY* |
| **NASA 3D Resources**, https://science.nasa.gov/3d-resources/ | Astronot (NASA-316, 3DS, indirilebilir: http://nasa3d.arc.nasa.gov/shared_assets/models/astronaut/astronaut1.zip), kask, ISS, Orion | NASA medyası; **logolu dokuları kullanmayın**. Sahne ve dekor için iyi |
| **Mixamo**, https://www.mixamo.com/ | Ücretsiz, iskeletli (rigged) insan ve animasyonlar (nefes alma, yüzme) | Adobe hesabı gerekir, kullanım serbest |
| **Quaternius / Poly Pizza**, https://poly.pizza/ | Low-poly insan ve astronot karakterleri | CC0 |

## Arama kelimeleri (İngilizce arayın)
- `human anatomy organs glb` · `segmented human body gltf` · `human organs separate meshes`
- `low poly human anatomy CC BY` · `anatomical heart lungs glb`
- `hologram human body 3d model` · `x-ray human body glb` · `wireframe human body`
- `astronaut low poly glb` · `spacesuit 3d model CC0`
- Sketchfab'da: arama + **Downloadable** filtresi + **License: CC Attribution / CC0**

## ⭐ 1. aday: anatomi-simulatoru (kullanıcı önerisi, 2026-11-14 incelendi)
https://github.com/DrMuratAltun/anatomi-simulatoru (Dr. Murat Altun)
- Three.js + GLB, statik çalışır; 7 sistem, ~2.914 tıklanabilir yapı (README'de 1.969 ile çelişkili sayı var).
- Sistem başına GLB (`systems/*.glb`): **iç organlar 120 yapı, 4,8 MB** · iskelet 277 yapı, 5,3 MB · kas 8,1 MB · sinir 8,1 MB · dolaşım 7,9 MB · lenf 1,5 MB · bağlar 3,7 MB. Toplam ~37 MB, sistem bazlı tembel yükleme.
- Tıklama: her vertex'te `structureId` var, `names[]` ile eşleşir (Terminologia Anatomica, İngilizce/Latince). Sistem başına tek geometri, 1–2 draw call; **performanslı**.
- Kaynak: BodyParts3D (DBCLS, CC BY-SA 2.1 JP) + Z-Anatomy (CC BY-SA 4.0). Atıf zinciri `ATTRIBUTION.md` dosyasında.
- **Lisans:** kod MIT; **3B veri CC BY-SA 4.0 (ShareAlike)**. Türetilmiş model kullanırsak o kısmı CC BY-SA olarak atıfla paylaşmamız gerekir (açık kaynak hackathon projesi için uygun). `assets/yzo-mark.png` **tüm hakları saklı, KULLANMA.**
- Eksikler: yalnızca erkek; lenf damarları yok; kaslar %18 azaltılmış.
- **Bizim kullanım planımız:** yalnızca *iç organlar* + *iskelet* GLB'leri (~10 MB) alınır, hologram kabuğunun içine yerleştirilir. Organ isimleri bizim sağlık bölgelerimize eşlenir: kalp → kardiyovasküler, akciğerler → solunum/CO₂, beyin → bilişsel/uyku/ruh hâli, gözler → SANS, böbrekler → taş riski/hidrasyon, kemikler → kemik kaybı, iç kulak → vestibüler.

## Önerilen kombinasyon
**Dış kabuk:** Sketchfab, Quaternius ya da Mixamo'dan sade bir insan silüeti (fresnel/hologram shader ile yarı saydam yapacağız).
**İç organlar:** HRA (erkek ve kadın setleri).
Mümkünse bir **kadın** varyantı da bulun; HRA'da var.

## Teslim ederken
Modelleri `frontend/public/models/` altına koyun, her model için şu satırı yazın: `ad | kaynak URL | yazar | lisans | yapılan değişiklik`.
