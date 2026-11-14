"""NASA ham verisini web uygulaması için kökenli (provenance) JSON'lara dönüştürür.

Çıktılar: frontend/src/data/*.json. Her dosyada `source` alanı (veri seti adı, URL, erişim tarihi) bulunur.
Kullanım: python -I tools/build_data.py   (proje kökünden)
AI notu: bu betik Claude (Anthropic) yardımıyla yazılmıştır.
"""
import csv
import json
import statistics as st
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "frontend" / "src" / "data"
OUT.mkdir(parents=True, exist_ok=True)
ACCESSED = "2026-11-14"


def write(name, obj):
    p = OUT / name
    p.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{name}: {p.stat().st_size/1024:.1f} KB")


# ---------- 1) Inspiration4 klinik baz çizgileri (OSD-569 CBC, OSD-575 CMP) ----------
TP_ORDER = ["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"]
TP_DAY = {"L-92": -92, "L-44": -44, "L-3": -3, "R+1": 1, "R+45": 45, "R+82": 82, "R+194": 194}

# (sütun öneki, gösterim adı, birim, kaynak dosya). hemoglobin_*_percent veri setinde yanlış etiketli; değerler g/dL.
ANALYTES = [
    ("glucose", "Glucose", "mg/dL", "i4_cmp.csv"),
    ("sodium", "Sodium", "mmol/L", "i4_cmp.csv"),
    ("potassium", "Potassium", "mmol/L", "i4_cmp.csv"),
    ("calcium", "Calcium", "mg/dL", "i4_cmp.csv"),
    ("creatinine", "Creatinine", "mg/dL", "i4_cmp.csv"),
    ("urea_nitrogen_bun", "BUN", "mg/dL", "i4_cmp.csv"),
    ("albumin", "Albumin", "g/dL", "i4_cmp.csv"),
    ("hemoglobin", "Hemoglobin", "g/dL", "i4_cbc.csv"),
    ("hematocrit", "Hematocrit", "%", "i4_cbc.csv"),
    ("absolute_lymphocytes", "Lymphocytes", "cells/µL", "i4_cbc.csv"),
    ("absolute_neutrophils", "Neutrophils", "cells/µL", "i4_cbc.csv"),
    ("white_blood_cell_count", "WBC", "10³/µL", "i4_cbc.csv"),
    ("platelet_count", "Platelets", "10³/µL", "i4_cbc.csv"),
]


def find_cols(header, prefix):
    v = next((c for c in header if c.startswith(prefix + "_value")), None)
    lo = next((c for c in header if c.startswith(prefix + "_range_min")), None)
    hi = next((c for c in header if c.startswith(prefix + "_range_max")), None)
    return v, lo, hi


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


i4 = {"source": {
    "name": "SpaceX Inspiration4 clinical panels, NASA OSDR OSD-569 (CBC, LSDS-7) and OSD-575 (CMP, LSDS-8)",
    "urls": ["https://osdr.nasa.gov/bio/repo/data/studies/OSD-569", "https://osdr.nasa.gov/bio/repo/data/studies/OSD-575"],
    "accessed": ACCESSED,
    "notes": "4 civilian crew (C001-C004), 3-day LEO mission (Sep 2021). Pre-flight L-92/L-44/L-3, post-flight R+1/45/82/194. "
             "No in-flight samples. Hemoglobin column is labelled 'percent' in the dataset but values are g/dL.",
}, "timepoints": TP_ORDER, "timepointDay": TP_DAY, "analytes": {}}

tables = {}
for f in {a[3] for a in ANALYTES}:
    rows = list(csv.DictReader(open(RAW / f, encoding="utf-8-sig")))
    tables[f] = rows

