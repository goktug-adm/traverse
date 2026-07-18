// Procedural low-poly city skylines. Each city gets a deterministic cluster of
// buildings (seeded by its name) whose size/height scale with population.
// They appear on the globe as you zoom in close.

import * as THREE from 'three';

function hashStr(s) {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = [0x91a9cc, 0x6f89ad, 0xaebfd9, 0x5c7396, 0x7e97ba];
const GLOW = 0xffd98c;

const buildingMat = c => new THREE.MeshStandardMaterial({
  color: c, flatShading: true, roughness: 0.7, metalness: 0.15,
  emissive: 0x1a2438, emissiveIntensity: 0.6
});

/** Build a stylized skyline for a city. Returns a group, base at y=0, ~1-3 units tall. */
export function buildCity(city) {
  const rnd = mulberry32(hashStr(city.n + '|' + city.c));
  const g = new THREE.Group();

  // population factor: 15k -> ~0.35, 1M -> ~1.4, 10M+ -> ~2.1
  const pf = Math.min(2.1, Math.max(0.35, (Math.log10(Math.max(city.p, 1000)) - 4) * 1.05));
  const count = 5 + Math.round(pf * 4) + (city.cap ? 2 : 0);

  // ground plaza
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(1.35, 1.45, 0.08, 10),
    new THREE.MeshStandardMaterial({ color: 0x2b3750, flatShading: true, roughness: 0.95 })
  );
  plaza.position.y = 0.04;
  g.add(plaza);

  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.15 + rnd() * 1.0;
    const w = 0.24 + rnd() * 0.3;
    const h = (0.35 + rnd() * 1.15) * (0.55 + pf * 0.75);
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w * (0.8 + rnd() * 0.4)),
      buildingMat(PALETTE[(rnd() * PALETTE.length) | 0])
    );
    m.position.set(Math.cos(a) * r, 0.08 + h / 2, Math.sin(a) * r);
    m.rotation.y = rnd() * Math.PI;
    g.add(m);
  }

  // a signature tower for capitals / big cities
  if (city.cap || pf > 1.5) {
    const th = 1.1 + pf * 0.75;
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.16, th, 6),
      buildingMat(0xbecfe6)
    );
    tower.position.y = 0.08 + th / 2;
    g.add(tower);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshStandardMaterial({ color: GLOW, emissive: GLOW, emissiveIntensity: 0.9 })
    );
    beacon.position.y = 0.08 + th + 0.06;
    g.add(beacon);
  }

  return g;
}
