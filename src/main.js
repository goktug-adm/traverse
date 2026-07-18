import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import './style.css';
import Globe from 'globe.gl';
import * as THREE from 'three';
import * as topojson from 'topojson-client';

import worldTopo from 'world-atlas/countries-110m.json';
import countryMeta from './data/countries.json';
import cityRows from './data/cities.json';

import { FAMOUS } from './famous.js';
import { fetchSights } from './sights.js';
import { store } from './state.js';

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

const countries = features.map(f => {
  const meta = countryMeta[f.id] || NAME_FIXES[f.properties.name] ||
    { a2: 'X-' + f.properties.name, name: f.properties.name, capital: '', region: '', sub: '', flag: '🏳️', lat: 0, lon: 0, area: 0 };
  return { feature: f, a2: meta.a2, meta, name: meta.name };
});

const byA2 = new Map(countries.map(r => [r.a2, r]));
const featureToRec = new Map(countries.map(r => [r.feature, r]));

const citiesBy = new Map();
for (const c of cityRows) {
  if (!citiesBy.has(c.c)) citiesBy.set(c.c, []);
  citiesBy.get(c.c).push(c);
}

const famousKey = c => c.c + '|' + c.n;
const countryName = a2 => byA2.get(a2)?.name || a2;
const countryFlag = a2 => byA2.get(a2)?.meta.flag || '🏳️';

/* ================= ui state ================= */

let selected = null;      // country record
let cityView = null;      // { n, c, la, lo, r? } — city detail panel
let hovered = null;
let addPlaceArmed = false;
let pendingPlace = null;
let pov = { lat: 35, lng: 25, altitude: 2.3 };
let sightsToken = 0;      // guards async sight loads against stale renders

const labelZoom = () => THREE.MathUtils.clamp(pov.altitude * 1.3 + 0.22, 0.35, 1);

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
    if (cityView || selected) { cityView = null; selected = null; refreshAll(); }
  })
  .htmlLat('la').htmlLng('lo')
  .htmlAltitude(0.012)
  .htmlElement(d => makeMarker(d))
  .labelLat('la').labelLng('lo')
  .labelText(c => latinize(c.n))   // the 3D label font only has basic latin glyphs
  .labelSize(c => (c.cap ? 0.62 : 0.45) * labelZoom())
  .labelDotRadius(c => (c.cap ? 0.28 : 0.2) * labelZoom())
  .labelAltitude(0.012)
  .labelColor(c => store.isCityVisited(c.c, c.n) ? '#2ec4a6' : c.cap ? '#f7b32b' : '#dce6f5')
  .labelLabel(c => `<div class="globe-tooltip"><b>${c.n}</b><div class="t-sub">${c.cap ? 'Capital · ' : ''}${fmtPop(c.p)} people — click to explore</div></div>`)
  .onLabelClick(c => openCity(c));

globe.globeMaterial().color = new THREE.Color(0x0d2036);
globe.globeMaterial().emissive = new THREE.Color(0x081a30);
globe.globeMaterial().emissiveIntensity = 0.42;
globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

globe.pointOfView({ lat: 35, lng: 25, altitude: 2.3 }, 0);
globe.controls().autoRotate = true;
globe.controls().autoRotateSpeed = 0.4;
globe.controls().minDistance = 113;
globe.controls().maxDistance = 480;
globe.controls().addEventListener('start', () => { globe.controls().autoRotate = false; });

let zoomTimer = null;
globe.onZoom(p => {
  pov = p;
  if (!zoomTimer) zoomTimer = setTimeout(() => {
    zoomTimer = null;
    if (selected) refreshLabels();
  }, 300);
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
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * cv.width, y = Math.random() * cv.height, r = 120 + Math.random() * 200;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(76, 120, 240, 0.05)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return cv.toDataURL();
}

/* ---------- html markers: famous-city badges + place pins ---------- */

const famousData = FAMOUS.map(c => ({ type: 'famous', ...c }));

function makeMarker(d) {
  let el;
  if (d.type === 'famous') {
    el = document.createElement('div');
    el.className = 'city-badge' + (store.isCityVisited(d.c, d.n) ? ' visited' : '');
    el.title = `#${d.r} ${d.n}, ${countryName(d.c)}`;
    el.addEventListener('click', e => { e.stopPropagation(); openCity(d); });
  } else {
    el = document.createElement('div');
    el.className = 'pin-marker';
    el.textContent = '📍';
    el.title = `${d.place.name} ${'★'.repeat(d.place.rating || 0)}`;
    el.addEventListener('click', e => {
      e.stopPropagation();
      flyTo(d.place.lat, d.place.lon, 0.35);
      const r = byA2.get(d.place.a2);
      if (r) { cityView = null; selected = r; refreshAll(); }
    });
  }
  d.__el = el;
  return el;
}

function refreshMarkers() {
  const pins = store.get().places.map(p => ({ type: 'pin', place: p, la: p.lat, lo: p.lon }));
  globe.htmlElementsData([...famousData, ...pins]);
  for (const d of famousData) {
    d.__el?.classList.toggle('visited', store.isCityVisited(d.c, d.n));
  }
}

function refreshLabels() {
  globe.labelsData(selected ? (citiesBy.get(selected.a2) || []) : []);
  globe.labelColor(c => store.isCityVisited(c.c, c.n) ? '#2ec4a6' : c.cap ? '#f7b32b' : '#dce6f5');
  globe.labelSize(c => (c.cap ? 0.62 : 0.45) * labelZoom());
  globe.labelDotRadius(c => (c.cap ? 0.28 : 0.2) * labelZoom());
}

function refreshPolygons() {
  globe.polygonCapColor(f => capColor(f));
  globe.polygonAltitude(f => (selected && f === selected.feature ? 0.02 : 0.008));
}

/* ================= selection & flight ================= */

function selectCountry(rec, fly = true) {
  selected = rec;
  cityView = null;
  if (fly) {
    const alt = Math.min(2.2, Math.max(0.45, Math.sqrt((rec.meta.area || 100000) / 900000)));
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: rec.meta.lat, lng: rec.meta.lon, altitude: alt }, 950);
  }
  refreshAll();
}

