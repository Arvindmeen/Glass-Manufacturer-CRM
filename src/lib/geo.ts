import { normalize } from './format'
import type { Company } from '../types'
import type { Point } from './route'

/** Offline fallback for records without coordinates (no geocoding service allowed). */
const cities: Record<string, Point> = {
  bern: { lat: 46.948, lng: 7.4474 },
  thun: { lat: 46.758, lng: 7.628 },
  spiez: { lat: 46.6868, lng: 7.6787 },
  interlaken: { lat: 46.6863, lng: 7.8632 },
  unterseen: { lat: 46.6875, lng: 7.8485 },
  burgdorf: { lat: 47.0559, lng: 7.6276 },
  zollikofen: { lat: 46.9985, lng: 7.4611 },
  munsingen: { lat: 46.873, lng: 7.5615 },
  wabern: { lat: 46.9285, lng: 7.451 },
  lyss: { lat: 47.0745, lng: 7.307 },
  biel: { lat: 47.1368, lng: 7.2468 },
  solothurn: { lat: 47.2088, lng: 7.5323 },
  langenthal: { lat: 47.2153, lng: 7.7961 },
  luzern: { lat: 47.0502, lng: 8.3093 },
  zurich: { lat: 47.3769, lng: 8.5417 },
  basel: { lat: 47.5596, lng: 7.5886 },
  fribourg: { lat: 46.8065, lng: 7.1619 },
  freiburg: { lat: 46.8065, lng: 7.1619 },
  frutigen: { lat: 46.5872, lng: 7.6497 },
  steffisburg: { lat: 46.778, lng: 7.6327 },
  belp: { lat: 46.8913, lng: 7.4988 },
  konolfingen: { lat: 46.8789, lng: 7.6216 },
  gunten: { lat: 46.712, lng: 7.699 },
  zaziwil: { lat: 46.9035, lng: 7.662 },
  oberhofen: { lat: 46.7308, lng: 7.6687 },
  worb: { lat: 46.9297, lng: 7.5631 },
  ostermundigen: { lat: 46.9563, lng: 7.4876 },
  koniz: { lat: 46.9244, lng: 7.4146 },
  aarberg: { lat: 47.0445, lng: 7.2752 },
  langnau: { lat: 46.9395, lng: 7.7871 },
}

export function locate(c: Company): Point | undefined {
  if (c.lat != null && c.lng != null) return { lat: c.lat, lng: c.lng }
  const key = normalize(c.city).replace(/\s+(be|im emmental|bei bern)$/, '')
  return cities[key]
}

export const addressOf = (c: Company) =>
  [c.name, c.street, `${c.zip} ${c.city}`.trim()].filter(Boolean).join(', ')
