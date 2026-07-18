# 🌍 Traverse — your world, in 3D

A personal travel tracker built around an interactive 3D globe. Spin the Earth, click a
country, tick off the cities you've been to, pin your own favourite spots — and explore
a stylized low-poly **3D monument for (approximately) every country on the planet**.

![stack](https://img.shields.io/badge/three.js-globe.gl-blue) ![build](https://img.shields.io/badge/bundler-vite-purple)

## Features

- **Interactive 3D globe** — drag to spin, scroll to zoom, hover for country info.
  Visited countries glow teal; the selected country lifts off the surface.
- **Country visits** — mark any of the world's countries/territories as visited, with a
  first-visit date and free-form notes.
- **City checklists** — the top ~12 cities of every country (capitals starred), each
  individually checkable. Ticking a city auto-marks its country. City labels appear on
  the globe when a country is selected — click a label to toggle it too.
- **My places** — arm *“📍 Add place”* and click anywhere on the globe to drop a pin:
  name it, rate it 1–5 stars, add notes. Your pins live on the globe and in the panel.
- **3D monuments** — a hand-curated catalog of **130+ real monuments** (Eiffel Tower,
  Taj Mahal, Colosseum, Moai, Angkor Wat, Djenné Mosque, Sydney Opera House…), each built
  procedurally from ~35 low-poly architectural archetypes. Famous ones stand directly on
  the globe; every country's monument can be opened in a dedicated orbit-controlled 3D
  viewer. Countries without a curated entry get a stylized generic landmark, so every
  land has something to show.
- **Stats** — countries / cities / places counters and a "% of the world" progress bar.
- **Search** — type-ahead country search that flies you there.
- **Export / import** — your data stays in `localStorage`; back it up or move it as JSON.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build into dist/
npm run preview    # serve the production build
```

The build is fully self-contained (all data is bundled — no runtime API calls), so `dist/`
can be dropped onto any static host, including GitHub Pages.

## Project layout

```
scripts/
  gen-data.mjs          generates src/data/*.json from npm data packages (runs pre-build)
src/
  main.js               app orchestration: globe, panel, toolbar, search, zoom LOD
  state.js              localStorage-backed store (visits, cities, places)
  viewer.js             standalone 3D monument viewer modal
  citybuildings.js      procedural city skylines that appear at close zoom
  monuments/
    builders.js         ~35 procedural low-poly monument archetypes (three.js)
    catalog.js          country → monument mapping (name, coords, builder, params)
  data/                 (generated) country metadata + top cities per country
  style.css
```

## Data credits

- Country polygons: [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, public domain)
- Country metadata: [world-countries](https://github.com/mledoze/countries) (ODbL)
- Cities: [all-the-cities](https://www.npmjs.com/package/all-the-cities), derived from [GeoNames](https://www.geonames.org/) (CC BY 4.0)
- Globe rendering: [globe.gl](https://github.com/vasturiano/globe.gl) / three.js
- Fonts: Space Grotesk & Inter via [Fontsource](https://fontsource.org/) (OFL)

Monument models are original stylized low-poly interpretations, generated procedurally —
they aim for silhouette recognisability, not architectural accuracy.
