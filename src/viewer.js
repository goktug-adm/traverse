// Full-screen 3D monument viewer: its own little scene with orbit controls.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildMonument } from './monuments/builders.js';

const modal = document.getElementById('viewer-modal');
const canvasHost = document.getElementById('viewer-canvas');
const titleEl = document.getElementById('viewer-title');
const subEl = document.getElementById('viewer-sub');

let renderer, scene, camera, controls, raf = null;

function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasHost.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1020);
  scene.fog = new THREE.Fog(0x0a1020, 8, 16);

  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(2.6, 1.7, 2.6);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.4;
  controls.minDistance = 1.2;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.target.set(0, 0.5, 0);

  scene.add(new THREE.HemisphereLight(0xcfe5ff, 0x2a2418, 0.9));
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
  sun.position.set(4, 6, 3);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x4cc9f0, 0.5);
  rim.position.set(-4, 2, -4);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 40),
    new THREE.MeshStandardMaterial({ color: 0x152238, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  scene.add(ground);

  const grid = new THREE.PolarGridHelper(6, 12, 8, 48, 0x27405f, 0x1b2c46);
  grid.position.y = 0.001;
  scene.add(grid);
}

function resize() {
  if (!renderer) return;
  const w = canvasHost.clientWidth, h = canvasHost.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function loop() {
  raf = requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
}

let current = null;

export function openViewer(entry, countryName) {
  if (!renderer) setup();
  if (current) { scene.remove(current); current = null; }

  current = buildMonument(entry.b, entry.p);
  current.scale.setScalar(1.6);  // normalized height 1 -> 1.6 units tall
  scene.add(current);

  titleEl.textContent = `${entry.n}`;
  subEl.textContent = [entry.city, countryName].filter(Boolean).join(' · ') +
    (entry.curated === false ? ' · generic landmark (no curated model yet)' : '');

  modal.classList.remove('hidden');
  resize();
  camera.position.set(2.6, 1.7, 2.6);
  controls.target.set(0, 0.7, 0);
  controls.autoRotate = true;
  if (!raf) loop();
}

export function closeViewer() {
  modal.classList.add('hidden');
  if (raf) { cancelAnimationFrame(raf); raf = null; }
}

document.getElementById('viewer-close').addEventListener('click', closeViewer);
modal.addEventListener('click', e => { if (e.target === modal) closeViewer(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeViewer(); });
window.addEventListener('resize', () => { if (!modal.classList.contains('hidden')) resize(); });
