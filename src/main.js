import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import './style.css';
import Globe from 'globe.gl';
import * as THREE from 'three';
import * as topojson from 'topojson-client';

import worldTopo from 'world-atlas/countries-110m.json';
import countryMeta from './data/countries.json';
import cityRows from './data/cities.json';

import { store } from './state.js';
import { buildMonument } from './monuments/builders.js';
import { monumentFor, featuredCodes, curatedCodes } from './monuments/catalog.js';
import { buildCity } from './citybuildings.js';
import { openViewer } from './viewer.js';

/* ================= data wiring ================= */

// Some 110m features have no ISO numeric id — patch the well-known ones by name.
const NAME_FIXES = {
  Kosovo: { a2: 'XK', name: 'Kosovo', capital: 'Pristina', region: 'Europe', sub: 'Southeast Europe', flag: '🇽🇰', lat: 42.6, lon: 21, area: 10887 },
  'N. Cyprus': { a2: 'CY-N', name: 'Northern Cyprus', capital: 'North Nicosia', region: 'Asia', sub: 'Western Asia', flag: '🇨🇾', lat: 35.3, lon: 33.5, area: 3355 },
  Somaliland: { a2: 'SO-L', name: 'Somaliland', capital: 'Hargeisa', region: 'Africa', sub: 'Eastern Africa', flag: '🇸🇴', lat: 9.5, lon: 46, area: 176120 }
};

const NON_DECOMPOSABLE = {
  'ı': 'i', 'İ': 'I', 'ø': 'o', 'Ø': 'O', 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D',
  'ß': 'ss', 'æ': 'ae', 'Æ': 'AE', 'œ': 'oe', 'Œ': 'OE', 'ð': 'd', 'þ': 'th', 'Þ': 'Th'
};
const latinize = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[ıİøØłŁđĐßæÆœŒðþÞ]/g, ch => NON_DECOMPOSABLE[ch] || ch);

const features = topojson.feature(worldTopo, worldTopo.objects.countries).features;

// country records: one per polygon feature
const countries = features.map(f => {
  const meta = countryMeta[f.id] || NAME_FIXES[f.properties.name] ||
    { a2: 'X-' + f.properties.name, name: f.properties.name, capital: '', region: '', sub: '', flag: '🏳️', lat: 0, lon: 0, area: 0 };
  return { feature: f, a2: meta.a2, meta, name: meta.name };
}).filter(r => r.name !== 'Antarctica' || true);

const byA2 = new Map(countries.map(r => [r.a2, r]));
const featureToRec = new Map(countries.map(r => [r.feature, r]));

// cities grouped by country code
const citiesBy = new Map();
for (const c of cityRows) {
  if (!citiesBy.has(c.c)) citiesBy.set(c.c, []);
  citiesBy.get(c.c).push(c);
}

function capitalCoords(a2, meta) {
  const cap = (citiesBy.get(a2) || []).find(c => c.cap);
  if (cap) return { la: cap.la, lo: cap.lo };
  return { la: meta.lat, lo: meta.lon };
}

function monumentDatumFor(rec) {
  const entry = monumentFor(rec.a2, rec.meta);
  const pos = (entry.la != null) ? { la: entry.la, lo: entry.lo } : capitalCoords(rec.a2, rec.meta);
  return { type: 'monument', a2: rec.a2, entry, lat: pos.la, lng: pos.lo, country: rec.name };
}
const monDatumCache = new Map();
const monDatum = rec => {
  if (!monDatumCache.has(rec.a2)) monDatumCache.set(rec.a2, monumentDatumFor(rec));
  return monDatumCache.get(rec.a2);
};

/* ================= ui state ================= */

let selected = null;        // country record
let hovered = null;
let showMonuments = true;
let showAllMonuments = false;
let addPlaceArmed = false;
let pendingPlace = null;    // { lat, lng, a2 }
let pov = { lat: 35, lng: 25, altitude: 2.3 };   // current camera point-of-view

