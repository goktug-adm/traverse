// Generates src/data/countries.json and src/data/cities.json from npm data
// packages (world-countries, all-the-cities). Runs automatically before
// `npm run dev` / `npm run build`, so the repo carries no data blobs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dataDir = fileURLToPath(new URL('../src/data/', import.meta.url));
mkdirSync(dataDir, { recursive: true });

/* ---- country metadata, keyed by ISO numeric (matches world-atlas ids) ---- */
const countries = require('world-countries');
const meta = {};
for (const c of countries) {
  if (!c.ccn3) continue;
  meta[c.ccn3] = {
    a2: c.cca2, a3: c.cca3, name: c.name.common,
    capital: (c.capital && c.capital[0]) || '',
    region: c.region, sub: c.subregion || '', flag: c.flag,
    lat: c.latlng[0], lon: c.latlng[1], area: c.area
  };
}
writeFileSync(dataDir + 'countries.json', JSON.stringify(meta));

/* ---- top ~12 cities per country (population >= 15k, capitals first) ---- */
const all = require('all-the-cities');
const by = {};
for (const c of all) {
  if (c.population < 15000) continue;
  if (/\d/.test(c.name)) continue;          // skip arrondissement-style rows
  const rec = {
    n: c.name, c: c.country,
    la: +c.loc.coordinates[1].toFixed(4), lo: +c.loc.coordinates[0].toFixed(4),
    p: c.population, cap: c.featureCode === 'PPLC' ? 1 : 0
  };
  (by[rec.c] ||= []).push(rec);
}
const cities = [];
for (const cc of Object.keys(by)) {
  const arr = by[cc];
  arr.sort((a, b) => (b.cap - a.cap) || (b.p - a.p));
  const caps = arr.filter(r => r.cap), rest = arr.filter(r => !r.cap);
  cities.push(...[...caps.slice(0, 2), ...rest].slice(0, 12));
}
cities.sort((a, b) => a.c.localeCompare(b.c) || b.p - a.p);
writeFileSync(dataDir + 'cities.json', JSON.stringify(cities));

console.log(`gen-data: ${Object.keys(meta).length} countries, ${cities.length} cities`);
