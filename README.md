# 🌍 Traverse — your world, in 3D

A personal travel tracker built around an interactive 3D globe. Spin the Earth, click a
country, tick off the cities you've been to, pin your own favourite spots — and explore
a stylized low-poly **3D monument for (approximately) every country on the planet**.

![stack](https://img.shields.io/badge/three.js-globe.gl-blue) ![build](https://img.shields.io/badge/bundler-vite-purple)

> **v0.3** — the experimental 3D monument/city models were retired in favour of a
> clean globe with ranked famous-city badges and live "places to visit" data.

## Features

- **Interactive 3D globe** — drag to spin, scroll to zoom, hover for country info.
  Visited countries glow teal; the selected country lifts off the surface.
- **World's top cities, ranked** — 60 of the most famous destinations shown as
  numbered gold badges on the globe and as a ranked list in the panel.
- **Places to visit** — open any city (badge, ranked list, or a country's city
  list) and get live sights from the Wikipedia API: photo, description and link,
  each checkable as "seen".
- **Country visits** — mark countries visited with a first-visit date, notes and
  photo attachments; tick off each country's top ~12 cities.
- **My places** — drop your own pins anywhere with a 1-5 star rating, notes and photos.
- **Stats** — countries / cities / sights counters and a "% of the world" bar.
- **Search** — type-ahead for countries and famous cities.
- **Export / import** — data lives in localStorage; back it up as JSON.

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
  main.js               app orchestration: globe, panels, markers, search
  state.js              localStorage-backed store (visits, sights, places, photos)
  famous.js             ranked list of the world's top city destinations
  sights.js             live "places to visit" fetcher (Wikipedia API)
  data/                 (generated) country metadata + top cities per country
  style.css
```

## Data credits

- Country polygons: [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, public domain)
- Country metadata: [world-countries](https://github.com/mledoze/countries) (ODbL)
- Cities: [all-the-cities](https://www.npmjs.com/package/all-the-cities), derived from [GeoNames](https://www.geonames.org/) (CC BY 4.0)
- Globe rendering: [globe.gl](https://github.com/vasturiano/globe.gl) / three.js
- Fonts: Space Grotesk & Inter via [Fontsource](https://fontsource.org/) (OFL)
- Sights: live from the [Wikipedia API](https://www.mediawiki.org/wiki/API:Geosearch) (CC BY-SA content)