for key, label, unit, f in ANALYTES:
    rows = tables[f]
    vcol, locol, hicol = find_cols(rows[0].keys(), key)
    if not vcol:
        print("UYARI: sütun yok", key)
        continue
    crew = defaultdict(dict)
    cref = defaultdict(dict)  # kişiye (ör. cinsiyete) özel referans aralığı, örnek başına: [min, max]
    lo = hi = None
    for r in rows:
        parts = r["Sample Name"].split("_")
        cid, tp = parts[0], next(p for p in parts if p.startswith(("L-", "R+")))
        crew[cid][tp] = num(r[vcol])
        cref[cid][tp] = [num(r.get(locol)), num(r.get(hicol))]
        lo = lo if lo is not None else num(r.get(locol))
        hi = hi if hi is not None else num(r.get(hicol))
    pre = [v for c in crew.values() for t, v in c.items() if t.startswith("L-") and v is not None]
    r1 = [c.get("R+1") for c in crew.values() if c.get("R+1") is not None]
    i4["analytes"][key] = {
        "label": label, "unit": unit, "refLow": lo, "refHigh": hi,
        "crew": {cid: [crew[cid].get(t) for t in TP_ORDER] for cid in sorted(crew)},
        "crewRef": {cid: [cref[cid].get(t) for t in TP_ORDER] for cid in sorted(crew)},
        "rangeVaries": len({tuple(v) for c in cref.values() for v in c.values()}) > 1,
        "preflightMean": round(st.mean(pre), 3) if pre else None,
        "r1Mean": round(st.mean(r1), 3) if r1 else None,
    }
write("i4_clinical.json", i4)

# ---------- 2) Ortam radyasyon profilleri (RadLab + ISS TEPC) ----------
hourly = defaultdict(list)
with open(RAW / "bleo_dose_hourly.csv") as fh:
    for r in csv.DictReader(fh):
        hourly[(r["instrument_id"], r["trajectory"])].append(float(r["mean_absorbed_dose_rate_uGy_h"]))


def med(inst, traj):
    v = hourly.get((inst, traj))
    return round(st.median(v), 3) if v else None


tepc = []
for line in open(RAW / "iss_tepc_sep2017.csv"):
    if line.startswith("#"):
        continue
    t, d, h, *_rest = line.strip().split(",")
    d, h = float(d), float(h)
    if d >= 0 and h >= 0:
        tepc.append((t, d, h, float(_rest[2]), float(_rest[1])))  # lat, lon
quiet = [x for x in tepc if not x[0].startswith(("2017-09-10", "2017-09-11", "2017-09-12"))]
Dq = st.mean(x[1] for x in quiet) * 60  # uGy/h
Hq = st.mean(x[2] for x in quiet) * 60  # uSv/h

RADLAB = {"name": "NASA OSDR RadLab", "url": "https://visualization.osdr.nasa.gov/radlab/", "accessed": ACCESSED}
TEPC_SRC = {"name": "ISS TEPC Dose Analyzer (data.nasa.gov / CDAWeb ISS_DOSANL_TEPC)",
            "url": "https://data.nasa.gov/dataset/iss-tissue-equivalent-proportional-counter-tepc-dose-analyzer-10-s-data-61b24",
            "doi": "https://doi.org/10.48322/0ba1-1764", "accessed": ACCESSED}