// Level-of-detail: what appears as you zoom in
const LOD = {
  curated: 1.8,   // below this altitude, curated monuments in view appear
  all: 0.9,       // below this, every country's monument in view appears
  cities: 0.55,   // below this, 3D city skylines appear
  maxCities: 70
};

// angular distance in degrees between two lat/lng points
function angDist(lat1, lng1, lat2, lng2) {
  const d2r = Math.PI / 180;
  const s = Math.sin((lat2 - lat1) * d2r / 2) ** 2 +
    Math.cos(lat1 * d2r) * Math.cos(lat2 * d2r) * Math.sin((lng2 - lng1) * d2r / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(s))) / d2r;
}
// how much of the globe (in degrees from center) is worth populating at this altitude
const viewRadius = alt => Math.min(110, 18 + alt * 55);

/* ================= globe ================= */

const starsUrl = makeStars();

const globe = new Globe(document.getElementById('globe'))
  .backgroundImageUrl(starsUrl)
  .showAtmosphere(true)
  .atmosphereColor('#4cc9f0')
  .atmosphereAltitude(0.17)
  .showGraticules(true)
  .polygonsData(features)
  .polygonGeoJsonGeometry(f => f.geometry)
  .polygonCapColor(f => capColor(f))
  .polygonSideColor(() => 'rgba(50, 84, 140, 0.4)')
  .polygonStrokeColor(() => 'rgba(160, 198, 255, 0.45)')
  .polygonAltitude(f => (selected && f === selected.feature ? 0.02 : 0.008))
  .polygonsTransitionDuration(250)
  .polygonLabel(f => {
    const r = featureToRec.get(f);
    const v = store.isCountryVisited(r.a2);
    const cv = store.citiesVisitedIn(r.a2);
    return `<div class="globe-tooltip"><b>${r.meta.flag} ${r.name}</b>
      <div class="t-sub">${[r.meta.sub, r.meta.capital && 'Capital: ' + r.meta.capital].filter(Boolean).join(' · ')}</div>
      ${v ? `<div class="t-visited">✓ visited${cv ? ` · ${cv} cit${cv > 1 ? 'ies' : 'y'}` : ''}</div>` : ''}</div>`;
  })
  .onPolygonHover(f => {
    hovered = f;
    document.body.style.cursor = f ? 'pointer' : addPlaceArmed ? 'crosshair' : 'grab';
    globe.polygonCapColor(x => capColor(x));
  })
  .onPolygonClick((f, ev, coords) => {
    if (addPlaceArmed) return beginPlace(coords.lat, coords.lng, featureToRec.get(f).a2);
    selectCountry(featureToRec.get(f));
  })
  .onGlobeClick(({ lat, lng }) => {
    if (addPlaceArmed) return beginPlace(lat, lng, '');
    if (selected) { selected = null; refreshAll(); }
  })
  .objectLat('lat').objectLng('lng')
  .objectAltitude(() => 0.0095)
  .objectThreeObject(d => makeObject3D(d))
  .objectLabel(d => {
    if (d.type === 'monument')
      return `<div class="globe-tooltip"><b>🏛️ ${d.entry.n}</b><div class="t-sub">${[d.entry.city, d.country].filter(Boolean).join(', ')} — click to view in 3D</div></div>`;
    if (d.type === 'city')
      return `<div class="globe-tooltip"><b>🏙️ ${d.city.n}</b><div class="t-sub">${d.city.cap ? 'Capital · ' : ''}${fmtPop(d.city.p)} people — click to open country</div>${store.isCityVisited(d.city.c, d.city.n) ? '<div class="t-visited">✓ visited</div>' : ''}</div>`;
    return `<div class="globe-tooltip"><b>📍 ${d.place.name}</b><div class="t-sub">${'★'.repeat(d.place.rating || 0)}${d.place.notes ? ' · ' + d.place.notes : ''}</div></div>`;
  })
  .onObjectClick(d => {
    if (d.type === 'monument') openViewer(d.entry, d.country);
    else if (d.type === 'city') { const r = byA2.get(d.city.c); if (r) selectCountry(r, false); flyTo(d.city.la, d.city.lo, 0.25); }
    else if (d.place.a2 && byA2.has(d.place.a2)) selectCountry(byA2.get(d.place.a2));
  })
  .labelLat('la').labelLng('lo')
  .labelText(c => latinize(c.n))   // the 3D label font only has basic latin glyphs
  .labelSize(c => (c.cap ? 0.62 : 0.45))
  .labelDotRadius(c => (c.cap ? 0.28 : 0.2))
  .labelAltitude(0.012)
  .labelColor(c => store.isCityVisited(c.c, c.n) ? '#2ec4a6' : c.cap ? '#f7b32b' : '#dce6f5')
  .labelLabel(c => `<div class="globe-tooltip"><b>${c.n}</b><div class="t-sub">${c.cap ? 'Capital · ' : ''}${fmtPop(c.p)} people — click to toggle visited</div></div>`)
  .onLabelClick(c => { store.toggleCity(c.c, c.n); refreshAll(); });

