// 3B anatomik vücut: "tek holografik kahraman" (docs/design_system.md).
// Normal organlar soğuk cam tonu + fresnel kenar ışığı; yalnızca sapma gösteren bölge durum rengini alır ve nabız atar.
// Tıklama: vuruş listesinden bölge önceliğiyle seçim (organ > kas > kemik), kaburga/kas organları örtmesin.
// Model: public/models/body.glb (CC BY-SA 4.0, bkz. ATTRIBUTION.md). AI notu: Claude (Anthropic) yardımıyla yazılmıştır.
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { asset } from '../base';
import { OrbitControls, useGLTF, Bounds, Line } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Region, Status } from '../engine/types';

import { STATUS_COLOR, STATUS_GLYPH } from './Hud';
const GLASS = '#7fb4d6';      // nominal organ tonu
const GHOST = '#9fb3c8';      // iskelet hayaleti
const ACCENT = '#5ad1e6';     // seçim/hover (durum değil)

/** Tıklama önceliği: küçük sayı önce kazanır */
const PRIORITY: Record<Region, number> = {
  heart: 0, eyes: 0, inner_ear: 0, lungs: 1, kidneys: 1, metabolic: 1, brain: 1, muscle: 2, bone_load: 3, bone: 4,
};
const OPACITY: Record<Region, number> = {
  heart: 0.95, lungs: 0.35, brain: 0.55, eyes: 0.9, inner_ear: 0.95, kidneys: 0.85, metabolic: 0.45,
  bone: 0.10, bone_load: 0.16, muscle: 0.14,
};