environments = {
    "iss": {"label": "ISS (LEO)", "gravity_g": 1e-6, "commDelayOneWaySec": [0.5, 1],
            "absorbedUGyH": round(Dq, 3), "equivalentUSvH": round(Hq, 3), "qualityFactor": round(Hq / Dq, 2),
            "qProvenance": "NASA_MEASUREMENT", "doseSource": TEPC_SRC,
            "doseNote": "ISS TEPC 2017-09-01..15 excluding SEP days; detector dose equivalent (ICRP-60), not effective dose."},
    "lunar_transit": {"label": "Orion / lunar transit", "gravity_g": 1e-6, "commDelayOneWaySec": [1.2, 1.4],
                      "absorbedUGyH": med("Artemis-I-HERA-HSU1", "Lunar flyby"), "qualityFactor": None,
                      "doseSource": {**RADLAB, "instrument": "Artemis I HERA HSU1 (Nov-Dec 2022), median"}},
    "lunar_surface": {"label": "Lunar base", "gravity_g": 0.166, "commDelayOneWaySec": [1.2, 1.4],
                      "absorbedUGyH": None, "qualityFactor": None,
                      "doseNote": "No lunar-surface dosimeter series in RadLab download; shown as 'not available' (no fabricated value)."},
    "mars_transit": {"label": "Mars transit", "gravity_g": 1e-6, "commDelayOneWaySec": [180, 1320],
                     "absorbedUGyH": med("Liulin-MO-CD-Cruise", "Mars cruise"), "qualityFactor": 3.82, "qProvenance": "PUBLISHED",
                     "qSource": "Zeitlin et al. 2013, Science 340:1080 (MSL RAD cruise), to be verified",
                     "doseSource": {**RADLAB, "instrument": "ExoMars TGO Liulin-MO cruise (2016), median"}},
    "mars_surface": {"label": "Mars base", "gravity_g": 0.38, "commDelayOneWaySec": [180, 1320],
                     "absorbedUGyH": med("MSL-RAD-Surface", "Mars surface"), "qualityFactor": 3.05, "qProvenance": "PUBLISHED",
                     "qSource": "Hassler et al. 2014, Science 343 (MSL RAD surface), to be verified",
                     "doseSource": {**RADLAB, "instrument": "Curiosity MSL-RAD surface 2015-2024, median"}},
    "deep_space_1au": {"label": "Interplanetary (1 AU)", "gravity_g": 1e-6, "commDelayOneWaySec": [5, 1320],
                       "absorbedUGyH": med("BPD", "Heliocentric orbit at 1 AU"), "qualityFactor": None,
                       "doseSource": {**RADLAB, "instrument": "BPD 2022-2025, median"}},
}
write("environments.json", {"source": [RADLAB, TEPC_SRC], "environments": environments})

# ---------- 3) Gerçek fırtına tekrarları ----------
def bucket(series, minutes):
    out = defaultdict(list)
    for t, *vals in series:
        k = t[:14] + f"{(int(t[14:16])//minutes)*minutes:02d}"
        out[k].append(vals)
    return [[k] + [round(st.mean(v[i] for v in vs), 4) for i in range(len(vs[0]))] for k, vs in sorted(out.items())]


iss_series = [(t, d * 60, h * 60, 1.0 if abs(lat) > 40 else 0.0) for t, d, h, lat, lon in tepc
              if "2017-09-08" <= t[:10] <= "2017-09-13"]
storms = {
    "iss_sep2017": {
        "label": "ISS - Solar particle event, 10-11 Sep 2017",
        "columns": ["time", "absorbedUGyH", "equivalentUSvH", "highLatFraction"],
        "series": bucket(iss_series, 10),
        "events": [{"time": "2017-09-10T15:35Z", "type": "FLR", "id": "2017-09-10T15:35:00-FLR-001", "note": "X8.2 flare"},
                   {"time": "2017-09-10T16:09Z", "type": "CME", "id": "2017-09-10T16:09:00-CME-001"},
                   {"time": "2017-09-10T16:25Z", "type": "SEP", "id": "2017-09-10T16:25:00-SEP-001", "note": "GOES13 >100 MeV"}],
        "source": [TEPC_SRC, {"name": "NASA DONKI (CCMC)", "url": "https://api.nasa.gov/", "accessed": ACCESSED}],
        "finding": "High-latitude dose rose ~6x (0.16 -> 1.02 uGy/min) on 11 Sep while SAA dose was unchanged: SEP signature.",
    },
}
for key, inst, traj, t0, t1, label in [
    ("mars_may2024", "MSL-RAD-Surface", "Mars surface", "2024-05-15", "2024-05-26", "Mars surface - RAD recorded spike, 20 May 2024"),
    ("deep_space_may2024", "BPD", "Heliocentric orbit at 1 AU", "2024-05-08", "2024-05-20", "Interplanetary 1 AU - May 2024 storm"),
]:
    ser = []
    with open(RAW / "bleo_dose_hourly.csv") as fh:
        for r in csv.DictReader(fh):
            if r["instrument_id"] == inst and t0 <= r["hour"][:10] <= t1:
                ser.append([r["hour"] + ":00", round(float(r["mean_absorbed_dose_rate_uGy_h"]), 3)])
    ser.sort()
    storms[key] = {"label": label, "columns": ["time", "absorbedUGyH"], "series": ser,
                   "source": [{**RADLAB, "instrument": inst}], "events": []}
write("storms.json", storms)