globe.globeMaterial().color = new THREE.Color(0x0d2036);
globe.globeMaterial().emissive = new THREE.Color(0x081a30);
globe.globeMaterial().emissiveIntensity = 0.42;

globe.pointOfView({ lat: 35, lng: 25, altitude: 2.3 }, 0);
globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.4;
globe.controls().addEventListener('start', () => { globe.controls().autoRotate = false; });

// LOD: re-evaluate which 3D objects exist as the camera moves/zooms
let lodTimer = null;
globe.onZoom(p => {
  pov = p;
  applyZoomScale();
  if (!lodTimer) lodTimer = setTimeout(() => { lodTimer = null; refreshObjects(); }, 300);
});

function capColor(f) {
  const r = featureToRec.get(f);
  const isSel = selected && f === selected.feature;
  const isHov = f === hovered;
  if (isSel) return 'rgba(76, 201, 240, 0.78)';
  if (store.isCountryVisited(r.a2)) return isHov ? 'rgba(46, 230, 184, 0.95)' : 'rgba(46, 220, 178, 0.72)';
  return isHov ? 'rgba(130, 170, 230, 0.62)' : 'rgba(74, 100, 145, 0.45)';
}

function makeStars() {
  const cv = document.createElement('canvas');
  cv.width = 2048; cv.height = 1024;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#030614';
  ctx.fillRect(0, 0, cv.width, cv.height);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * cv.width, y = Math.random() * cv.height;
    const r = Math.random() * 1.3 + 0.2, a = Math.random() * 0.8 + 0.2;
    ctx.fillStyle = `rgba(${200 + Math.random() * 55 | 0}, ${210 + Math.random() * 45 | 0}, 255, ${a})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 5; i++) {  // faint nebulae
    const x = Math.random() * cv.width, y = Math.random() * cv.height, r = 120 + Math.random() * 200;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(76, 120, 240, 0.05)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return cv.toDataURL();
}

/* ---------- 3D objects on the globe ---------- */

const MON_SCALE = 3.6;

function orient(obj, lat, lng, alt) {
  const p = globe.getCoords(lat, lng, alt || 0);
  const normal = new THREE.Vector3(p.x, p.y, p.z).normalize();
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  return obj;
}

// monuments shrink a little as you fly closer, so they don't dwarf the cities
const zoomFactor = () => THREE.MathUtils.clamp(0.5 + pov.altitude * 0.42, 0.6, 1.12);

function makeObject3D(d) {
  let g;
  if (d.type === 'monument') {
    g = buildMonument(d.entry.b, d.entry.p);
    d.__base = d.entry.f ? MON_SCALE * 1.15 : MON_SCALE;
    g.scale.setScalar(d.__base * zoomFactor());
  } else if (d.type === 'city') {
    g = buildCity(d.city);
    d.__base = null;
  } else {
    // place pin
    g = new THREE.Group();
    const c = 0xf7b32b;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.03, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8edf7, roughness: 0.6 }));
    stick.position.y = 0.8;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.4 }));
    head.position.y = 1.9;
    g.add(stick, head);
  }
  d.__obj = g;
  return orient(g, d.lat, d.lng);
}

let currentObjects = [];
function applyZoomScale() {
  const f = zoomFactor();
  for (const d of currentObjects) {
    if (d.type === 'monument' && d.__obj && d.__base) d.__obj.scale.setScalar(d.__base * f);
  }
}

const pinDatumCache = new Map();
function pinDatum(place) {
  if (!pinDatumCache.has(place.id)) {
    pinDatumCache.set(place.id, { type: 'pin', place, lat: place.lat, lng: place.lon });
  }
  return pinDatumCache.get(place.id);
}

const cityDatumCache = new Map();
function cityDatum(c) {
  const k = c.c + '|' + c.n;
  if (!cityDatumCache.has(k)) cityDatumCache.set(k, { type: 'city', city: c, lat: c.la, lng: c.lo });
  return cityDatumCache.get(k);
}

function refreshObjects() {
  const data = [];
  const alt = pov.altitude, radius = viewRadius(alt);
  const inView = (la, lo) => angDist(pov.lat, pov.lng, la, lo) < radius;

  if (showMonuments) {
    const codes = new Set(featuredCodes);
    if (showAllMonuments || alt < LOD.all) {
      for (const r of countries) codes.add(r.a2);
    } else if (alt < LOD.curated) {
      for (const c of curatedCodes) codes.add(c);
    }
    for (const code of codes) {
      const r = byA2.get(code);
      if (!r) continue;
      const d = monDatum(r);
      if (d.entry.f || showAllMonuments || inView(d.lat, d.lng)) data.push(d);
    }
    if (selected && !data.includes(monDatum(selected))) data.push(monDatum(selected));
  } else if (selected) {
    data.push(monDatum(selected));
  }

  // 3D city skylines fade in when you fly close
  if (alt < LOD.cities) {
    const near = [];
    for (const c of cityRows) {
      const dist = angDist(pov.lat, pov.lng, c.la, c.lo);
      if (dist < radius) near.push([dist, c]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (const [, c] of near.slice(0, LOD.maxCities)) data.push(cityDatum(c));
  }

  for (const p of store.get().places) data.push(pinDatum(p));
  const sel = selected;
  globe.objectAltitude(d => (sel && d.a2 === sel.a2 && d.type === 'monument') ? 0.021 : 0.0095);
  currentObjects = data;
  globe.objectsData(data);
}

function refreshLabels() {
  globe.labelsData(selected ? (citiesBy.get(selected.a2) || []) : []);
  globe.labelColor(c => store.isCityVisited(c.c, c.n) ? '#2ec4a6' : c.cap ? '#f7b32b' : '#dce6f5');
}

function refreshPolygons() {
  globe.polygonCapColor(f => capColor(f));
  globe.polygonAltitude(f => (selected && f === selected.feature ? 0.02 : 0.008));
}

/* ================= selection & flight ================= */

function selectCountry(rec, fly = true) {
  selected = rec;
  if (fly) {
    const alt = Math.min(2.2, Math.max(0.45, Math.sqrt((rec.meta.area || 100000) / 900000)));
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: rec.meta.lat, lng: rec.meta.lon, altitude: alt }, 950);
  }
  refreshAll();
}

function flyTo(lat, lng, altitude = 0.5, ms = 900) {
  globe.controls().autoRotate = false;
  globe.pointOfView({ lat, lng, altitude }, ms);
}

/* ================= top bar ================= */

const statsEl = document.getElementById('stats');
function renderStats() {
  const s = store.stats(countries.length);
  statsEl.innerHTML = `
    <div class="stat"><b>${s.visited}</b><span>countries</span></div>
    <div class="stat"><b>${s.cities}</b><span>cities</span></div>
    <div class="stat"><b>${s.places}</b><span>places</span></div>
    <div class="stat progress"><b>${s.pct}%</b><span>of the world</span>
      <div class="bar"><i style="width:${s.pct}%"></i></div>
    </div>`;
}

const searchInput = document.getElementById('search');
const dl = document.getElementById('country-list');
dl.innerHTML = countries
  .map(r => r.name).sort()
  .map(n => `<option value="${n.replace(/"/g, '&quot;')}"></option>`).join('');
