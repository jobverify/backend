import { CANONICAL_CITIES } from '../utils/cities.js'

const clean = value => typeof value === 'string' ? value.normalize('NFKC').replace(/\s+/g, ' ').trim() : ''
const display = new Intl.DisplayNames(['en'], { type: 'region' })
const codes = new Set(), names = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = display.of(code)
  if (name && name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) {
    codes.add(code)
    // Legacy aliases display the canonical country's name too (FX/FR,
    // UK/GB). They must not overwrite that name with a different code.
    if (new Intl.Locale('und-' + code).region === code) names.set(name.toLowerCase(), code)
  }
}
names.set('united states of america', 'US')
names.set('usa', 'US')
names.set('ind', 'IN')
names.set('uk', 'GB')

const fail = message => {
  throw Object.assign(new Error('API portal native location scope: ' + message), {
    incompleteScope: true, abortRetries: true,
  })
}
const explicitCountry = location => {
  const parts = location.split(',').map(clean), last = parts.at(-1)
  const parenthetical = /\(([A-Za-z][A-Za-z ]+)\)$/.exec(location)
  const namedSuffix = parenthetical && names.get(clean(parenthetical[1]).toLowerCase())
  const countryPrefix = /^([A-Za-z][A-Za-z ]+) - .+/.exec(location)
  const namedPrefix = countryPrefix && names.get(clean(countryPrefix[1]).toLowerCase())
  // Twilio's public model explicitly names the work country in a remote
  // workplace ("Remote - India"). The remote qualifier supplies no country.
  const remoteCountry = /^Remote - ([A-Za-z][A-Za-z ]+?)(?=,|\s*\(|$)/i.exec(location)
  const namedRemote = remoteCountry && names.get(clean(remoteCountry[1]).toLowerCase())
  // This native country name contains its own comma. Match the whole
  // demonstrated suffix, rather than treating "Republic of" as a country.
  const commaCountry = /(?:^|,\s*)Korea,\s*Republic of$/i.test(location) ? 'KR' : null
  // Other arrangements of that literal are unreviewed. In particular an
  // appended "(India)" cannot replace its independently supplied country.
  if (!commaCountry && /(?<![\p{L}\p{N}_])Korea,\s*Republic of(?![\p{L}\p{N}_])/iu.test(location)) {
    fail('unsupported compound native country')
  }
  // Eaton publishes complete native addresses such as "Hadapsar, Pune,
  // Maharashtra, IND, 411013". The country is before the postal code here.
  // Require that explicit country label; a postcode or city never supplies it.
  const postalCountry = parts.length >= 4 && parts.every(Boolean) && /^[1-9]\d{5}$/.test(last)
    && /^(?:IND|India)$/i.test(parts.at(-2)) ? 'IN' : null
  // A two-component raw label ending IN may mean a US state. The reviewed
  // standardized field supplies an ISO suffix; raw labels require a name or
  // an unambiguous three-component country-code position.
  const finalCountry = names.get(last.toLowerCase()) || (parts.length >= 3 && codes.has(last.toUpperCase()) ? last.toUpperCase() : null)
  const supplied = [namedSuffix, namedPrefix, namedRemote, commaCountry, postalCountry, finalCountry].filter(Boolean)
  if (new Set(supplied).size > 1) fail('contradictory explicit native country')
  return supplied[0] || null
}
const standardizedCountry = (location, explicit) => {
  const parts = location.split(',').map(clean), last = parts.at(-1)
  // State-wide roles can use a region/country pair (native Micron example:
  // "Gujarat, India" / "GJ,IN"). Accept that shape only when the same raw
  // workplace independently names its country. A bare city or state cannot
  // acquire India scope from a two-component abbreviation alone.
  const supported = [1, 3].includes(parts.length) || parts.length === 2 && explicit != null
  const code = codes.has(last) ? last : names.get(last.toLowerCase())
  if (!supported || parts.some(part => !part) || !code) fail('unrecognized standardized country format')
  return code
}
const sameCity = (raw, standardized) => {
  const rawParts = raw.split(',').map(clean), standardizedParts = standardized.split(',').map(clean)
  if (rawParts.length > 2 || rawParts.length === 2
    && rawParts[1].toLowerCase() !== standardizedParts[1]?.toLowerCase()) return false
  const city = value => {
    const name = clean(value).toLowerCase()
    // Demonstrated role-owned campus/city aliases, not arbitrary suffix removal.
    const alias = { 'bangalore btp': 'bangalore', 'bangalore mg': 'bangalore', melaka: 'malacca', 'porto (maia)': 'porto' }[name] || name
    return clean(CANONICAL_CITIES[alias] || alias).toLowerCase()
  }
  const left = city(rawParts[0]), right = city(standardizedParts[0])
  return Boolean(left && right && left === right)
}

// Both arrays belong to this exact native role. A bare city is qualified only
// by its matching role-owned standardized city/country; other roles, employer
// headquarters and the requested search country cannot supply that evidence.
export const readEightfoldLocationScope = record => {
  if (!Array.isArray(record?.locations)
    || record.locations.some(value => !clean(value))) fail('native locations missing or malformed')
  const raw = record.locations.map(clean)
  const standardized = record.standardizedLocations
  if (standardized != null && (!Array.isArray(standardized) || standardized.length !== raw.length
    || standardized.some(value => !clean(value)))) fail('native location arrays disagree')
  // Eightfold also returns active postings with two empty native arrays. They
  // supply no work country; retain that uncertainty without losing other roles.
  if (!raw.length) return { location: null, country: null, indiaLocations: [],
    nativeLocations: [], standardizedLocations: standardized == null ? null : [], unresolved: true }
  const scopes = raw.map((location, index) => {
    const explicit = explicitCountry(location)
    if (standardized == null) return { country: explicit, location, unresolved: explicit == null }
    const normalized = clean(standardized[index])
    // A native Remote/Remote pair supplies no country and must not abort the
    // other verified roles or certify a complete country inventory.
    if (!explicit && /^remote$/i.test(location) && /^remote$/i.test(normalized)) return { country: null, location, unresolved: true }
    // Delhi is also a native region. Match the demonstrated region/country
    // pair exactly; unrelated city-only or ambiguous state codes stay invalid.
    const regional = location === 'Delhi' && /^DL,\s*IN$/.test(normalized)
    // Ericsson also supplies a bare standardized city for an otherwise fully
    // qualified workplace. Its exact same-role raw country remains the proof;
    // another city or an independently supplied country cannot borrow it.
    const sameBareCity = explicit && !normalized.includes(',') && !codes.has(normalized)
      && !names.has(normalized.toLowerCase()) && sameCity(location.split(',')[0], normalized)
    const code = sameBareCity ? explicit : standardizedCountry(normalized, explicit || (regional ? 'IN' : null))
    if (explicit && explicit !== code) fail('contradictory explicit native country')
    if (!explicit && !regional) {
      const site = /^([A-Z]{2})-([^(),]+) \((\d+)\)$/.exec(location)
      if (site && site[1] !== code) fail('contradictory site and standardized country')
      const alternatives = location.includes(' / ') ? location.split(' / ').map(clean) : null
      if (alternatives) {
        const matching = alternatives.filter(value => sameCity(value, normalized))
        if (alternatives.length > 8 || alternatives.some(value => !value || /\b(?:remote|worldwide|global|anywhere|region)\b/i.test(value))
          || matching.length !== 1 || normalized.split(',').length !== 3) fail('native alternative workplaces are unaligned')
        return { country: code, location: matching[0], unresolved: true }
      }
      if (normalized.split(',').length !== 3 || !sameCity(site ? site[2] : location, normalized)) fail('native city and standardized country are unaligned')
    }
    return { country: explicit || code, location, unresolved: false }
  })
  const indiaLocations = [...new Set(scopes.filter(scope => scope.country === 'IN').map(scope => scope.location))]
  return { location: indiaLocations[0] || raw[0],
    country: indiaLocations.length ? 'India' : scopes[0].country, indiaLocations,
    nativeLocations: [...record.locations],
    standardizedLocations: standardized == null ? null : [...standardized],
    unresolved: scopes.some(scope => scope.unresolved) }
}

export const nativeEightfoldLocationPairs = record => {
  readEightfoldLocationScope(record)
  return record.locations.map((location, index) => [clean(location), clean(record.standardizedLocations?.[index])])
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
}
