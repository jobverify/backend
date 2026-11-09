import { createHash } from 'node:crypto'
import { NATIVE_INDIA_LOCATION, qualifiedGreenhouseWorksites } from './greenhouseLocations.js'

const US_STATES = Object.freeze({
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
})
const GEO = /country|location|address|region|geograph|latitude|longitude|postal|territor|continent/i
const additionalGeography = (value, known) => Object.keys(value || {}).some(key => GEO.test(key)
  && !known.includes(key) && value[key] != null)

// This is qualified country inference, not a new native country field. Require
// the role's own assigned country office AND a state-qualified address for every
// alternative. No headquarters, company-wide default or bare city is sufficient.
export const greenhouseUsWorksiteScope = (record, provider) => {
  if (!Number.isSafeInteger(record?.id) || record.id < 1 || typeof record.title !== 'string' || !record.title.trim()
    || !Array.isArray(record.offices) || record.offices.length !== 1
    || (record.metadata != null && (!Array.isArray(record.metadata) || record.metadata.length))
    || additionalGeography(record, ['location', 'offices']) || additionalGeography(record.location, ['name'])) return null
  const office = record.offices[0]
  if (!office || additionalGeography(office, ['location'])) return null
  const assignedCountry = office.location == null && /^(?:US|USA|United States(?: of America)?)$/i.test(office.name || '')
  const assignedAddress = typeof office.location === 'string'
    ? office.location.match(/^([\p{L}][\p{L} .'-]*),\s*([\p{L} ]+),\s*(?:US|USA|United States(?: of America)?)$/u) : null
  if (!assignedCountry && !assignedAddress) return null
  let url
  try { url = new URL(record.absolute_url) } catch { return null }
  if (!['job-boards.greenhouse.io', 'job-boards.eu.greenhouse.io', 'boards.greenhouse.io', 'boards.eu.greenhouse.io'].includes(url.hostname)
    || url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
    || url.pathname !== `/${encodeURIComponent(provider.boardToken)}/jobs/${record.id}`) return null
  const label = record.location?.name
  if (NATIVE_INDIA_LOCATION.test(label || '')) return null
  const locations = qualifiedGreenhouseWorksites(label)
  if (!locations) return null
  const alternatives = locations.map(location => {
    const [city, stateCode] = location.split(',').map(value => value.trim())
    return { city, stateCode, state: US_STATES[stateCode] }
  })
  if (alternatives.some(location => !location.state)) return null
  // An individual office address can corroborate only its matching city/state.
  // It is not a country default for unrelated primary or additional worksites.
  if (!assignedCountry && alternatives.some(location => location.city.toLowerCase() !== assignedAddress[1].trim().toLowerCase()
    || location.state.toLowerCase() !== assignedAddress[2].trim().toLowerCase())) return null
  return { country: 'US', locations, proof: {
    jobId: String(record.id), country: 'US', title: record.title, nativeUrl: url.href,
    nativeLocation: label, nativeAssignedOffice: office.name, nativeAssignedOfficeAddress: office.location ?? null, alternatives,
    method: assignedCountry ? 'native-assigned-us-office-and-state-qualified-worksites'
      : 'matching-native-us-office-address-and-state-qualified-worksites',
    reference: { url: 'https://pe.usps.com/text/pub28/pub28apb.htm', reviewedOn: '2026-10-29',
      retainedFixture: 'scraper/esw/fixtures/usps-state-abbreviations-20261027.html',
      retainedFixtureSHA256: '0ba863b726007dc640f6f25b849830119a80f5d3056e4e5e472ce4793b2f997b' },
    sha256: createHash('sha256').update(JSON.stringify(record)).digest('hex'),
  } }
}