const fold = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const ALIASES = {
  turkey: 'TR', turkiye: 'TR', uk: 'GB', england: 'GB', usa: 'US', america: 'US',
  uae: 'AE', holland: 'NL', burma: 'MM', 'ivory coast': 'CI', 'cape verde': 'CV'
};
searchInput.addEventListener('change', () => {
  const q = fold(searchInput.value.trim());
  if (!q) return;
  const rec = (ALIASES[q] && byA2.get(ALIASES[q])) ||
    countries.find(r => fold(r.name) === q) ||
    countries.find(r => fold(r.name).startsWith(q)) ||
    countries.find(r => fold(r.name).includes(q)) ||
    countries.find(r => r.meta.capital && fold(r.meta.capital) === q);
  if (rec) { selectCountry(rec); searchInput.blur(); }
});

/* ================= toolbar ================= */

const btnAdd = document.getElementById('btn-add-place');
const btnMon = document.getElementById('btn-monuments');
const btnAll = document.getElementById('btn-all-monuments');

function setArmedUI() {
  btnAdd.classList.toggle('armed', addPlaceArmed);
  btnAdd.querySelector('span').textContent = addPlaceArmed ? '🎯' : '📍';
  btnAdd.dataset.tip = addPlaceArmed ? 'Now click the globe to drop your pin…' : 'Add a place — click the globe to drop a pin';
  document.body.style.cursor = addPlaceArmed ? 'crosshair' : 'grab';
}
btnAdd.addEventListener('click', () => { addPlaceArmed = !addPlaceArmed; setArmedUI(); });
btnMon.addEventListener('click', () => {
  showMonuments = !showMonuments;
  btnMon.classList.toggle('active', showMonuments);
  refreshObjects();
});
btnAll.addEventListener('click', () => {
  showAllMonuments = !showAllMonuments;
  btnAll.classList.toggle('active', showAllMonuments);
  if (showAllMonuments && !showMonuments) { showMonuments = true; btnMon.classList.add('active'); }
  refreshObjects();
});

