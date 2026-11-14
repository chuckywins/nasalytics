"""Kaynak denetimi: koddaki her kaynak bağlantısı SOURCES.md'de kayıtlı mı?
Kullanım: python tools/check_sources.py   (eksik varsa listeler ve 1 ile çıkar; commit öncesi çalıştırılır)
API uç noktaları ve XML ad alanları kaynak değildir, atlanır.
AI notu: Claude (Anthropic) yardımıyla yazılmıştır."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP = ("w3.org", "googleapis.com", "microsoft.com", "localhost", "127.0.0.1", "{")
URL = re.compile(r"https?://[^'\"\s)`<>]+")

sources = (ROOT / "SOURCES.md").read_text(encoding="utf-8")
missing = {}
for base in ("frontend/src", "backend", "tools"):
    for f in (ROOT / base).rglob("*"):
        if f.suffix not in {".ts", ".tsx", ".py", ".json"} or "node_modules" in f.parts or f.name == "check_sources.py":
            continue
        for u in URL.findall(f.read_text(encoding="utf-8", errors="ignore")):
            u = u.rstrip(".,;")
            if any(s in u for s in SKIP) or u in sources:
                continue
            missing.setdefault(u, f.relative_to(ROOT).as_posix())

for u, f in sorted(missing.items()):
    print(f"EKSİK  {u}  ({f})")
print(f"{len(missing)} kaynak SOURCES.md'de yok." if missing else "Tüm kod kaynakları SOURCES.md'de kayıtlı.")
sys.exit(1 if missing else 0)
