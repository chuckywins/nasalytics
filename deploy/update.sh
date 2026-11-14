#!/usr/bin/env bash
# Sunucuda güncelleme: GitHub'dan çek, arayüzü /nasalytics/ için derle, bağımlılıkları kur, hizmeti yeniden başlat.
# Kullanım (sunucuda):  sudo -u nasalytics bash /opt/nasalytics/deploy/update.sh && sudo systemctl restart nasalytics
set -euo pipefail
cd /opt/nasalytics
git pull --ff-only
cd frontend
npm ci --no-audit --no-fund
NASA_BASE=/nasalytics/ npm run build
cd ..
.venv/bin/pip install -q -r backend/requirements.txt
echo "Tamam. Şimdi: sudo systemctl restart nasalytics"