document.getElementById('btn-export').addEventListener('click', () => {
  const blob = new Blob([store.export()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'traverse-travels.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
const importFile = document.getElementById('import-file');
document.getElementById('btn-import').addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const f = importFile.files[0];
  if (!f) return;
  try {
    store.import(await f.text());
    pinDatumCache.clear();
    refreshAll();
  } catch (e) { alert('Could not import: ' + e.message); }
  importFile.value = '';
});

/* ================= place modal ================= */

const placeModal = document.getElementById('place-modal');
const placeForm = document.getElementById('place-form');
const starsBox = document.getElementById('place-stars');
let placeRating = 4;

function renderStars() {
  starsBox.innerHTML = [1, 2, 3, 4, 5]
    .map(i => `<span data-i="${i}" class="${i <= placeRating ? 'on' : ''}">★</span>`).join('');
}
starsBox.addEventListener('click', e => {
  const i = +e.target.dataset?.i;
  if (i) { placeRating = i; renderStars(); }
});

function beginPlace(lat, lng, a2) {
  pendingPlace = { lat, lng, a2 };
  addPlaceArmed = false;
  setArmedUI();
  placeRating = 4; renderStars();
  placeForm.reset();
  const cname = a2 && byA2.has(a2) ? byA2.get(a2).name : 'international waters';
  document.getElementById('place-coords').textContent =
    `${lat.toFixed(4)}°, ${lng.toFixed(4)}° · ${cname}`;
  placeModal.classList.remove('hidden');
  document.getElementById('place-name').focus();
}
placeForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!pendingPlace) return;
  store.addPlace({
    name: document.getElementById('place-name').value.trim(),
    notes: document.getElementById('place-notes').value.trim(),
    rating: placeRating,
    lat: pendingPlace.lat, lon: pendingPlace.lng, a2: pendingPlace.a2
  });
  pendingPlace = null;
  placeModal.classList.add('hidden');
  refreshAll();
});
document.getElementById('place-close').addEventListener('click', () => placeModal.classList.add('hidden'));
placeModal.addEventListener('click', e => { if (e.target === placeModal) placeModal.classList.add('hidden'); });

