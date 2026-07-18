// Procedural low-poly city skylines. Each city gets a deterministic cluster
// (seeded by its name) whose composition, palette and height profile depend on
// population — villages get little red-roofed houses, metros get glass towers.

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

// regional-feeling palettes, picked deterministically per city
const PALETTES = [
  { wall: [0xd9c6a5, 0xcbb38f, 0xe2d4ba], roof: [0xa8533f, 0x8f4536, 0xb5624c] },  // mediterranean stone
  { wall: [0xc9c3b8, 0xb5ada0, 0xd8d3c8], roof: [0x76564a, 0x5d443c, 0x6b4f42] },  // old-town europe
  { wall: [0xc2a382, 0xb08f6a, 0xd4b896], roof: [0x8a6a4a, 0x74553a, 0x9a7a58] },  // adobe / desert
  { wall: [0xaebfd4, 0x8fa5c0, 0xc4d2e4], roof: [0x53647c, 0x445268, 0x5f7390] },  // cool coastal
  { wall: [0xb9c4b2, 0x9dab94, 0xd0d8c8], roof: [0x5d7350, 0x4c5f41, 0x6d8560] },  // lush tropics
  { wall: [0xcbb2ae, 0xb59a95, 0xdcc8c4], roof: [0x7c4a52, 0x653a41, 0x8d5a62] }   // rosy plaster
];
const GLASS = [0x9fc4d8, 0x8ab4cc, 0xb5d2e2, 0x7fa8c4];   // metro towers
const GLOW = 0xffd98c;

const mat = c => new THREE.MeshStandardMaterial({
  color: c, flatShading: true, roughness: 0.75, metalness: 0.12,
  emissive: 0x141c2c, emissiveIntensity: 0.5
});

function roofPrism(w, h, d, c) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  return new THREE.Mesh(geo, mat(c));
}

/** Stylized skyline: group, base at y=0. Footprint & height grow with population. */
export function buildCity(city) {
  const rnd = mulberry32(hashStr(city.n + '|' + city.c));
  const g = new THREE.Group();
  const pick = arr => arr[(rnd() * arr.length) | 0];

  // population factor: 15k -> ~0.35, 1M -> ~1.05, 10M+ -> ~2.1
  const pf = Math.min(2.1, Math.max(0.35, (Math.log10(Math.max(city.p, 1000)) - 4) * 1.05));
  const pal = PALETTES[hashStr(city.c + city.n) % PALETTES.length];
  const R = 0.45 + pf * 0.22;                       // cluster radius

  // ground plaza
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.18, R + 0.26, 0.05, 10),
    new THREE.MeshStandardMaterial({ color: 0x232e45, flatShading: true, roughness: 0.95 })
  );
  plaza.position.y = 0.025;
  g.add(plaza);

  const place = (m, r0, r1, h) => {
    const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0);
    m.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
    m.rotation.y = rnd() * Math.PI;
    g.add(m);
    return m;
  };

  // little pitched-roof houses (every settlement has them)
  const houses = 5 + Math.round(pf * 2.5);
  for (let i = 0; i < houses; i++) {
    const w = 0.14 + rnd() * 0.1, d = w * (0.9 + rnd() * 0.5), hh = 0.1 + rnd() * 0.12;
    const wall = pick(pal.wall);
    const body = place(new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat(wall)), R * 0.35, R, 0.05 + hh / 2);
    const roof = roofPrism(w * 1.08, 0.07 + rnd() * 0.05, d * 1.08, pick(pal.roof));
    roof.position.copy(body.position); roof.position.y = 0.05 + hh;
    roof.rotation.y = body.rotation.y;
    g.add(roof);
  }

  // mid-rise blocks for real cities
  if (pf > 0.7) {
    const blocks = Math.round(pf * 2);
    for (let i = 0; i < blocks; i++) {
      const w = 0.16 + rnd() * 0.1, hh = 0.25 + rnd() * 0.3 * pf;
      place(new THREE.Mesh(new THREE.BoxGeometry(w, hh, w * (0.8 + rnd() * 0.4)), mat(pick(pal.wall))),
        R * 0.2, R * 0.6, 0.05 + hh / 2);
    }
  }

  // glass towers only for metros
  if (pf > 1.3) {
    const towers = 2 + Math.round((pf - 1.3) * 4);
    for (let i = 0; i < towers; i++) {
      const w = 0.13 + rnd() * 0.07, hh = (0.55 + rnd() * 0.6) * (pf / 1.8);
      const t = place(new THREE.Mesh(new THREE.BoxGeometry(w, hh, w), mat(pick(GLASS))), 0, R * 0.3, 0.05 + hh / 2);
      if (rnd() > 0.6) {   // rooftop antenna
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.16, 5), mat(0xbecfe6));
        ant.position.copy(t.position); ant.position.y = 0.05 + hh + 0.08;
        g.add(ant);
      }
    }
  }

  // capitals get a landmark beacon tower
  if (city.cap) {
    const th = 0.7 + pf * 0.4;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, th, 6), mat(0xd6e0ee));
    tower.position.y = 0.05 + th / 2;
    g.add(tower);
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 8, 6),
      new THREE.MeshStandardMaterial({ color: GLOW, emissive: GLOW, emissiveIntensity: 0.9 })
    );
    beacon.position.y = 0.05 + th + 0.04;
    g.add(beacon);
  }

  return g;
}
