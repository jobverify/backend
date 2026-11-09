import { readNativeDocument, decodeNativeEntities } from '../utils/activeNativeHtml.js'
import { readLiteralModel } from './literalModel.js'

export const normalizeText = value => String(value ?? '').replace(/\s+/g, ' ').trim()
export const nodeText = node => node.inert || ['script', 'style'].includes(node.tag) ? ''
  : normalizeText(node.tag === 'title' ? decodeNativeEntities(node.raw || '')
    : node.children.map(child => typeof child === 'string' ? decodeNativeEntities(child) : nodeText(child)).join(' '))
export const plainHTML = html => nodeText(readNativeDocument(String(html ?? '')).nodes(node => node.tag === 'root')[0])
export const originalLinks = (document, base) => document.nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
  try { return [{ url: new URL(node.attrs.href, base).href, text: nodeText(node), attrs: { ...node.attrs } }] } catch { return [] }
})
export const readJobPosting = (html, { rawControls = false } = {}) => {
  const document = readNativeDocument(html), candidates = [], errors = []
  const inspect = (value, syntax, raw) => {
    if (Array.isArray(value)) { value.forEach(item => inspect(item, syntax, raw));return }
    if (!value || typeof value !== 'object') return
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
    if (types.includes('JobPosting')) candidates.push({ model: value, syntax, raw })
    if (Array.isArray(value['@graph'])) value['@graph'].forEach(item => inspect(item, syntax, raw))
  }
  for (const script of document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) {
    try {
      const parsed = readLiteralModel(script.raw || '', { rawControls })
      inspect(parsed.value, { validJSON: parsed.validJSON, rawControlCharacters: parsed.rawControlCharacters }, script.raw)
    } catch (error) { errors.push({ message: error.message, duplicateKeys: error.duplicateKeys ?? [] }) }
  }
  return { document, candidates, errors, candidate: candidates.length === 1 ? candidates[0] : null }
}

// Explicit supported ISO 3166-1 alpha-2 country/territory codes. DisplayNames
// alone also resolves unknown, macroregion and special codes (ZZ, EU, etc.).
// Those labels do not establish a role's worksite country.
const countryCodes = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(/\s+/)
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const supportedCountries = new Map(countryCodes.flatMap(code => {
  const name = regionNames.of(code)
  return name && name !== code ? [[code.toLowerCase(), name], [name.toLowerCase(), name]] : []
}))
export const countryName = value => {
  const raw = normalizeText(typeof value === 'object' && value ? value.name : value)
  if (/^(?:US|USA|United States(?: of America)?)$/i.test(raw)) return 'United States'
  if (/^(?:CA|CAN|Canada)$/i.test(raw)) return 'Canada'
  if (/^(?:IN|IND|India)$/i.test(raw)) return 'India'
  return supportedCountries.get(raw.toLowerCase()) ?? null
}
export const geography = model => {
  const places = Array.isArray(model?.jobLocation) ? model.jobLocation : model?.jobLocation ? [model.jobLocation] : []
  const qualified = [], originals = [], unknown = []
  for (const place of places) {
    const address = place?.address
    originals.push(place)
    const country = countryName(address?.addressCountry)
    if (!country) { unknown.push(place);continue }
    const city = normalizeText(address.addressLocality) || null, state = normalizeText(address.addressRegion) || null
    qualified.push({ country, city, state, location: [city, state, country].filter(Boolean).join(', ') })
  }
  const names = [...new Set(qualified.map(place => place.country))]
  const single = qualified.length === 1 && unknown.length === 0 ? qualified[0] : null
  return { country: names.length === 1 && unknown.length === 0 ? names[0] : null,
    city: single?.city ?? null, state: single?.state ?? null, location: single?.location ?? null,
    locations: qualified.map(place => place.location), countries: names, unresolved: places.length === 0 || unknown.length > 0,
    originalJobLocations: originals }
}
export const unknownGeography = () => ({ country: null, city: null, state: null, location: null, locations: [], countries: [], unresolved: true, originalJobLocations: [] })
export const postingDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)
  && Number.isFinite(Date.parse(value)) ? value : null
export const simpleField = value => typeof value === 'string' ? normalizeText(decodeNativeEntities(value)) || null : null
export const nativeFields = model => ({ employmentType: simpleField(Array.isArray(model?.employmentType) && model.employmentType.length === 1 ? model.employmentType[0] : model?.employmentType),
  experienceRequired: simpleField(model?.experienceRequirements), minimumQualification: simpleField(model?.educationRequirements),
  preferredQualification: null, requiredSkills: [], postingDate: postingDate(model?.datePosted), closingDate: null })
export const appliesToIndia = job => job.sourceNativeCountryCodes?.includes('India') || job.sourceCountryScopeUnresolved === true
