// Sağlık vücut modeli derleyicisi.
// Kaynak: anatomi-simulatoru (Dr. Murat Altun) systems/*.glb → BodyParts3D (DBCLS, CC BY-SA 2.1 JP)
// + Z-Anatomy (CC BY-SA 4.0). Çıktı CC BY-SA 4.0 lisanslıdır (bkz. public/models/ATTRIBUTION.md).
// Yalnızca sağlık bölgelerimiz için gereken yapıları seçer, sadeleştirir, tek GLB'de birleştirir.
// Her düğüme extras.region yazılır (heart, lungs, brain, eyes, inner_ear, kidneys, metabolic, bone, bone_load, muscle).
// Kullanım: node scripts/build_body.mjs <anatomi-simulatoru/systems klasörü>
// AI notu: bu betik Claude (Anthropic) yardımıyla yazılmıştır.
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup, weld, simplify, getBounds, mergeDocuments, unpartition } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import path from 'node:path';
import fs from 'node:fs';

const SRC = process.argv[2];
if (!SRC) throw new Error('systems klasörünü verin');
const OUT = path.resolve('public/models/body.glb');

const center = (n) => { const b = getBounds(n); return b.min.map((v, i) => (v + b.max[i]) / 2); };

/** Her kaynak dosya için: [bölge, seçici(ad, merkez) => bool], sadeleştirme oranı */
const PLAN = [
  { file: 'dolasim.glb', ratio: 0.6, rules: [
    ['heart', (n) => /^(Left|Right) (atrium|ventricle)$/.test(n) || /^(Ascending aorta|Arch of aorta)$/.test(n)],
  ] },
  { file: 'ic-organlar.glb', ratio: 0.5, rules: [
    ['lungs', (n) => /lobe of (left|right) lung/i.test(n) || /^(Trachea|Left main bronchus|Right main bronchus)$/.test(n)],
    ['kidneys', (n) => /^(Kidney|Renal pelvis|Ureter)\./.test(n) || n === 'Urinary bladder'],
    ['metabolic', (n) => /^(Pancreas|Liver|Stomach|Gallbladder)$/.test(n)],
  ] },
  { file: 'sinir.glb', ratio: 0.35, rules: [
    ['eyes', (n) => /^(Cornea|Lens|Retina|Sclera)\.[lr]$/.test(n)],
    ['inner_ear', (n) => /^(Vestibule|Cochlea)\.[lr]$/.test(n) || /semicircular (canal|duct)/i.test(n)],
    ['brain', (n, c) => c[1] > 1.55 && Math.abs(c[0]) < 0.08 &&
      !/nerve|retina|lens|cornea|sclera|cochlea|vestib|dura|falx|tentorium|ganglion|chiasm|optic tract|plexus/i.test(n)],
  ] },
  { file: 'iskelet.glb', ratio: 0.3, rules: [
    ['bone_load', (n) => /^(Femur|Hip bone|Tibia)\.[lr]$/.test(n) || /^Vertebra (T|L)\d+$/.test(n) || n === 'Sacrum'],
    ['bone', () => true],
  ] },
  { file: 'kas.glb', ratio: 0.4, rules: [
    ['muscle', (n) => /^(Medial|Lateral) head of gastrocnemius\.[lr]$/.test(n) || /^Soleus muscle\.[lr]$/.test(n) ||
      /^(Rectus femoris|Vastus (lateralis|medialis|intermedius))( muscle)?\.[lr]$/.test(n) || /^Gluteus maximus( muscle)?\.[lr]$/.test(n)],
  ] },
];

await MeshoptSimplifier.ready;
const io = new NodeIO();
let target = null;
const counts = {};

for (const { file, ratio, rules } of PLAN) {
  const doc = await io.read(path.join(SRC, file));
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const name = node.getName();
    const c = center(node);
    const hit = rules.find(([, sel]) => sel(name, c));
    if (!hit) { node.dispose(); continue; }
    node.setExtras({ ...(node.getExtras() || {}), region: hit[0] });
    counts[hit[0]] = (counts[hit[0]] || 0) + 1;
  }
  await doc.transform(prune(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0005 }), dedup());
  if (!target) { target = doc; continue; }
  mergeDocuments(target, doc);
}

// Birleştirme sonrası tüm sahneleri tek sahnede topla, tek buffer'a indir.
const scenes = target.getRoot().listScenes();
const main = scenes[0];
for (const s of scenes.slice(1)) { for (const ch of s.listChildren()) main.addChild(ch); s.dispose(); }
await target.transform(unpartition(), prune());

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await io.write(OUT, target);
console.log('yapı sayıları', counts);
console.log('çıktı', OUT, (fs.statSync(OUT).size / 1e6).toFixed(2), 'MB');