/* ================= side panel ================= */

const panel = document.getElementById('panel-content');

const fmtPop = p => p >= 1e6 ? (p / 1e6).toFixed(1) + 'M' : p >= 1e3 ? Math.round(p / 1e3) + 'k' : p;
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function renderPanel() {
  if (!selected) return renderWelcome();
  const r = selected, a2 = r.a2;
  const c = store.country(a2);
  const cities = citiesBy.get(a2) || [];
  const mon = monDatum(r).entry;
  const places = store.placesIn(a2);

  panel.innerHTML = `
    <span class="back-link" data-action="back">← back to overview</span>
    <div class="country-head">
      <span class="flag">${r.meta.flag}</span>
      <div>
        <h2>${esc(r.name)}</h2>
        <div class="sub">${[r.meta.sub || r.meta.region, r.meta.capital && `Capital: ${esc(r.meta.capital)}`].filter(Boolean).join(' · ')}</div>
      </div>
    </div>

    <button class="visit-toggle ${c.visited ? 'on' : ''}" data-action="toggle-country">
      ${c.visited ? "✓ I've been here" : 'Mark as visited'}
    </button>
    ${c.visited ? `
      <div class="field"><label>First visited</label>
        <input type="date" id="visit-date" value="${c.date || ''}" /></div>
      <div class="field"><label>Notes</label>
        <textarea id="visit-notes" rows="2" placeholder="Memories, tips, food you loved…">${esc(c.notes || '')}</textarea></div>
    ` : ''}

    <h3>🏛️ Monument</h3>
    <div class="monument-card">
      <div class="m-name">${esc(mon.n)}</div>
      <div class="m-sub">${esc(mon.city || '')}${mon.curated ? '' : ' · stylized generic landmark'}</div>
      <button data-action="view-monument">View in 3D</button>
    </div>

    <h3>🏙️ Cities <span style="text-transform:none">(${cities.filter(ct => store.isCityVisited(a2, ct.n)).length}/${cities.length} visited)</span></h3>
    ${cities.length ? cities.map((ct, i) => `
      <div class="city-row ${store.isCityVisited(a2, ct.n) ? 'visited' : ''}" data-action="toggle-city" data-i="${i}">
        <span class="check">${store.isCityVisited(a2, ct.n) ? '✓' : ''}</span>
        <span class="c-name">${esc(ct.n)}</span>
        ${ct.cap ? '<span class="c-cap">★ capital</span>' : ''}
        <span class="c-pop">${fmtPop(ct.p)}</span>
        <span data-action="fly-city" data-i="${i}" title="Fly there">🎯</span>
      </div>`).join('') : '<div class="empty">No city data for this territory.</div>'}

    <h3>📍 My places here</h3>
    ${places.length ? places.map(p => placeRow(p)).join('') : '<div class="empty">None yet — use “Add place” and click the map.</div>'}
  `;

  panel.querySelector('#visit-date')?.addEventListener('change', e => store.setCountryField(a2, 'date', e.target.value));
  panel.querySelector('#visit-notes')?.addEventListener('change', e => store.setCountryField(a2, 'notes', e.target.value));
}

