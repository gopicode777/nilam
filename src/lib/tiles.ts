import type { StyleSpecification } from 'maplibre-gl';
/**
 * Satellite tile sources. Esri's ArcGIS Location Platform has a free account (2M basemap tiles / month) with a
 * commercial deployment licence, but it needs an API key and visible attribution.
 * Set VITE_ESRI_KEY (Vercel env var) for production. Without a key we fall back to Esri's keyless public server,
 * which is fine for local development only.
 */
const key = import.meta.env.VITE_ESRI_KEY as string | undefined;
const host = key ? 'https://ibasemaps-api.arcgis.com' : 'https://server.arcgisonline.com';
const q = key ? `?token=${key}` : '';
export const SAT_URL = `${host}/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}${q}`;
// With a key, labels come from the Static Basemap Tiles service (style arcgis/imagery/labels), as in Esri's own overlay tutorial.
export const LABEL_URL = key
  ? `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/{z}/{y}/{x}?token=${key}`
  : 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
export const SAT_ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics';

/* ---- MapLibre styles ---- */
/** Clear street map: OpenFreeMap (OpenStreetMap data). Free, no key, no request limits, commercial use allowed. Attribution is added by MapLibre. */
export const STREET_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
/** Satellite imagery with place and road labels on top. */
export const satStyle = (): StyleSpecification => ({
  version: 8,
  sources: {
    sat: { type: 'raster', tiles: [SAT_URL], tileSize: 256, maxzoom: 18, attribution: SAT_ATTRIBUTION },
    labels: { type: 'raster', tiles: [LABEL_URL], tileSize: 256, maxzoom: 18 },
  },
  layers: [{ id: 'sat', type: 'raster', source: 'sat' }, { id: 'labels', type: 'raster', source: 'labels' }],
});

/** Backup street map (Esri World Street Map, same key as the satellite) used if OpenFreeMap cannot be reached from the visitor's network. */
export const STREET_URL = `${host}/arcgis/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}${q}`;
export const esriStreetStyle = (): StyleSpecification => ({
  version: 8,
  sources: { st: { type: 'raster', tiles: [STREET_URL], tileSize: 256, maxzoom: 19, attribution: 'Tiles © Esri' } },
  layers: [{ id: 'st', type: 'raster', source: 'st' }],
});
