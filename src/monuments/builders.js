// Procedural low-poly monument builders.
// Every builder returns a THREE.Group whose base sits at y=0; buildMonument()
// normalizes it so total height = 1 world unit, ready to scale anywhere.

import * as THREE from 'three';

export const C = {
  stone: 0xcfc5b1, sand: 0xdcc38e, brick: 0xb06a45, white: 0xf4f1ea,
  gold: 0xd9b23a, red: 0xc23b2e, dark: 0x474753, marble: 0xe9e4d8,
  copper: 0x5fb0a4, wood: 0x8b5a2b, gray: 0x9c9ca4, blue: 0x3d6db5,
  slate: 0x5b6472, mud: 0xb08753, terra: 0xc57a4d, green: 0x3f7d4e,
  iron: 0x7a6a52, concrete: 0xc9c9c4, water: 0x2b6b9e, cream: 0xefe3c8
};

const mat = (c, o = {}) =>
  new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.82, metalness: 0.08, ...o });

/* -- base-anchored primitives: (group, dims..., color, x, baseY, z) -- */
function box(g, w, h, d, c, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  m.position.set(x, y + h / 2, z); m.rotation.y = ry; g.add(m); return m;
}
function cyl(g, rt, rb, h, c, x = 0, y = 0, z = 0, seg = 12, ry = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
  m.position.set(x, y + h / 2, z); m.rotation.y = ry; g.add(m); return m;
}
function cone(g, r, h, c, x = 0, y = 0, z = 0, seg = 12, ry = 0) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(c));
  m.position.set(x, y + h / 2, z); m.rotation.y = ry; g.add(m); return m;
}
// sphere centered at y (scaled vertically by sy)
function ball(g, r, c, x = 0, y = 0, z = 0, sy = 1, seg = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), mat(c));
  m.position.set(x, y, z); m.scale.y = sy; g.add(m); return m;
}
// hemisphere dome sitting on y
function dome(g, r, c, x = 0, y = 0, z = 0, sy = 1, seg = 14) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(c));
  m.position.set(x, y, z); m.scale.y = sy; g.add(m); return m;
}
// triangular prism roof, ridge along z
function roof(g, w, h, d, c, x = 0, y = 0, z = 0, ry = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(geo, mat(c));
  m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m;
}
// onion dome (bulb + tip) sitting on y
function onion(g, r, c, x = 0, y = 0, z = 0) {
  ball(g, r, c, x, y + r * 0.75, z, 1.15);
  cone(g, r * 0.45, r * 1.1, c, x, y + r * 1.55, z, 8);
}
// crenellated parapet along a wall-top edge
function merlons(g, count, span, c, x, y, z, horizontalAxis = 'x', size = 0.02) {
  for (let i = 0; i < count; i++) {
    const t = -span / 2 + (i + 0.5) * (span / count);
    if (horizontalAxis === 'x') box(g, size, size * 1.4, size, c, x + t, y, z);
    else box(g, size, size * 1.4, size, c, x, y, z + t);
  }
}
function ringOf(n, r, fn, phase = 0) {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    fn(Math.cos(a) * r, Math.sin(a) * r, a);
  }
}
const G = () => new THREE.Group();