function openCity(c) {
  cityView = { n: c.n, c: c.c, la: c.la, lo: c.lo, r: c.r, p: c.p, cap: c.cap };
  if (byA2.has(c.c)) selected = byA2.get(c.c);
  flyTo(c.la, c.lo, 0.3);
  refreshAll();
  loadSights(cityView);
}

function flyTo(lat, lng, altitude = 0.5, ms = 900) {
  globe.controls().autoRotate = false;
  globe.pointOfView({ lat, lng, altitude }, ms);
}

/* ================= top bar ================= */

const statsEl = document.getElementById('stats');
function renderStats() {
  const s = store.stats(countries.length);
  const seen = store.sightsSeenCount();
  statsEl.innerHTML = `
    <div class="stat"><b>${s.visited}</b><span>countries</span></div>
    <div class="stat"><b>${s.cities}</b><span>cities</span></div>
    <div class="stat"><b>${seen}</b><span>sights</span></div>
    <div class="stat progress"><b>${s.pct}%</b><span>of the world</span>
      <div class="bar"><i style="width:${s.pct}%"></i></div>
    </div>`;
}

const searchInput = document.getElementById('search');
const dl = document.getElementById('country-list');
dl.innerHTML = [...countries.map(r => r.name), ...FAMOUS.map(c => c.n)].sort()
  .map(n => `<option value="${n.replace(/"/g, '&quot;')}"></option>`).join('');
const fold = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ALIASES = {
  turkey: 'TR', turkiye: 'TR', uk: 'GB', england: 'GB', usa: 'US', america: 'US',
  uae: 'AE', holland: 'NL', burma: 'MM', 'ivory coast': 'CI', 'cape verde': 'CV'
};
searchInput.addEventListener('change', () => {
  const q = fold(searchInput.value.trim());
  if (!q) return;
  const city = FAMOUS.find(c => fold(c.n) === q) || FAMOUS.find(c => fold(c.n).startsWith(q));
  if (city) { openCity(city); searchInput.blur(); return; }
  const rec = (ALIASES[q] && byA2.get(ALIASES[q])) ||
    countries.find(r => fold(r.name) === q) ||
    countries.find(r => fold(r.name).startsWith(q)) ||
    countries.find(r => fold(r.name).includes(q)) ||
    countries.find(r => r.meta.capital && fold(r.meta.capital) === q);
  if (rec) { selectCountry(rec); searchInput.blur(); }
});

/* ================= toolbar ================= */

const btnAdd = document.getElementById('btn-add-place');

function setArmedUI() {
  btnAdd.classList.toggle('armed', addPlaceArmed);
  btnAdd.querySelector('span').textContent = addPlaceArmed ? '🎯' : '📍';
  btnAdd.dataset.tip = addPlaceArmed ? 'Now click the globe to drop your pin…' : 'Add a place — click the globe to drop a pin';
  document.body.style.cursor = addPlaceArmed ? 'crosshair' : 'grab';
}
btnAdd.addEventListener('click', () => { addPlaceArmed = !addPlaceArmed; setArmedUI(); });

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
    refreshAll();
  } catch (e) { alert('Could not import: ' + e.message); }
  importFile.value = '';
});

/* ================= photos ================= */

const photoFile = document.getElementById('photo-file');
const photoModal = document.getElementById('photo-modal');
const photoFull = document.getElementById('photo-full');
let photoTarget = null;

function shrinkImage(file, maxDim = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, maxDim / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * s);
      cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not an image')); };
    img.src = url;
  });
}

