// Live "places to visit" data, pulled from the Wikipedia API (no key needed,
// CORS-enabled). GeoSearch finds notable articles near the city centre; a
// second query attaches thumbnails and short descriptions. Results are cached
// per location in sessionStorage.

const WIKI = 'https://en.wikipedia.org/w/api.php';
const cache = new Map();

// admin/infrastructure pages and historical events that aren't really "sights"
const BORING = /\b(city|capital|province|district|municipality|region|commune|prefecture|county|governorate|suburb|neighbourhood|neighborhood|metro station|railway station|train station|bus station|university|college|school|hospital|company|airline|airport|embassy|constituency|earthquake|battle|siege|massacre|riot|bombing|attack|coup|protest|conference|treaty|election)\b/i;

export async function fetchSights(la, lo, limit = 14) {
  const key = la.toFixed(3) + ',' + lo.toFixed(3);
  if (cache.has(key)) return cache.get(key);
  try {
    const stored = sessionStorage.getItem('sights:' + key);
    if (stored) {
      const v = JSON.parse(stored);
      cache.set(key, v);
      return v;
    }
  } catch (e) { /* private mode etc. */ }

  const geoRes = await fetch(
    `${WIKI}?action=query&list=geosearch&gscoord=${la}%7C${lo}&gsradius=10000&gslimit=50&format=json&origin=*`
  ).then(r => r.json());
  const hits = geoRes.query?.geosearch || [];
  if (!hits.length) return [];

  const ids = hits.map(h => h.pageid).join('|');
  const detRes = await fetch(
    `${WIKI}?action=query&pageids=${ids}&prop=pageimages%7Cdescription&piprop=thumbnail&pithumbsize=200&format=json&origin=*`
  ).then(r => r.json());
  const pages = detRes.query?.pages || {};

  const out = hits
    .map(h => {
      const p = pages[h.pageid] || {};
      return {
        id: h.pageid,
        title: h.title,
        dist: Math.round(h.dist),
        desc: p.description || '',
        thumb: p.thumbnail?.source || '',
        url: 'https://en.wikipedia.org/?curid=' + h.pageid
      };
    })
    .filter(s => (s.desc || s.thumb) && !BORING.test(s.title + ' ' + s.desc))
    .slice(0, limit);

  cache.set(key, out);
  try { sessionStorage.setItem('sights:' + key, JSON.stringify(out)); } catch (e) { /* full */ }
  return out;
}
