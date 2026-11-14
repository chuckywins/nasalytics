# Sunucuya kurulum (kendi sunucumuz, GitHub'dan)

Tek adres: FastAPI hem API'yi (`/api`), hem canlı aktarımı (`/ws/telemetry`), hem de derlenmiş arayüzü (`frontend/dist`) sunar.
Telefonlarda mikrofon ve kamera **yalnızca HTTPS** üzerinde çalışır, bu yüzden önüne TLS yapan bir ters vekil (Caddy veya nginx) konur.

## 1. Kod ve anahtarlar
```bash
git clone https://github.com/chuckywins/nasalytics.git && cd nasalytics
cp /güvenli/yer/.env .env        # ANTHROPIC_API_KEY, GEMINI_API_KEYS, GEMINI_VOICE, (isteğe bağlı) AZURE_SPEECH_KEY/REGION
```
`.env` repoda yoktur; laptoptaki dosya güvenli bir yoldan kopyalanır.

## 2. Arayüzü derle
```bash
cd frontend && npm ci && npm run build && cd ..
```
Node 20+ gerekir. Çıktı `frontend/dist/` klasörüdür; sunucu onu otomatik bulur.

## 3. Arka ucu çalıştır
```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.server:app --host 127.0.0.1 --port 8790 --proxy-headers --forwarded-allow-ips 127.0.0.1
```
Kalıcı çalışması için systemd hizmeti ya da `tmux` kullanılır. `--proxy-headers` sayesinde istek sınırı her telefonun gerçek IP'sine göre uygulanır.

## 4. HTTPS ters vekil

**Caddy (en kolayı; sertifikayı kendisi alır):** `/etc/caddy/Caddyfile`
```
alan-adi.com {
    reverse_proxy 127.0.0.1:8790
}
```
WebSocket dahil her şey kendiliğinden geçer.

**nginx:**
```nginx
server {
    listen 443 ssl;
    server_name alan-adi.com;
    # ssl_certificate ... (certbot)
    location / {
        proxy_pass http://127.0.0.1:8790;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;      # /ws/telemetry için şart
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;                         # VEGA ve ses akışı (SSE) beklemesin
        proxy_read_timeout 3600s;
    }
}
```

## 5. Kontrol
- `https://alan-adi.com/api/health` → `{"ok": true ...}`
- Telefonla adresi aç: açılış ekranında **Astronot olarak başla**. İkinci telefonda **Sağlık görevlisi (CMO) ekranı**: ilk telefonun kartı canlı görünür.
- Doğrudan bağlantılar (QR için): `https://alan-adi.com/?role=astronaut`, `?role=cmo`, `?role=ground`.

## Jüri günü notları
- Her telefon ilk açılışta kendi astronot kimliğini alır (C-10…C-99); 3 dakika veri göndermeyen cihazın kartı CMO ekranından düşer.
- Ses (Gemini) kotası: anahtar ve model başına günde ~10 istek; saat 11:00 civarı yenilenir. Sunumdan önce uygulamayı bir kez açıp anlatım seslerini önbelleğe aldırın (`backend/tts_cache/`).
- `RATE_PER_MIN` (varsayılan 120/dk/IP) ve `DAILY_BUDGET_USD` `.env` ile ayarlanabilir.
- iPhone'da sessiz moddayken ses çalmaz; VEGA'nın yazılı cevabı ekranda yine görünür. iOS'ta konuşma tanıma her zaman güvenilir değildir; yazı alanı her zaman çalışır.