photoFile.addEventListener('change', async () => {
  if (!photoTarget) return;
  const files = [...photoFile.files].slice(0, 6);
  for (const f of files) {
    try {
      const url = await shrinkImage(f);
      const ok = photoTarget.type === 'country'
        ? store.addCountryPhoto(photoTarget.a2, url)
        : store.addPlacePhoto(photoTarget.id, url);
      if (!ok) { alert('Storage is full — delete some photos first.'); break; }
    } catch (e) { /* skip non-images */ }
  }
  photoFile.value = '';
  photoTarget = null;
  renderPanel();
});

function openLightbox(src) {
  photoFull.src = src;
  photoModal.classList.remove('hidden');
}
photoModal.addEventListener('click', () => photoModal.classList.add('hidden'));

const photoStrip = (photos, owner, extra = '') => `
  <div class="photo-strip${extra}">
    ${photos.map((ph, i) => `
      <div class="photo-thumb">
        <img class="photo-view" src="${ph}" alt="" />
        <button class="photo-del" data-action="del-photo" data-owner="${owner}" data-i="${i}" title="Delete photo">✕</button>
      </div>`).join('')}
    ${owner.startsWith('place:') ? '' : `<div class="photo-add" data-action="add-country-photo" title="Add photos">＋</div>`}
  </div>`;

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

/* ================= sights (places to visit) ================= */

let currentSights = [];

async function loadSights(city) {
  const token = ++sightsToken;
  currentSights = [];
  const host = document.getElementById('sights-box');
  if (host) host.innerHTML = '<div class="empty">Finding places to visit…</div>';
  try {
    const sights = await fetchSights(city.la, city.lo);
    if (token !== sightsToken) return;    // user moved on
    currentSights = sights;
  } catch (e) {
    if (token !== sightsToken) return;
    currentSights = null;                  // error state
  }
  renderPanel();
  renderStats();
}

function sightRow(s) {
  const seen = store.isSightSeen(s.id);
  return `
    <div class="sight-row ${seen ? 'seen' : ''}">
      <span class="check" data-action="toggle-sight" data-id="${s.id}" title="Mark as seen">${seen ? '✓' : ''}</span>
      ${s.thumb ? `<img class="sight-thumb" src="${s.thumb}" alt="" loading="lazy" />` : '<div class="sight-thumb ph">🏞️</div>'}
      <div class="s-body">
        <div class="s-title">${esc(s.title)}</div>
        ${s.desc ? `<div class="s-desc">${esc(s.desc)}</div>` : ''}
        <a class="s-link" href="${s.url}" target="_blank" rel="noopener">Wikipedia ↗</a>
      </div>
    </div>`;
}

/* ================= side panel ================= */

const panel = document.getElementById('panel-content');

const fmtPop = p => p >= 1e6 ? (p / 1e6).toFixed(1) + 'M' : p >= 1e3 ? Math.round(p / 1e3) + 'k' : p;
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function renderPanel() {
  if (cityView) return renderCity();
  if (selected) return renderCountry();
  renderWelcome();
}