/** Fresnel kenar ışığı: MeshStandardMaterial'a onBeforeCompile ile eklenir */
function makeMaterial(region: Region) {
  const ghost = region === 'bone' || region === 'bone_load' || region === 'muscle';
  const op = OPACITY[region];
  const mat = new THREE.MeshStandardMaterial({
    color: ghost ? GHOST : GLASS, roughness: 0.35, metalness: 0.1,
    transparent: op < 1, opacity: op, depthWrite: op > 0.8, side: THREE.FrontSide,
  });
  const uniforms = { rimColor: { value: new THREE.Color(ghost ? '#5f7f9c' : '#8fe3f5') }, rimPower: { value: ghost ? 2.5 : 2.0 }, rimStrength: { value: ghost ? 0.5 : 0.9 } };
  mat.userData.rim = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor; uniform float rimPower; uniform float rimStrength;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), rimPower);
        totalEmissiveRadiance += rimColor * rim * rimStrength;`);
  };
  return mat;
}

export interface Callout { region: Region; title: string; value: string; status: Status; }
interface Props {
  statuses: Partial<Record<Region, Status>>;
  selected: Region | null;
  onSelect: (r: Region) => void;
  layers: { organs: boolean; skeleton: boolean; muscle: boolean };
  callouts: Callout[];
  /** Telefon: gövde çevresindeki etiket/çizgi yerine altta değer kutuları (dar ekranda etiketler taşıyordu) */
  compact?: boolean;
}

/** Organ çapa noktaları ve etiket konumları (dünya koordinatı, metre; +x = hastanın solu) */
const ANCHOR: Partial<Record<Region, { at: [number, number, number]; label: [number, number, number] }>> = {
  brain: { at: [0.03, 1.64, 0.0], label: [0.36, 1.58, 0] },
  lungs: { at: [-0.09, 1.34, 0.02], label: [-0.40, 1.42, 0] },
  heart: { at: [0.02, 1.29, 0.04], label: [0.40, 1.34, 0] },
  metabolic: { at: [-0.04, 1.16, 0.05], label: [-0.40, 1.12, 0] },
  kidneys: { at: [0.06, 1.07, -0.02], label: [0.40, 1.00, 0] },
};

/** 3B tarafta: kılavuz çizgileri + çapa noktaları; etiket kutularının ekran konumunu her karede DOM katmanına yazar. */
const _v = new THREE.Vector3();
function Callouts({ items }: { items: Callout[] }) {
  useFrame(({ camera, size }) => {
    for (const c of items) {
      const a = ANCHOR[c.region];
      const el = document.getElementById(`co-${c.region}`);
      if (!a || !el) continue;
      _v.set(...a.label).project(camera);
      const x = (_v.x * 0.5 + 0.5) * size.width, y = (-_v.y * 0.5 + 0.5) * size.height;
      el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.visibility = 'visible';
    }
  });
  return (
    <>
      {items.map((c) => {
        const a = ANCHOR[c.region];
        if (!a) return null;
        const col = c.status === 'ok' ? '#5ad1e6' : STATUS_COLOR[c.status];
        return (
          <group key={c.region}>
            <Line points={[a.at, [a.label[0] * 0.75, a.label[1], 0], a.label]} color={col} lineWidth={1} transparent opacity={0.7} />
            <mesh position={a.at}><sphereGeometry args={[0.006, 12, 12]} /><meshBasicMaterial color={col} /></mesh>
          </group>
        );
      })}
    </>
  );
}

function Model({ statuses, selected, onSelect, layers }: Props) {
  const { scene } = useGLTF(asset('models/body.glb'));
  const [hover, setHover] = useState<Region | null>(null);
  const reduced = useRef(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  const materials = useMemo(() => {
    const m = {} as Record<Region, THREE.MeshStandardMaterial>;
    (Object.keys(PRIORITY) as Region[]).forEach((r) => { m[r] = makeMaterial(r); });
    return m;
  }, []);

  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const region = (mesh.userData.region ?? mesh.parent?.userData.region) as Region | undefined;
      if (!region) return;
      mesh.userData.region = region;
      mesh.material = materials[region];
      mesh.renderOrder = PRIORITY[region] >= 2 ? 2 : 1; // yarı saydam kabuklar organlardan sonra çizilsin
    });
  }, [scene, materials]);

  // Her karede: sapma gösteren bölgeler durum rengine boyanır, kritikte nabız atar; seçili/hover cyan kenar.
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    (Object.keys(materials) as Region[]).forEach((r) => {
      const mat = materials[r];
      const st = statuses[r];
      const deviating = st && st !== 'ok' && st !== 'unknown';
      const ghost = r === 'bone' || r === 'bone_load' || r === 'muscle';
      mat.visible = r === 'muscle' ? layers.muscle : r === 'bone' || r === 'bone_load' ? layers.skeleton : layers.organs;
      mat.color.set(deviating ? STATUS_COLOR[st!] : ghost ? GHOST : GLASS);
      const pulse = st === 'critical' && !reduced.current ? 0.5 + 0.5 * Math.sin(t * 4) : 1;
      mat.emissive.set(deviating ? STATUS_COLOR[st!] : '#000000');
      mat.emissiveIntensity = deviating ? 0.35 + 0.45 * pulse : 0;
      const rim = mat.userData.rim;
      const active = r === selected || r === hover;
      rim.rimColor.value.set(active ? ACCENT : deviating ? STATUS_COLOR[st!] : ghost ? '#5f7f9c' : '#8fe3f5');
      rim.rimStrength.value = active ? 1.6 : ghost ? 0.5 : 0.9;
    });
  });

  /** Vuruş listesinden en yüksek öncelikli bölgeyi seç */
  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>): Region | undefined => {
    let best: Region | undefined;
    for (const h of e.intersections) {
      if (!((h.object as THREE.Mesh).material as THREE.Material)?.visible) continue;
      const r = h.object.userData.region as Region | undefined;
      if (r && (best === undefined || PRIORITY[r] < PRIORITY[best])) best = r;
    }
    return best;
  };

  return (
    <primitive
      object={scene}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); const r = pick(e); if (r) onSelect(r); }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); const r = pick(e) ?? null; if (r !== hover) setHover(r); document.body.style.cursor = r ? 'pointer' : 'auto'; }}
      onPointerOut={() => { setHover(null); document.body.style.cursor = 'auto'; }}
    />
  );
}

export default function Body3D(props: Props) {
  return (
    <>
    {props.layers.organs && !props.compact && (
      <div className="callout-layer">
        {props.callouts.map((c) => {
          const a = ANCHOR[c.region];
          if (!a) return null;
          const col = c.status === 'ok' ? '#5ad1e6' : STATUS_COLOR[c.status];
          const left = a.label[0] < 0;
          return (
            <button key={c.region} id={`co-${c.region}`} className={`callout ${left ? 'l' : 'r'}`} style={{ borderColor: col, visibility: 'hidden' }} onClick={() => props.onSelect(c.region)}>
              <span className="c-t">{c.title}</span>
              <span className="c-v num" style={{ color: c.status === 'ok' ? '#e6edf3' : col }}>{c.status !== 'ok' && `${STATUS_GLYPH[c.status]} `}{c.value}</span>
            </button>
          );
        })}
      </div>
    )}
    <Canvas camera={{ position: [0, 1.0, 2.6], fov: 32 }} dpr={[1, 2]}>
      <color attach="background" args={['#070b12']} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 3, 2]} intensity={1.1} />
      <directionalLight position={[-2, 1.5, -1.5]} intensity={0.6} color="#7dd3fc" />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.05}>
          <Model {...props} />
        </Bounds>
        {props.layers.organs && !props.compact && <Callouts items={props.callouts} />}
      </Suspense>
      <OrbitControls makeDefault target={[0, 0.95, 0]} enablePan={false} minDistance={0.5} maxDistance={4} />
    </Canvas>
    {props.compact && (
      <div className="body-chips">
        {props.callouts.map((c) => {
          const col = c.status === 'ok' ? '#5ad1e6' : STATUS_COLOR[c.status];
          return (
            <button key={c.region} className={`body-chip ${props.selected === c.region ? 'on' : ''}`} style={{ borderColor: col }} onClick={() => props.onSelect(c.region)}>
              <span className="c-t">{c.title}</span>
              <span className="c-v num" style={{ color: c.status === 'ok' ? '#e6edf3' : col }}>{c.status !== 'ok' && `${STATUS_GLYPH[c.status]} `}{c.value}</span>
            </button>
          );
        })}
      </div>
    )}
    </>
  );
}
useGLTF.preload(asset('models/body.glb'));