function placeRow(p) {
  return `
    <div class="place-row" data-action="fly-place" data-id="${p.id}">
      <div class="p-head">
        <span class="p-name">📍 ${esc(p.name)}</span>
        <span class="p-stars">${'★'.repeat(p.rating || 0)}</span>
        <button class="p-del" data-action="del-place" data-id="${p.id}" title="Delete">🗑</button>
      </div>
      ${p.notes ? `<div class="p-notes">${esc(p.notes)}</div>` : ''}
    </div>`;
}

function renderWelcome() {
  const s = store.stats(countries.length);
  const visitedRecs = countries.filter(r => store.isCountryVisited(r.a2));
  const places = store.get().places;
  panel.innerHTML = `
    <div class="welcome-hero">
      <div class="big">🌍</div>
      <h2 style="justify-content:center">Traverse</h2>
      <p>Spin the globe and click any country to log your travels, tick off cities,
      pin your favourite spots and explore each country's iconic monument in 3D.</p>
    </div>

    <h3>✈️ Countries visited (${s.visited}/${countries.length})</h3>
    ${visitedRecs.length
      ? `<div class="chips">${visitedRecs.map(r => `<span class="chip" data-action="open-country" data-a2="${r.a2}">${r.meta.flag} ${esc(r.name)}</span>`).join('')}</div>`
      : '<div class="empty">Nowhere yet — the world awaits! Click a country to begin.</div>'}

    <h3>📍 My places (${places.length})</h3>
    ${places.length ? places.map(p => placeRow(p)).join('') : '<div class="empty">Arm “Add place” and click anywhere on the globe to save a favourite spot.</div>'}

    <h3>🏛️ Featured monuments</h3>
    <div class="chips">${featuredCodes.filter(cd => byA2.has(cd)).map(cd => {
      const r = byA2.get(cd), m = monDatum(r).entry;
      return `<span class="chip gold" data-action="view-mon-of" data-a2="${cd}">${r.meta.flag} ${esc(m.n)}</span>`;
    }).join('')}</div>
  `;
}

panel.addEventListener('click', e => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'back') { selected = null; refreshAll(); }
  else if (action === 'toggle-country') { store.toggleCountry(selected.a2); refreshAll(); }
  else if (action === 'view-monument') { const d = monDatum(selected); openViewer(d.entry, selected.name); }
  else if (action === 'toggle-city') {
    const ct = (citiesBy.get(selected.a2) || [])[+t.dataset.i];
    if (ct) { store.toggleCity(ct.c, ct.n); refreshAll(); }
  }
  else if (action === 'fly-city') {
    e.stopPropagation();
    const ct = (citiesBy.get(selected.a2) || [])[+t.dataset.i];
    if (ct) flyTo(ct.la, ct.lo, 0.3);
  }
  else if (action === 'fly-place') {
    const p = store.get().places.find(x => x.id === t.dataset.id);
    if (p) flyTo(p.lat, p.lon, 0.35);
  }
  else if (action === 'del-place') {
    e.stopPropagation();
    const p = store.get().places.find(x => x.id === t.dataset.id);
    if (p && confirm(`Delete “${p.name}”?`)) {
      store.removePlace(t.dataset.id);
      pinDatumCache.delete(t.dataset.id);
      refreshAll();
    }
  }
  else if (action === 'open-country') { const r = byA2.get(t.dataset.a2); if (r) selectCountry(r); }
  else if (action === 'view-mon-of') {
    const r = byA2.get(t.dataset.a2);
    if (r) { const d = monDatum(r); openViewer(d.entry, r.name); }
  }
});

/* ================= boot ================= */

function refreshAll() {
  refreshPolygons();
  refreshObjects();
  refreshLabels();
  renderStats();
  renderPanel();
}

refreshAll();
setTimeout(() => document.getElementById('hint').classList.add('fade'), 7000);
window.addEventListener('resize', () => globe.width(window.innerWidth).height(window.innerHeight));
