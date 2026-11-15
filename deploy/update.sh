#!/usr/bin/env bash
# Sunucuda güncelleme (root olarak): GitHub'dan çek, arayüzü /nasalytics/ için derle, bağımlılıkları kur, hizmeti yeniden başlat.
# Kullanım:  bash /opt/nasalytics/deploy/update.sh
set -euo pipefail
cd /opt/nasalytics
git config --global --add safe.directory /opt/nasalytics 2>/dev/null || true
git pull --ff-only
cd frontend
npm ci --no-audit --no-fund
NASA_BASE=/nasalytics/ npm run build
cd ..
.venv/bin/pip install -q -r backend/requirements.txt
chown -R nasalytics:nasalytics /opt/nasalytics
[ -f .env ] && chmod 600 .env   # anahtar dosyasını yalnız hizmet kullanıcısı okuyabilsin
# Hizmet tanımı depodakiyle aynı olsun (sertleştirme ayarları dahil)
if ! cmp -s deploy/nasalytics.service /etc/systemd/system/nasalytics.service; then
  \cp -f deploy/nasalytics.service /etc/systemd/system/nasalytics.service && systemctl daemon-reload
fi
systemctl restart nasalytics
echo "Güncellendi ve yeniden başlatıldı."
