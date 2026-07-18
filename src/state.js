// Persistent user data: visited countries/cities, personal places. Stored in localStorage.

const KEY = 'traverse-data-v1';

const blank = () => ({
  countries: {},   // a2 -> { visited, date, notes }
  cities: {},      // "a2|name" -> { visited, date }
  places: []       // { id, name, lat, lon, rating, notes, a2, created }
});

let data = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch (e) { /* corrupted storage — start fresh */ }
  return blank();
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(data));
  listeners.forEach(fn => fn(data));
}

export const cityKey = (a2, name) => `${a2}|${name}`;

export const store = {
  get: () => data,
  subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },

  country: a2 => data.countries[a2] || {},
  isCountryVisited: a2 => !!data.countries[a2]?.visited,

  toggleCountry(a2) {
    const c = data.countries[a2] || (data.countries[a2] = {});
    c.visited = !c.visited;
    if (c.visited && !c.date) c.date = new Date().toISOString().slice(0, 10);
    save();
  },
  setCountryField(a2, field, value) {
    const c = data.countries[a2] || (data.countries[a2] = {});
    c[field] = value;
    save();
  },

  isCityVisited: (a2, name) => !!data.cities[cityKey(a2, name)]?.visited,
  toggleCity(a2, name) {
    const k = cityKey(a2, name);
    const c = data.cities[k] || (data.cities[k] = {});
    c.visited = !c.visited;
    if (c.visited) {
      c.date = c.date || new Date().toISOString().slice(0, 10);
      // visiting a city implies visiting its country
      const co = data.countries[a2] || (data.countries[a2] = {});
      if (!co.visited) { co.visited = true; co.date = co.date || c.date; }
    }
    save();
  },
  citiesVisitedIn: a2 => Object.keys(data.cities).filter(k => k.startsWith(a2 + '|') && data.cities[k].visited).length,

  addPlace(place) {
    data.places.push({ id: 'p' + Date.now() + Math.random().toString(36).slice(2, 6), created: Date.now(), ...place });
    save();
  },
  removePlace(id) {
    data.places = data.places.filter(p => p.id !== id);
    save();
  },
  placesIn: a2 => data.places.filter(p => p.a2 === a2),

  stats(totalCountries) {
    const visited = Object.values(data.countries).filter(c => c.visited).length;
    const cities = Object.values(data.cities).filter(c => c.visited).length;
    return { visited, cities, places: data.places.length, total: totalCountries, pct: totalCountries ? Math.round(visited / totalCountries * 100) : 0 };
  },

  export() {
    return JSON.stringify({ app: 'traverse', version: 1, exported: new Date().toISOString(), data }, null, 2);
  },
  import(json) {
    const parsed = JSON.parse(json);
    const incoming = parsed.data && parsed.app === 'traverse' ? parsed.data : parsed;
    if (typeof incoming.countries !== 'object' || !Array.isArray(incoming.places)) {
      throw new Error('Not a Traverse export file');
    }
    data = { ...blank(), ...incoming };
    save();
  }
};
