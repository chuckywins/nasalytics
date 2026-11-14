// Geliştirme aracı: bir GLB'deki düğümlerin dünya koordinatlarındaki merkezlerini listeler.
// Kullanım: node scripts/inspect_glb.mjs <dosya.glb> [regex]
import { NodeIO } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';

const [, , file, re] = process.argv;
const io = new NodeIO();
const doc = await io.read(file);
const pat = re ? new RegExp(re, 'i') : null;
const scene = doc.getRoot().listScenes()[0];
const sb = getBounds(scene);
console.log('scene bounds min', sb.min.map((v) => v.toFixed(3)), 'max', sb.max.map((v) => v.toFixed(3)));
for (const n of doc.getRoot().listNodes()) {
  if (!n.getMesh()) continue;
  if (pat && !pat.test(n.getName())) continue;
  const b = getBounds(n);
  const c = b.min.map((v, i) => ((v + b.max[i]) / 2).toFixed(3));
  console.log(n.getName().padEnd(45), 'center', c.join(','), 'parent', n.getParentNode()?.getName() ?? '-');
}
