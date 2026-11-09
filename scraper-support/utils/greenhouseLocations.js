import { isIndiaJob } from './indiaLocationFilter.js'

export const NATIVE_INDIA_LOCATION = /\bindia\b|\bbengaluru\b|\bbangalore\b|\bhyderabad\b|\bpune\b|\bgurugram\b|\bgurgaon\b|\bmumbai\b|\bchennai\b|\bnoida\b|\bdelhi\b|\bahmedabad\b/i
const WORK_MODE = /^(?:hybrid|in[- ]office|on[- ]site)(?:\s*[;,]\s*(?:hybrid|in[- ]office|on[- ]site))*$/i
const LOCATION_FIELD = /^(?:(?:job(?: posting)?|office)\s+)?(?:locations?|countries|country|offices?)(?:\s*\(for website only\))?$/i
const COUNTRY_FIELD = /^(?:(?:job(?: posting)?|office)\s+)?(?:countries|country)(?:\s*\(for website only\))?$/i
const fail = () => { throw new Error('Invalid Greenhouse inventory: malformed native locations') }

export const greenhouseCountryLabels = record => (Array.isArray(record?.metadata) ? record.metadata : [])
  .filter(entry => COUNTRY_FIELD.test(entry?.name || ''))
  .flatMap(entry => Array.isArray(entry.value) ? entry.value : entry.value == null ? [] : [entry.value])
  .map(value => typeof value === 'string' ? (/^(?:IN|IND)$/i.test(value.trim()) ? 'India' : value.trim()) : value)

const GEO_FIELD = /location|country|countries|office|address|region|geograph|latitude|longitude|postal|territor|continent/i
const hasValue = value => value != null && (Array.isArray(value) ? value.some(hasValue)
  : typeof value === 'string' ? Boolean(value.trim()) : true)
const unknownGeographicField = (value, allowed) => Object.entries(value || {}).some(([key, field]) =>
  GEO_FIELD.test(key) && !allowed.includes(key) && hasValue(field))
export const hasUnhandledGreenhouseGeography = record =>
  unknownGeographicField(record, ['location', 'offices', 'metadata'])
  || unknownGeographicField(record?.location, ['name'])
  || (Array.isArray(record?.offices) && record.offices.some(office => unknownGeographicField(office, ['name', 'location'])))
  || (Array.isArray(record?.metadata) ? record.metadata : []).some(entry => GEO_FIELD.test(entry?.name || '')
    && !LOCATION_FIELD.test(entry.name)
    && hasValue(entry.value))

export const hasNativeIndiaLocation = label => typeof label === 'string'
  && NATIVE_INDIA_LOCATION.test(label) && isIndiaJob({ location: label,
    ...(/\bindia\b/i.test(label) ? { country: 'India' } : {}),
  })

// Some boards enumerate several fully qualified city/state worksites after a
// remote-work prefix. Split only when every element has that address shape;
// ordinary hyphens in a city or a work arrangement are not location separators.
export const qualifiedGreenhouseWorksites = label => {
  if (typeof label !== 'string') return null
  const locations = label.trim().replace(/^Remote\s+-\s+/i, '').split(/\s+[-–—]\s+/u)
  return locations.length && locations.every(location => /^[\p{L}][\p{L} .'-]*,\s*[A-Z]{2}$/u.test(location))
    ? locations.map(location => location.trim()) : null
}

// Semicolons also enumerate independent native offices. Unqualified alternate
// city/region labels retain their original text and unresolved scope.
export const greenhouseLocationSegments = label => label.split(';').map(value => value.trim()).filter(Boolean)
  .flatMap(value => qualifiedGreenhouseWorksites(value) || [value])

export const greenhouseLocationLabels = (record = {}) => {
  const labels = []
  if (record.metadata != null && !Array.isArray(record.metadata)) fail()
  for (const entry of record.metadata || []) {
    if (!LOCATION_FIELD.test(entry?.name || '')) continue
    const values = Array.isArray(entry.value) ? entry.value : entry.value == null ? [] : [entry.value]
    for (const value of values) {
      if (typeof value !== 'string') fail()
      if (value.trim()) labels.push(COUNTRY_FIELD.test(entry.name) && /^(?:IN|IND)$/i.test(value.trim()) ? 'India' : value.trim())
    }
  }
  if (record.offices != null && !Array.isArray(record.offices)) fail()
  for (const office of record.offices || []) {
    if (!office || typeof office !== 'object' || Array.isArray(office)) fail()
    const label = office.location || office.name
    if (label != null && typeof label !== 'string') fail()
    if (label?.trim()) labels.push(label.trim())
  }
  const primary = record.location?.name
  if (primary != null && typeof primary !== 'string') fail()
  // A workplace arrangement is not another geographic location. Keep it as
  // unknown only when the feed supplies no real native location at all.
  if (primary?.trim() && (!WORK_MODE.test(primary.trim()) || !labels.length)) labels.push(primary.trim())
  return [...new Set(labels.flatMap(greenhouseLocationSegments))]
}

export const selectGreenhouseLocation = record => {
  const labels = greenhouseLocationLabels(record)
  const primaryIndia = typeof record?.location?.name === 'string'
    ? greenhouseLocationSegments(record.location.name).find(hasNativeIndiaLocation) : null
  if (primaryIndia) return primaryIndia
  return labels.find(hasNativeIndiaLocation) || labels[0] || null
}