function renderCity() {
  const c = cityView;
  const visited = store.isCityVisited(c.c, c.n);
  panel.innerHTML = `
    <span class="back-link" data-action="back-country">← ${byA2.has(c.c) ? esc(countryName(c.c)) : 'back to overview'}</span>
    <div class="country-head">
      <span class="flag">${countryFlag(c.c)}</span>
      <div>
        <h2>${esc(c.n)}</h2>
        <div class="sub">${[c.r ? `#${c.r} most famous city` : '', esc(countryName(c.c)), c.p ? fmtPop(c.p) + ' people' : ''].filter(Boolean).join(' · ')}</div>
      </div>
    </div>

    <button class="visit-toggle ${visited ? 'on' : ''}" data-action="toggle-cityview">
      ${visited ? "✓ I've been here" : 'Mark as visited'}
    </button>

    <h3>🧭 Places to visit</h3>
    <div id="sights-box">
      ${currentSights === null
        ? '<div class="empty">Could not load sights — check your connection and try again.</div>'
        : currentSights.length
          ? currentSights.map(sightRow).join('')
          : '<div class="empty">Finding places to visit…</div>'}
    </div>
    <div class="credit">Sight data & images from Wikipedia</div>
  `;
}

function renderCountry() {
  const r = selected, a2 = r.a2;
  const c = store.country(a2);
  const cities = citiesBy.get(a2) || [];
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
      <h3>📷 Photos${c.photos?.length ? ` (${c.photos.length})` : ''}</h3>
      ${photoStrip(c.photos || [], 'country')}
    ` : ''}

    <h3>🏙️ Cities <span style="text-transform:none">(${cities.filter(ct => store.isCityVisited(a2, ct.n)).length}/${cities.length} visited)</span></h3>
    ${cities.length ? cities.map((ct, i) => `
      <div class="city-row ${store.isCityVisited(a2, ct.n) ? 'visited' : ''}">
        <span class="check" data-action="toggle-city" data-i="${i}">${store.isCityVisited(a2, ct.n) ? '✓' : ''}</span>
        <span class="c-name" data-action="open-city-row" data-i="${i}" title="Places to visit">${esc(ct.n)}</span>
        ${ct.cap ? '<span class="c-cap">★ capital</span>' : ''}
        <span class="c-pop">${fmtPop(ct.p)}</span>
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
        <button class="p-del" data-action="add-place-photo" data-id="${p.id}" title="Add photos">📷</button>
        <button class="p-del" data-action="del-place" data-id="${p.id}" title="Delete">🗑</button>
      </div>
      ${p.notes ? `<div class="p-notes">${esc(p.notes)}</div>` : ''}
      ${p.photos?.length ? photoStrip(p.photos, 'place:' + p.id, ' small') : ''}
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
      <p>Spin the globe, click a country to log your travels, and tap the gold
      badges — the world's most famous cities — to discover places to visit.</p>
    </div>

    <h3>🌆 Top cities of the world</h3>
    <div class="rank-list">
      ${FAMOUS.map(c => `
        <div class="rank-row ${store.isCityVisited(c.c, c.n) ? 'visited' : ''}" data-action="open-famous" data-k="${famousKey(c)}">
          <span class="rank-num">${c.r}</span>
          <span class="rank-name">${esc(c.n)}</span>
          <span class="rank-cc">${countryFlag(c.c)}</span>
          ${store.isCityVisited(c.c, c.n) ? '<span class="rank-check">✓</span>' : ''}
        </div>`).join('')}
    </div>

    <h3>✈️ Countries visited (${s.visited}/${countries.length})</h3>
    ${visitedRecs.length
      ? `<div class="chips">${visitedRecs.map(r => `<span class="chip" data-action="open-country" data-a2="${r.a2}">${r.meta.flag} ${esc(r.name)}</span>`).join('')}</div>`
      : '<div class="empty">Nowhere yet — the world awaits! Click a country to begin.</div>'}

    <h3>📍 My places (${places.length})</h3>
    ${places.length ? places.map(p => placeRow(p)).join('') : '<div class="empty">Arm “Add place” and click anywhere on the globe to save a favourite spot.</div>'}
  `;
}

panel.addEventListener('click', e => {
  if (e.target.classList?.contains('photo-view')) {
    e.stopPropagation();
    return openLightbox(e.target.src);
  }
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'back') { selected = null; cityView = null; refreshAll(); }
  else if (action === 'back-country') {
    cityView = null;
    if (selected) selectCountry(selected);
    else refreshAll();
  }
  else if (action === 'toggle-country') { store.toggleCountry(selected.a2); refreshAll(); }
  else if (action === 'toggle-cityview') { store.toggleCity(cityView.c, cityView.n); refreshAll(); }
  else if (action === 'toggle-sight') { store.toggleSight(+t.dataset.id); renderPanel(); renderStats(); }
  else if (action === 'toggle-city') {
    const ct = (citiesBy.get(selected.a2) || [])[+t.dataset.i];
    if (ct) { store.toggleCity(ct.c, ct.n); refreshAll(); }
  }
  else if (action === 'open-city-row') {
    const ct = (citiesBy.get(selected.a2) || [])[+t.dataset.i];
    if (ct) openCity(ct);
  }
  else if (action === 'open-famous') {
    const c = FAMOUS.find(x => famousKey(x) === t.dataset.k);
    if (c) openCity(c);
  }
  else if (action === 'add-country-photo') {
    photoTarget = { type: 'country', a2: selected.a2 };
    photoFile.click();
  }
  else if (action === 'add-place-photo') {
    e.stopPropagation();
    photoTarget = { type: 'place', id: t.dataset.id };
    photoFile.click();
  }
  else if (action === 'del-photo') {
    e.stopPropagation();
    const owner = t.dataset.owner, i = +t.dataset.i;
    if (!confirm('Delete this photo?')) return;
    if (owner === 'country') store.removeCountryPhoto(selected.a2, i);
    else store.removePlacePhoto(owner.slice(6), i);
    renderPanel();
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
      refreshAll();
    }
  }
  else if (action === 'open-country') { const r = byA2.get(t.dataset.a2); if (r) selectCountry(r); }
});

/* ================= boot ================= */

function refreshAll() {
  refreshPolygons();
  refreshMarkers();
  refreshLabels();
  renderStats();
  renderPanel();
}

refreshAll();
setTimeout(() => document.getElementById('hint').classList.add('fade'), 7000);
window.addEventListener('resize', () => globe.width(window.innerWidth).height(window.innerHeight));