/* ---------------------------------------------------------------- */
const BUILDERS = {

  eiffel(p = {}) {
    const g = G(), c = p.color ?? C.iron;
    cyl(g, 0.22, 0.42, 0.38, c, 0, 0, 0, 4, Math.PI / 4);
    box(g, 0.5, 0.04, 0.5, c, 0, 0.38);
    cyl(g, 0.11, 0.2, 0.34, c, 0, 0.42, 0, 4, Math.PI / 4);
    box(g, 0.26, 0.035, 0.26, c, 0, 0.76);
    cyl(g, 0.04, 0.1, 0.36, c, 0, 0.795, 0, 4, Math.PI / 4);
    box(g, 0.1, 0.03, 0.1, c, 0, 1.155);
    cone(g, 0.03, 0.17, c, 0, 1.185, 0, 4);
    // ground arch hint
    cyl(g, 0.1, 0.1, 0.05, C.dark, 0, 0.02, 0, 12).rotation.x = Math.PI / 2;
    return g;
  },

  pyramid(p = {}) {
    const g = G(), c = p.color ?? C.sand;
    cone(g, 0.62, 0.62, c, 0, 0, 0, 4, Math.PI / 4);
    if (p.trio) {
      cone(g, 0.34, 0.34, c, -0.72, 0, 0.3, 4, Math.PI / 4);
      cone(g, 0.22, 0.22, c, -1.2, 0, 0.55, 4, Math.PI / 4);
    }
    if (p.steep) g.scale.y = 1.6;
    return g;
  },

  steppyramid(p = {}) {
    const g = G(), c = p.color ?? C.stone, tiers = p.tiers ?? 5;
    let w = 0.9;
    for (let i = 0; i < tiers; i++) { box(g, w, 0.11, w, c, 0, i * 0.11); w *= 0.76; }
    box(g, w * 1.1, 0.16, w * 1.1, c, 0, tiers * 0.11);              // temple
    box(g, 0.14, 0.02, 0.48, c, 0, 0.01, 0.48).rotation.x = -0.42;   // stair ramp
    return g;
  },

  ziggurat(p = {}) { return BUILDERS.steppyramid({ tiers: 3, color: p.color ?? C.mud }); },

  colosseum(p = {}) {
    const g = G(), c = p.color ?? C.stone;
    const outer = cyl(g, 0.5, 0.5, 0.34, c, 0, 0, 0, 24);
    outer.geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.34, 24, 1, true, 0, Math.PI * 1.55);
    outer.material.side = THREE.DoubleSide;
    cyl(g, 0.44, 0.44, 0.22, c, 0, 0, 0, 24);
    cyl(g, 0.4, 0.4, 0.03, C.sand, 0, 0, 0, 24);
    ringOf(14, 0.485, (x, z, a) => {
      if (a < Math.PI * 1.5) box(g, 0.035, 0.09, 0.035, C.dark, x, 0.2, z);
    });
    g.scale.z = 0.82;
    return g;
  },

  temple(p = {}) {  // Greek temple
    const g = G(), c = p.color ?? C.marble, W = 0.9, D = 0.5;
    box(g, W + 0.16, 0.04, D + 0.16, c); box(g, W + 0.08, 0.04, D + 0.08, c, 0, 0.04);
    const colY = 0.08, colH = 0.3;
    for (let i = 0; i <= 6; i++) {
      const x = -W / 2 + (i / 6) * W;
      cyl(g, 0.035, 0.04, colH, c, x, colY, -D / 2, 8);
      cyl(g, 0.035, 0.04, colH, c, x, colY, D / 2, 8);
    }
    for (const z of [-D / 4, D / 4]) { cyl(g, 0.035, 0.04, colH, c, -W / 2, colY, z, 8); cyl(g, 0.035, 0.04, colH, c, W / 2, colY, z, 8); }
    box(g, W + 0.1, 0.06, D + 0.1, c, 0, colY + colH);
    roof(g, D + 0.14, 0.12, W + 0.14, c, 0, colY + colH + 0.06, 0, Math.PI / 2);
    if (p.ruined) box(g, 0.3, 0.2, 0.1, c, 0, 0.08, 0);
    return g;
  },

  cathedral(p = {}) {
    const g = G(), c = p.color ?? C.stone, towers = p.towers ?? 2, spiky = p.spiky;
    box(g, 0.42, 0.3, 0.85, c, 0, 0, -0.05);
    roof(g, 0.42, 0.14, 0.85, p.roof ?? C.slate, 0, 0.3, -0.05);
    cyl(g, 0.18, 0.18, 0.3, c, 0, 0, -0.5, 10);           // apse
    dome(g, 0.18, p.roof ?? C.slate, 0, 0.3, -0.5, 0.6);
    const tw = spiky ? 0.11 : 0.16, th = spiky ? 0.62 : 0.45;
    for (let i = 0; i < towers; i++) {
      const x = towers === 1 ? 0 : (i % 2 ? 1 : -1) * (0.15 + 0.02 * towers);
      const z = 0.36 + (i > 1 ? -0.72 : 0);
      box(g, tw, th, tw, c, x, 0, z);
      cone(g, tw * 0.75, spiky ? 0.3 : 0.2, p.roof ?? C.slate, x, th, z, spiky ? 8 : 4);
    }
    cyl(g, 0.07, 0.07, 0.02, C.blue, 0, 0.24, 0.392, 12).rotation.x = Math.PI / 2;  // rose window
    if (p.centralSpire) { box(g, 0.1, 0.5, 0.1, c, 0, 0.1, -0.05); cone(g, 0.08, 0.24, p.roof ?? C.slate, 0, 0.6, -0.05, 8); }
    return g;
  },

  bigben(p = {}) {
    const g = G(), c = p.color ?? C.sand;
    box(g, 0.2, 0.78, 0.2, c);
    box(g, 0.24, 0.16, 0.24, c, 0, 0.78);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const cl = cyl(g, 0.075, 0.075, 0.015, C.cream, Math.sin(a) * 0.125, 0.855, Math.cos(a) * 0.125, 16);
      cl.rotation.set(Math.PI / 2, 0, 0); cl.rotation.y = a; cl.position.y = 0.86;
    }
    cone(g, 0.16, 0.14, C.slate, 0, 0.94, 0, 4, Math.PI / 4);
    cone(g, 0.05, 0.14, C.slate, 0, 1.07, 0, 8);
    return g;
  },

  onionchurch(p = {}) {  // St Basil's style cluster
    const g = G(), cols = p.colors ?? [0xc23b2e, 0x2e7dc2, 0x3f9e4f, 0xd9b23a, 0xb35fc2, 0x2ec4a6];
    cyl(g, 0.13, 0.15, 0.55, p.base ?? C.brick, 0, 0, 0, 10);
    onion(g, 0.15, p.gold ? C.gold : cols[3], 0, 0.55);
    ringOf(5, 0.3, (x, z, a) => {
      const h = 0.3 + 0.08 * Math.sin(a * 3);
      cyl(g, 0.075, 0.09, h, C.cream, x, 0, z, 8);
      onion(g, 0.085, p.gold ? C.gold : cols[Math.floor(a * 2) % cols.length], x, h, z);
    });
    box(g, 0.75, 0.08, 0.75, p.base ?? C.brick);
    return g;
  },

  mosque(p = {}) {
    const g = G(), body = p.color ?? C.cream, dm = p.dome ?? C.copper, n = p.minarets ?? 4;
    box(g, 0.6, 0.26, 0.6, body);
    dome(g, 0.26, dm, 0, 0.26, 0, 1.05);
    cone(g, 0.02, 0.08, C.gold, 0, 0.52, 0, 6);
    ringOf(4, 0.38, (x, z) => dome(g, 0.09, dm, x, 0.26, z), Math.PI / 4);
    const mh = p.minaretH ?? 0.72;
    ringOf(n, 0.52, (x, z) => {
      cyl(g, 0.028, 0.035, mh, body, x, 0, z, 8);
      cyl(g, 0.05, 0.05, 0.02, body, x, mh * 0.75, z, 8);
      cone(g, 0.045, 0.1, dm, x, mh, z, 8);
    }, Math.PI / 4);
    return g;
  },

  tajmahal(p = {}) {
    const g = G(), c = p.color ?? C.white;
    box(g, 1.0, 0.07, 1.0, c);
    box(g, 0.46, 0.3, 0.46, c, 0, 0.07);
    box(g, 0.16, 0.24, 0.05, C.slate, 0, 0.1, 0.225);      // iwan portal
    cyl(g, 0.09, 0.09, 0.08, c, 0, 0.37, 0, 12);
    ball(g, 0.16, c, 0, 0.53, 0, 1.15);
    cone(g, 0.03, 0.12, C.gold, 0, 0.66, 0, 6);
    ringOf(4, 0.29, (x, z) => { cyl(g, 0.05, 0.05, 0.1, c, x, 0.37, z, 8); dome(g, 0.06, c, x, 0.47, z); }, Math.PI / 4);
    ringOf(4, 0.62, (x, z) => { cyl(g, 0.025, 0.032, 0.5, c, x, 0.07, z, 8); dome(g, 0.045, c, x, 0.57, z); }, Math.PI / 4);
    return g;
  },

  wat(p = {}) {  // Angkor Wat / prang temples
    const g = G(), c = p.color ?? C.gray;
    const prang = (x, z, s) => {
      let w = 0.16 * s, y = 0;
      for (let i = 0; i < 5; i++) { cyl(g, w * 0.72, w, 0.09 * s, c, x, y, z, 8); y += 0.09 * s; w *= 0.78; }
      cone(g, w, 0.1 * s, c, x, y, z, 8);
    };
    box(g, 1.0, 0.08, 0.75, c);
    box(g, 0.8, 0.08, 0.55, c, 0, 0.08);
    prang(0, 0, 1.6);
    ringOf(4, 0.34, (x, z) => prang(x, z * 0.75, 1.0), Math.PI / 4);
    return g;
  },

  stupa(p = {}) {
    const g = G(), gold = p.color ?? C.gold;
    box(g, 0.7, 0.08, 0.7, p.base ?? C.cream);
    box(g, 0.52, 0.08, 0.52, p.base ?? C.cream, 0, 0.08);
    dome(g, 0.24, gold, 0, 0.16, 0, 1.1);
    box(g, 0.1, 0.06, 0.1, gold, 0, 0.4);
    let r = 0.07, y = 0.46;
    for (let i = 0; i < 6; i++) { cyl(g, r * 0.8, r, 0.045, gold, 0, y, 0, 10); y += 0.045; r *= 0.8; }
    cone(g, 0.025, 0.1, gold, 0, y, 0, 8);
    return g;
  },

  pagoda(p = {}) {
    const g = G(), body = p.color ?? C.red, roofC = p.roof ?? C.slate, tiers = p.tiers ?? 5;
    let w = 0.34, y = 0;
    box(g, 0.5, 0.05, 0.5, C.stone);
    y = 0.05;
    for (let i = 0; i < tiers; i++) {
      box(g, w, 0.13, w, body, 0, y);
      cone(g, w * 0.95, 0.09, roofC, 0, y + 0.13, 0, 4, Math.PI / 4);
      y += 0.19; w *= 0.85;
    }
    cyl(g, 0.012, 0.012, 0.14, C.gold, 0, y - 0.02, 0, 6);
    return g;
  },

  torii(p = {}) {
    const g = G(), red = p.color ?? 0xd6452c;
    cyl(g, 0.035, 0.045, 0.6, red, -0.3, 0, 0, 8);
    cyl(g, 0.035, 0.045, 0.6, red, 0.3, 0, 0, 8);
    box(g, 0.72, 0.05, 0.07, red, 0, 0.5);
    box(g, 0.9, 0.06, 0.09, C.dark, 0, 0.58);
    box(g, 0.07, 0.09, 0.06, red, 0, 0.5 - 0.04, 0);   // strut
    return g;
  },

  liberty(p = {}) {
    const g = G(), cu = p.color ?? C.copper;
    cyl(g, 0.3, 0.36, 0.1, C.stone, 0, 0, 0, 10);
    box(g, 0.3, 0.3, 0.3, C.sand, 0, 0.1);
    cyl(g, 0.09, 0.13, 0.42, cu, 0, 0.4, 0, 9);          // robe
    ball(g, 0.06, cu, 0, 0.86);
    ringOf(7, 0.055, (x, z, a) => { if (Math.sin(a) > -0.3) cone(g, 0.012, 0.07, cu, x * 1.2, 0.9, z * 1.2, 4); });
    const arm = cyl(g, 0.02, 0.025, 0.3, cu, 0.1, 0.78, 0, 6);
    arm.rotation.z = -0.35;
    cyl(g, 0.03, 0.02, 0.05, C.gold, 0.2, 1.02, 0, 6);
    cone(g, 0.025, 0.06, 0xffcf5c, 0.2, 1.07, 0, 6);     // flame
    box(g, 0.06, 0.14, 0.02, cu, -0.12, 0.55, 0.02);     // tablet
    return g;
  },

  christ(p = {}) {
    const g = G(), c = p.color ?? C.concrete;
    cyl(g, 0.09, 0.12, 0.18, c, 0, 0, 0, 8);
    cyl(g, 0.07, 0.1, 0.5, c, 0, 0.18, 0, 8);            // robe
    box(g, 0.72, 0.05, 0.07, c, 0, 0.62);                // outstretched arms
    ball(g, 0.05, c, 0, 0.73);
    return g;
  },

  moai(p = {}) {
    const g = G(), c = p.color ?? 0x8a8578, n = p.count ?? 3;
    box(g, n * 0.4 + 0.2, 0.06, 0.4, 0x6f6a5e);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.4;
      box(g, 0.2, 0.5, 0.18, c, x, 0.06);                // head/torso
      box(g, 0.2, 0.06, 0.06, c, x, 0.42, 0.08);         // brow
      box(g, 0.05, 0.2, 0.05, c, x, 0.2, 0.1);           // nose
    }
    return g;
  },

  castle(p = {}) {
    const g = G(), c = p.color ?? C.stone, roofC = p.roof ?? C.slate, W = 0.7;
    for (const [x, z, w, d] of [[0, -W / 2, W, 0.06], [0, W / 2, W, 0.06], [-W / 2, 0, 0.06, W], [W / 2, 0, 0.06, W]]) {
      box(g, w, 0.22, d, c, x, 0, z);
      merlons(g, 6, Math.max(w, d), c, x, 0.22, z, w > d ? 'x' : 'z');
    }
    ringOf(4, W * 0.68, (x, z) => {
      cyl(g, 0.07, 0.08, 0.34, c, x, 0, z, 8);
      cone(g, 0.085, 0.14, roofC, x, 0.34, z, 8);
    }, Math.PI / 4);
    box(g, 0.26, 0.4, 0.26, c, 0, 0);                    // keep
    roof(g, 0.26, 0.14, 0.26, roofC, 0, 0.4);
    box(g, 0.12, 0.14, 0.04, C.dark, 0, 0, W / 2 + 0.02); // gate
    return g;
  },

  fort(p = {}) {  // Mughal red fort style
    const g = G(), c = p.color ?? 0xa84e35;
    box(g, 1.0, 0.2, 0.5, c);
    merlons(g, 12, 1.0, c, 0, 0.2, 0.25);
    merlons(g, 12, 1.0, c, 0, 0.2, -0.25);
    box(g, 0.24, 0.34, 0.54, c, 0, 0);                   // gate tower
    box(g, 0.1, 0.16, 0.06, C.dark, 0, 0, 0.27);
    for (const x of [-0.09, 0.09]) { cyl(g, 0.035, 0.035, 0.06, c, x, 0.34, 0.18, 8); dome(g, 0.05, C.cream, x, 0.4, 0.18); }
    for (const x of [-0.44, 0.44]) { cyl(g, 0.06, 0.07, 0.28, c, x, 0, 0.22, 8); dome(g, 0.07, C.cream, x, 0.28, 0.22); }
    return g;
  },

  arch(p = {}) {  // triumphal arch
    const g = G(), c = p.color ?? C.stone;
    box(g, 0.18, 0.5, 0.24, c, -0.22, 0);
    box(g, 0.18, 0.5, 0.24, c, 0.22, 0);
    box(g, 0.62, 0.18, 0.24, c, 0, 0.5);
    box(g, 0.5, 0.08, 0.2, c, 0, 0.68);
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.028, 6, 12, Math.PI), mat(c));
    t.position.y = 0.5; g.add(t);
    if (p.statue) box(g, 0.1, 0.12, 0.08, C.copper, 0, 0.76);
    return g;
  },

  obelisk(p = {}) {
    const g = G(), c = p.color ?? C.marble;
    if (p.slim) { cyl(g, 0.008, 0.045, 1.1, C.gray, 0, 0.05, 0, 8); box(g, 0.16, 0.05, 0.16, C.gray); return g; }
    box(g, 0.3, 0.1, 0.3, c);
    cyl(g, 0.055, 0.1, 0.85, c, 0, 0.1, 0, 4, Math.PI / 4);
    cone(g, 0.058, 0.1, p.tip ?? c, 0, 0.95, 0, 4, Math.PI / 4);
    return g;
  },

  skyscraper(p = {}) {
    const g = G(), c = p.color ?? 0x9fb6c9, style = p.style ?? 'box';
    if (style === 'burj') {
      ringOf(3, 0.12, (x, z, a) => { cyl(g, 0.05, 0.07, 0.45 + 0.1 * Math.sin(a), c, x, 0, z, 6); });
      cyl(g, 0.05, 0.07, 0.75, c, 0, 0, 0, 6);
      cyl(g, 0.02, 0.04, 0.3, c, 0, 0.75, 0, 6);
      cyl(g, 0.005, 0.012, 0.25, c, 0, 1.05, 0, 6);
    } else if (style === 'taipei') {
      box(g, 0.2, 0.16, 0.2, c);
      let y = 0.16;
      for (let i = 0; i < 8; i++) { const m = box(g, 0.17, 0.1, 0.17, c, 0, y); m.scale.x = m.scale.z = 1 + 0.001 * i; y += 0.1; }
      box(g, 0.1, 0.06, 0.1, c, 0, y);
      cyl(g, 0.006, 0.012, 0.18, c, 0, y + 0.06, 0, 6);
    } else if (style === 'twin') {
      for (const x of [-0.14, 0.14]) {
        cyl(g, 0.06, 0.08, 0.7, c, x, 0, 0, 8);
        cyl(g, 0.03, 0.05, 0.12, c, x, 0.7, 0, 8);
        cone(g, 0.012, 0.14, c, x, 0.82, 0, 6);
      }
      box(g, 0.16, 0.025, 0.05, c, 0, 0.32);             // skybridge
    } else if (style === 'cyl') {
      cyl(g, 0.09, 0.11, 0.8, c, 0, 0, 0, 10);
      cyl(g, 0.05, 0.09, 0.15, c, 0, 0.8, 0, 10);
    } else {
      box(g, 0.22, 0.55, 0.22, c);
      box(g, 0.16, 0.25, 0.16, c, 0, 0.55);
      box(g, 0.1, 0.15, 0.1, c, 0, 0.8);
      cyl(g, 0.006, 0.012, 0.2, c, 0, 0.95, 0, 6);
    }
    return g;
  },

  cntower(p = {}) {
    const g = G(), c = p.color ?? C.concrete;
    cyl(g, 0.035, 0.09, 0.62, c, 0, 0, 0, 8);
    cyl(g, 0.09, 0.07, 0.09, c, 0, 0.62, 0, 10);         // pod
    cyl(g, 0.03, 0.03, 0.1, c, 0, 0.71, 0, 8);
    cyl(g, 0.006, 0.012, 0.3, c, 0, 0.81, 0, 6);         // antenna
    return g;
  },

  opera(p = {}) {
    const g = G(), c = p.color ?? C.white;
    box(g, 1.0, 0.08, 0.55, 0xd8c9a8);
    const shell = (x, z, s, ry, tilt) => {
      const geo = new THREE.SphereGeometry(s, 12, 8, 0, Math.PI * 0.9, 0, Math.PI / 2);
      const m = new THREE.Mesh(geo, mat(c, { side: THREE.DoubleSide }));
      m.position.set(x, 0.08, z); m.rotation.set(tilt, ry, 0); g.add(m);
    };
    shell(-0.28, -0.08, 0.3, Math.PI, -0.5);
    shell(-0.02, -0.08, 0.26, Math.PI, -0.6);
    shell(0.2, -0.08, 0.2, Math.PI, -0.7);
    shell(0.05, 0.16, 0.17, 0, 0.55);
    shell(0.28, 0.16, 0.14, 0, 0.65);
    return g;
  },

  windmill(p = {}) {
    const g = G(), body = p.color ?? 0x7a4a2b;
    cyl(g, 0.1, 0.16, 0.45, body, 0, 0, 0, 8);
    dome(g, 0.105, C.dark, 0, 0.45);
    for (let i = 0; i < 4; i++) {
      const b = box(g, 0.045, 0.34, 0.01, C.cream, 0, 0.31, 0.12);
      b.position.y = 0.47; b.rotation.z = (i * Math.PI) / 2 + Math.PI / 4;
      b.translateY(0.19);
    }
    return g;
  },

  greatwall(p = {}) {
    const g = G(), c = p.color ?? 0x9a8f78;
    const seg = (x, ry) => {
      const b = box(g, 0.45, 0.16, 0.12, c, x, 0.02, 0, ry);
      merlons(g, 6, 0.4, c, x, 0.18, 0, 'x');
      return b;
    };
    seg(-0.34, 0.18); seg(0, 0); seg(0.34, -0.18);
    for (const x of [-0.55, 0.55]) { box(g, 0.14, 0.3, 0.16, c, x, 0); box(g, 0.16, 0.05, 0.18, C.terra, x, 0.3); }
    return g;
  },

  stonehenge(p = {}) {
    const g = G(), c = p.color ?? C.gray;
    cyl(g, 0.55, 0.55, 0.02, 0x4d7a45, 0, 0, 0, 20);
    ringOf(6, 0.36, (x, z, a) => {
      if (a > Math.PI * 1.7) return;                      // leave the ring broken
      const ry = a + Math.PI / 2;
      box(g, 0.1, 0.26, 0.06, c, x - Math.sin(ry) * 0.06, 0.02, z - Math.cos(ry) * 0.06, ry);
      box(g, 0.1, 0.26, 0.06, c, x + Math.sin(ry) * 0.06, 0.02, z + Math.cos(ry) * 0.06, ry);
      box(g, 0.26, 0.06, 0.08, c, x, 0.28, z, ry);
    });
    return g;
  },

  bridge(p = {}) {  // stone arch bridge
    const g = G(), c = p.color ?? C.stone;
    const d1 = box(g, 0.5, 0.05, 0.16, c, -0.22, 0.28); d1.rotation.z = 0.35;
    const d2 = box(g, 0.5, 0.05, 0.16, c, 0.22, 0.28); d2.rotation.z = -0.35;
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 6, 14, Math.PI), mat(c));
    t.position.y = 0.1; g.add(t);
    box(g, 0.1, 0.3, 0.18, c, -0.48, 0); box(g, 0.1, 0.3, 0.18, c, 0.48, 0);
    return g;
  },

  atomium(p = {}) {
    const g = G(), c = p.color ?? 0xb9c4cf, R = 0.32, r = 0.09;
    const pts = [[0, 0, 0], [R, R, R], [R, R, -R], [-R, R, R], [-R, R, -R], [R, -R, R], [R, -R, -R], [-R, -R, R], [-R, -R, -R]];
    const lift = R + r + 0.05;
    for (const [x, y, z] of pts) ball(g, r, c, x, y + lift, z, 1, 10);
    for (let i = 1; i < pts.length; i++) {
      const [x, y, z] = pts[i];
      const tube = cyl(g, 0.018, 0.018, Math.sqrt(x * x + y * y + z * z), c, x / 2, y / 2 + lift, z / 2, 6);
      tube.position.y = y / 2 + lift;
      tube.lookAt(new THREE.Vector3(0, lift, 0));
      tube.rotateX(Math.PI / 2);
    }
    cyl(g, 0.02, 0.03, lift - r, c, 0, 0, 0, 6);
    return g;
  },

  capitolDome(p = {}) {  // domed basilica / parliament
    const g = G(), c = p.color ?? C.white, dm = p.dome ?? c;
    box(g, 0.9, 0.2, 0.42, c);
    box(g, 0.34, 0.1, 0.46, c, 0, 0.2);
    cyl(g, 0.17, 0.17, 0.16, c, 0, 0.3, 0, 14);
    ringOf(10, 0.185, (x, z) => cyl(g, 0.012, 0.012, 0.16, c, x, 0.3, z, 6));
    dome(g, 0.17, dm, 0, 0.46, 0, 1.15);
    cyl(g, 0.03, 0.03, 0.06, c, 0, 0.63, 0, 8);
    cone(g, 0.02, 0.06, dm, 0, 0.69, 0, 8);
    for (let i = 0; i < 6; i++) cyl(g, 0.014, 0.014, 0.2, c, -0.25 + i * 0.1, 0.2, 0.2, 6);
    roof(g, 0.14, 0.05, 0.6, c, 0, 0.3, 0.02, Math.PI / 2);
    return g;
  },

  palace(p = {}) {
    const g = G(), c = p.color ?? C.cream, roofC = p.roof ?? C.slate;
    box(g, 0.6, 0.22, 0.3, c);
    roof(g, 0.3, 0.1, 0.6, roofC, 0, 0.22, 0, Math.PI / 2);
    for (const x of [-0.42, 0.42]) { box(g, 0.24, 0.28, 0.34, c, x, 0); roof(g, 0.34, 0.12, 0.24, roofC, x, 0.28, 0, Math.PI / 2); }
    for (let i = 0; i < 5; i++) cyl(g, 0.013, 0.013, 0.16, C.white, -0.16 + i * 0.08, 0.02, 0.16, 6);
    box(g, 0.2, 0.06, 0.06, c, 0, 0.24, 0.14);
    return g;
  },

  hut(p = {}) {  // grand thatched royal hut
    const g = G(), straw = p.color ?? 0xc9a86a;
    cyl(g, 0.28, 0.3, 0.16, 0xa08050, 0, 0, 0, 12);
    cone(g, 0.42, 0.4, straw, 0, 0.12, 0, 12);
    box(g, 0.1, 0.13, 0.04, C.dark, 0, 0, 0.29);
    cyl(g, 0.5, 0.5, 0.02, 0x8a6a44, 0, 0, 0, 16);
    return g;
  },

  lighthouse(p = {}) {  // banded tower / standalone minaret
    const g = G(), a = p.color ?? C.brick, b = p.band ?? C.cream;
    let y = 0, r = 0.11;
    for (let i = 0; i < 4; i++) { cyl(g, r - 0.012, r, 0.2, i % 2 ? b : a, 0, y, 0, 10); y += 0.2; r -= 0.012; }
    cyl(g, 0.1, 0.1, 0.025, C.dark, 0, y, 0, 10);
    cyl(g, 0.05, 0.05, 0.09, 0xffe9a3, 0, y + 0.025, 0, 8);
    dome(g, 0.06, p.top ?? C.dark, 0, y + 0.115);
    return g;
  },

  ruin(p = {}) {  // ancient ruins / broken colonnade
    const g = G(), c = p.color ?? C.sand;
    box(g, 0.8, 0.06, 0.4, c);
    const hs = [0.34, 0.18, 0.3, 0.1, 0.26, 0.34];
    hs.forEach((h, i) => cyl(g, 0.035, 0.045, h, c, -0.3 + i * 0.12, 0.06, -0.1, 8));
    box(g, 0.4, 0.05, 0.12, c, -0.12, 0.4, -0.1);
    const fallen = cyl(g, 0.035, 0.045, 0.3, c, 0.1, 0.035, 0.12, 8);
    fallen.rotation.z = Math.PI / 2;
    if (p.tower) cyl(g, 0.1, 0.13, 0.35, 0x7d7465, 0.32, 0.06, 0.05, 10);  // Great Zimbabwe cone tower
    return g;
  },

  machu(p = {}) {  // terraced citadel + peak
    const g = G();
    cone(g, 0.3, 0.75, 0x4c7a52, 0, 0.05, -0.32, 7);      // Huayna Picchu backdrop
    let w = 0.85;
    for (let i = 0; i < 5; i++) { box(g, w, 0.06, 0.5 - i * 0.06, i % 2 ? 0x5d8a5e : 0x6d9a6a, 0, i * 0.06, 0.05); w *= 0.87; }
    for (const [x, z] of [[-0.15, 0.1], [0.08, 0.16], [0.2, 0.02]]) {
      box(g, 0.1, 0.07, 0.08, C.stone, x, 0.3, z);
      roof(g, 0.1, 0.05, 0.08, 0xc9a86a, x, 0.37, z);
    }
    return g;
  },

  mudmosque(p = {}) {  // Djenné style
    const g = G(), c = p.color ?? C.mud;
    box(g, 0.7, 0.05, 0.55, c);
    box(g, 0.62, 0.26, 0.4, c, 0, 0.05, -0.04);
    for (const x of [-0.2, 0, 0.2]) {
      cyl(g, 0.05, 0.075, 0.4, c, x, 0.05, 0.18, 4, Math.PI / 4);
      ball(g, 0.028, c, x, 0.47, 0.18);
    }
    for (let i = 0; i < 6; i++) cone(g, 0.014, 0.06, c, -0.25 + i * 0.1, 0.31, -0.04, 4);
    return g;
  },

  madrasa(p = {}) {  // Registan style portal + blue dome
    const g = G(), c = p.color ?? C.sand, blue = p.dome ?? 0x2e9ec4;
    box(g, 0.7, 0.42, 0.1, c);                            // pishtaq facade
    box(g, 0.26, 0.32, 0.04, 0x1d5e80, 0, 0, 0.05);       // arch inset
    box(g, 0.6, 0.18, 0.4, c, 0, 0, -0.25);
    cyl(g, 0.11, 0.11, 0.1, c, -0.18, 0.18, -0.25, 10);
    ball(g, 0.13, blue, -0.18, 0.36, -0.25, 1.15);
    for (const x of [-0.38, 0.38]) { cyl(g, 0.045, 0.055, 0.5, c, x, 0, 0, 8); dome(g, 0.055, blue, x, 0.5, 0); }
    return g;
  },

  gate(p = {}) {  // Brandenburg style
    const g = G(), c = p.color ?? C.stone;
    box(g, 0.8, 0.06, 0.26, c);
    for (let i = 0; i < 6; i++) box(g, 0.07, 0.36, 0.2, c, -0.3 + i * 0.12, 0.06);
    box(g, 0.84, 0.1, 0.26, c, 0, 0.42);
    box(g, 0.5, 0.1, 0.22, c, 0, 0.52);
    box(g, 0.16, 0.09, 0.1, C.copper, 0, 0.62);           // quadriga
    return g;
  },

  hallgrimskirkja(p = {}) {
    const g = G(), c = p.color ?? C.concrete;
    for (let i = 0; i < 6; i++) {
      const h = 0.14 + i * 0.075, off = 0.36 - i * 0.058;
      box(g, 0.055, h, 0.2, c, -off, 0);
      box(g, 0.055, h, 0.2, c, off, 0);
    }
    box(g, 0.14, 0.62, 0.2, c, 0, 0);
    cone(g, 0.09, 0.12, c, 0, 0.62, 0, 4, Math.PI / 4);
    box(g, 0.3, 0.16, 0.5, c, 0, 0, -0.3);
    roof(g, 0.3, 0.08, 0.5, c, 0, 0.16, -0.3);
    return g;
  },

  mbs(p = {}) {  // Marina Bay Sands
    const g = G(), c = p.color ?? 0xbfcdd6;
    for (const x of [-0.26, 0, 0.26]) {
      const t = box(g, 0.14, 0.55, 0.1, c, x, 0);
      t.rotation.z = x === 0 ? 0 : (x < 0 ? -0.06 : 0.06);
    }
    const deck = box(g, 0.78, 0.045, 0.14, C.cream, 0, 0.555);
    deck.rotation.z = 0.0;
    cyl(g, 0.07, 0.07, 0.045, C.cream, -0.41, 0.555, 0, 10).rotation.z = Math.PI / 2;
    box(g, 0.1, 0.02, 0.1, 0x69c99e, 0, 0.6);            // skypark trees
    return g;
  },

  orbtower(p = {}) {  // Bayterek / Kuwait Towers style
    const g = G(), c = p.color ?? C.white, orb = p.orb ?? C.gold;
    const n = p.count ?? 1;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.3;
      cyl(g, 0.02, 0.05, 0.6 - i * 0.12, c, x, 0, 0, 8);
      ball(g, 0.11 - i * 0.02, orb, x, 0.6 - i * 0.12, 0, 1, 10);
      cone(g, 0.012, 0.15, c, x, 0.66 - i * 0.12, 0, 6);
    }
    return g;
  },

  lalibela(p = {}) {  // rock-hewn cross church, seen sunken in stone
    const g = G(), rock = 0xb0705a, c = p.color ?? 0xc98668;
    box(g, 1.0, 0.08, 1.0, rock);
    const s = new THREE.Shape(), a = 0.12, b = 0.34;
    s.moveTo(-a, -b); s.lineTo(a, -b); s.lineTo(a, -a); s.lineTo(b, -a); s.lineTo(b, a);
    s.lineTo(a, a); s.lineTo(a, b); s.lineTo(-a, b); s.lineTo(-a, a); s.lineTo(-b, a);
    s.lineTo(-b, -a); s.lineTo(-a, -a); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: false });
    const m = new THREE.Mesh(geo, mat(c));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.08; g.add(m);
    return g;
  },

  monument(p = {}) {  // generic national monument: plinth + spire
    const g = G(), c = p.color ?? C.marble;
    cyl(g, 0.3, 0.36, 0.08, c, 0, 0, 0, 10);
    box(g, 0.24, 0.12, 0.24, c, 0, 0.08);
    cyl(g, 0.02, 0.07, 0.7, c, 0, 0.2, 0, 4, Math.PI / 4);
    ball(g, 0.05, p.orb ?? C.gold, 0, 0.94, 0, 1, 10);
    return g;
  }
};

export const builderKeys = Object.keys(BUILDERS);

/** Build a monument by archetype key; returns a group normalized so height ≈ 1
 *  (wide, flat monuments are clamped by footprint instead), base at y = 0. */
export function buildMonument(key, params) {
  const fn = BUILDERS[key] || BUILDERS.monument;
  const inner = fn(params || {});
  const bb = new THREE.Box3().setFromObject(inner);
  const h = Math.max(bb.max.y - bb.min.y, 0.001);
  const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
  const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
  inner.position.set(-cx, -bb.min.y, -cz);
  const wrap = new THREE.Group();
  wrap.add(inner);
  wrap.scale.setScalar(1 / Math.max(h, w / 1.15, d / 1.15));
  const out = new THREE.Group();  // outer group: safe for callers to scale/rotate
  out.add(wrap);
  return out;
}
