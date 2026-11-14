# Kurulum: asicservices.com/nasalytics (AlmaLinux 8)

Mimari: `uvicorn` (FastAPI) yalnızca `127.0.0.1:8790`'da çalışır ve **API + canlı aktarım (WebSocket) + derlenmiş arayüzü** birlikte sunar.
Sitenin mevcut web sunucusu (Apache veya nginx) `https://asicservices.com/nasalytics/` isteklerini öneki soyarak buraya aktarır.
Telefonda mikrofon/kamera yalnızca HTTPS'te çalışır; sitenin mevcut sertifikası kullanılır. Mevcut siteye başka hiçbir şey dokunulmaz.

Komutlar sunucuda, `sudo` yetkili kullanıcıyla çalıştırılır.

## 0. Web sunucusunu öğren
```bash
ls -d /usr/local/cpanel 2>/dev/null && echo "cPanel var"
systemctl is-active httpd nginx 2>/dev/null
ss -ltnp | grep 8790 || echo "8790 boş"
```

## 1. Paketler
```bash
sudo dnf install -y git python3.11 python3.11-pip
sudo dnf module reset -y nodejs && sudo dnf module enable -y nodejs:20 && sudo dnf install -y nodejs
python3.11 --version && node -v          # Python 3.11+, Node 20+
```
`python3.11` bulunamazsa `sudo dnf install -y python39` ve aşağıda `python3.9` kullanın.

## 2. Hizmet kullanıcısı ve kod (özel depo → salt okunur "deploy key")
```bash
sudo useradd -m -r -s /bin/bash nasalytics
sudo -u nasalytics ssh-keygen -t ed25519 -N "" -f /home/nasalytics/.ssh/id_ed25519
sudo cat /home/nasalytics/.ssh/id_ed25519.pub
```
Çıkan satırı GitHub'da ekleyin: **chuckywins/nasalytics → Settings → Deploy keys → Add deploy key** (yazma izni KAPALI). Sonra:
```bash
sudo mkdir -p /opt/nasalytics && sudo chown nasalytics: /opt/nasalytics
sudo -u nasalytics env GIT_SSH_COMMAND="ssh -o StrictHostKeyChecking=accept-new" \
  git clone git@github.com:chuckywins/nasalytics.git /opt/nasalytics
```

## 3. Anahtarlar (.env) ve hazır ses önbelleği — laptoptan
`.env` repoda yoktur. Laptopta proje klasöründe:
```bash
scp .env KULLANICI@asicservices.com:/tmp/nasalytics.env
scp -r backend/tts_cache KULLANICI@asicservices.com:/tmp/tts_cache     # önceden üretilmiş sesler: Gemini kotası harcanmaz
```
Sunucuda:
```bash
sudo mv /tmp/nasalytics.env /opt/nasalytics/.env
sudo mv /tmp/tts_cache /opt/nasalytics/backend/tts_cache
sudo chown -R nasalytics: /opt/nasalytics/.env /opt/nasalytics/backend/tts_cache && sudo chmod 600 /opt/nasalytics/.env
```

## 4. Python ortamı ve arayüz derlemesi (`/nasalytics/` alt dizini için)
```bash
sudo -u nasalytics python3.11 -m venv /opt/nasalytics/.venv
sudo -u nasalytics bash /opt/nasalytics/deploy/update.sh
```
`update.sh`: `git pull` → `npm ci` → `NASA_BASE=/nasalytics/ npm run build` → `pip install -r backend/requirements.txt`.

## 5. Hizmet (systemd)
```bash
sudo cp /opt/nasalytics/deploy/nasalytics.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now nasalytics
curl -s 127.0.0.1:8790/api/health        # {"ok":true,...}
```

## 6. Web sunucusu yönlendirmesi
SELinux, web sunucusunun yerel porta bağlanmasına izin vermeli (AlmaLinux'ta varsayılan kapalı):
```bash
sudo setsebool -P httpd_can_network_connect 1
```

**Apache (httpd):** `deploy/apache-nasalytics.conf` içeriği sitenin **443** `<VirtualHost>` bloğunun içine girmeli.
- Düz httpd: o bloğa `Include /opt/nasalytics/deploy/apache-nasalytics.conf` satırını ekleyin.
- cPanel/WHM:
  ```bash
  sudo mkdir -p /etc/apache2/conf.d/userdata/ssl/2_4/CPANEL_KULLANICI/asicservices.com
  sudo cp /opt/nasalytics/deploy/apache-nasalytics.conf /etc/apache2/conf.d/userdata/ssl/2_4/CPANEL_KULLANICI/asicservices.com/nasalytics.conf
  sudo /scripts/rebuildhttpdconf
  ```
Sonra: `sudo apachectl configtest && sudo systemctl reload httpd` (cPanel'de `sudo /scripts/restartsrv_httpd`).

**nginx:** sitenin `server { listen 443 ssl; ... }` bloğuna `include /opt/nasalytics/deploy/nginx-nasalytics.conf;` ekleyin, sonra `sudo nginx -t && sudo systemctl reload nginx`.

## 7. Kontrol
- `curl -s https://asicservices.com/nasalytics/api/health` → `{"ok":true,...}`
- Telefonla `https://asicservices.com/nasalytics/` → **Astronot olarak başla**. İkinci telefonda **Sağlık görevlisi (CMO) ekranı**: ilk telefonun kartı "canlı bağlantı" ile görünür.
- QR için doğrudan bağlantılar: `…/nasalytics/?role=astronaut`, `?role=cmo`, `?role=ground`.

## Güncelleme (yeni commit sonrası)
```bash
sudo -u nasalytics bash /opt/nasalytics/deploy/update.sh && sudo systemctl restart nasalytics
```

## Sorun giderme
| Belirti | Neden / çözüm |
|---|---|
| 503 Service Unavailable | Hizmet kapalı (`sudo systemctl status nasalytics`, `journalctl -u nasalytics -n 50`) ya da SELinux: `setsebool -P httpd_can_network_connect 1` |
| Sayfa boş, konsolda `/assets/...` 404 | Arayüz `NASA_BASE=/nasalytics/` olmadan derlenmiş → `update.sh`'yi tekrar çalıştırın |
| CMO ekranında "yalnız yerel" | WebSocket geçmiyor: Apache'de `ws://` satırı genel `ProxyPass`'tan önce mi, `proxy_wstunnel` yüklü mü (`httpd -M | grep wstunnel`) |
| VEGA cevabı tek seferde geliyor | Vekil tamponluyor: nginx `proxy_buffering off`; Apache `flushpackets=on` ve `/api/` için gzip kapalı |
| VEGA sessiz, yazı var | Gemini kotası dolmuş olabilir (anahtar/model başına günde ~10, ~11:00'de yenilenir) ya da iPhone sessiz modda |

## Jüri günü notları
- Her telefon ilk açılışta kendi astronot kimliğini alır (C-10…C-99); 3 dakika veri göndermeyen cihazın kartı CMO ekranından düşer.
- İstek sınırı telefon başına (`RATE_PER_MIN`, varsayılan 120/dk) ve günlük AI bütçesi (`DAILY_BUDGET_USD`, varsayılan 40) `.env` ile ayarlanır.
- iOS'ta konuşma tanıma her zaman güvenilir değildir; VEGA'nın yazı alanı her zaman çalışır.
