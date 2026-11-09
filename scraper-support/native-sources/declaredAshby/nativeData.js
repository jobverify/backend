import { readFileSync } from 'node:fs'
import { parse } from 'acorn'
import { readNativeDocument } from '../../utils/activeNativeHtml.js'
import { readLiteralModel } from '../literalModel.js'
import { countryName, normalizeText, unknownGeography } from '../jobPostingData.js'

const entities = JSON.parse(readFileSync(new URL('./htmlNamedEntities.json', import.meta.url)))
export const decode = value => String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (raw, key) => {
  if (key[0] !== '#') return entities[key + ';'] ?? raw
  const point = key[1].toLowerCase() === 'x' ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10)
  return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '\ufffd'
})
export const text = value => normalizeText(value)
const content = node => node.inert || ['script', 'style'].includes(node.tag) ? ''
  : text(node.children.map(child => typeof child === 'string' ? decode(child) : content(child)).join(' '))
export const plain = value => content(readNativeDocument(String(value ?? '')).nodes(node => node.tag === 'root')[0])
export const requireNative = (ok, message) => { if (!ok) throw Error('Declared Ashby native contract: ' + message) }
export const roleURL = (contract, value, id, application = false) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://jobs.ashbyhq.com' && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === `/${contract.boardSlug}/${id}${application ? '/application' : ''}`
  } catch { return false }
}
export const documentLinks = (html, base) => readNativeDocument(html).nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
  try { return [{ url: new URL(node.attrs.href, base).href, text: content(node), originalAttributes: { ...node.attrs } }] } catch { return [] }
})
export const nativeOrganization = (contract, value) => {
  try {
    const site = new URL(value?.publicWebsite)
    return value.name === contract.companyName && value.hostedJobsPageSlug === contract.boardSlug && value.organizationId === contract.organizationId
      && value.isDemoOrg === false && site.origin === contract.websiteOrigin && !site.username && !site.password
  } catch { return false }
}
export const appData = document => {
  const scripts = document.nodes(node => node.tag === 'script' && !node.inert && !node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
    && ['', 'text/javascript', 'application/javascript', 'module'].includes((node.attrs.type || '').trim().toLowerCase()))
  const property = node => !node.computed && node.property?.type === 'Identifier' ? node.property.name
    : node.property?.type === 'Literal' && typeof node.property.value === 'string' ? node.property.value : null
  const globalObject = node => node?.type === 'Identifier' && ['window', 'globalThis', 'self'].includes(node.name)
  const selectedTarget = node => node?.type === 'MemberExpression' && (
    globalObject(node.object) && property(node) === '__appData'
    || selectedTarget(node.object))
  const writes = [], unsupportedReferences = []
  for (const script of scripts) {
    // Parse website script syntax as data, never evaluate it. String values in
    // the published JSON remain terminal AST literals, not executable input.
    const queue = [{ node: parse(script.raw || '', { ecmaVersion: 'latest',
      sourceType: (script.attrs.type || '').trim().toLowerCase() === 'module' ? 'module' : 'script' }), parent: null }]
    while (queue.length) {
      const { node, parent } = queue.pop()
      if (!node || typeof node !== 'object') continue
      if (node.type === 'AssignmentExpression' && selectedTarget(node.left)
        || node.type === 'UpdateExpression' && selectedTarget(node.argument)
        || node.type === 'UnaryExpression' && node.operator === 'delete' && selectedTarget(node.argument)) writes.push({ script, node })
      // The observed inline profile publishes one literal and never reads or
      // passes that model elsewhere. Unsupported references can escape through
      // calls or aliases; no JavaScript side-effect interpretation is attempted.
      const initializerTarget = selectedTarget(node) && globalObject(node.object) && property(node) === '__appData'
        && parent?.type === 'AssignmentExpression' && parent.left === node && parent.operator === '='
      if (selectedTarget(node) && !initializerTarget
        || globalObject(node) && !(parent?.type === 'MemberExpression' && parent.object === node)
        || node.type === 'MemberExpression' && globalObject(node.object) && property(node) === null)
        unsupportedReferences.push({ script, start: node.start, end: node.end })
      if (node.type === 'Literal') continue
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) queue.push(...value.map(child => ({ node: child, parent: node })))
        else if (value && typeof value === 'object') queue.push({ node: value, parent: node })
      }
    }
  }
  requireNative(writes.length === 1 && writes[0].node.type === 'AssignmentExpression'
    && writes[0].node.operator === '=' && writes[0].node.right.type === 'ObjectExpression', 'Ambiguous app-data or nested property writes')
  requireNative(!unsupportedReferences.length, 'Ambiguous app-data references, mutation calls or aliases')
  const raw = writes[0].script.raw, match = /^\s*window\.__appData\s*=\s*/.exec(raw)
  requireNative(match && raw[match[0].length] === '{', 'App-data is not an unconditional object literal')
  const start = match[0].length
  let depth = 0, quote = false, escape = false, end = -1
  for (let at = start; at < raw.length; at++) {
    const char = raw[at]
    if (quote) { if (escape) escape = false;else if (char === '\\') escape = true;else if (char === '"') quote = false;continue }
    if (char === '"') quote = true
    else if (char === '{' || char === '[') depth++
    else if ((char === '}' || char === ']') && --depth === 0) { end = at + 1;break }
  }
  requireNative(end > start && end === writes[0].node.right.end && /^\s*;/.test(raw.slice(end)), 'App-data literal has unsupported trailing syntax')
  return readLiteralModel(raw.slice(start, end)).value
}
// Preserve original literal UTC spelling, including the actual API +00:00.
export const nativeDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|\+00:00)$/.test(value)) return null
  const canonical = value.replace(/\+00:00$/, 'Z'), milliseconds = Date.parse(canonical)
  if (!Number.isFinite(milliseconds)) return null
  return new Date(milliseconds).toISOString() === (canonical.includes('.') ? canonical : canonical.replace('Z', '.000Z')) ? value : null
}
export const locationNames = record => [record.location, ...(record.secondaryLocations || []).map(place => place.location)].map(text)
export const nativePlaces = (record, schema) => {
  const places = [{ location: record.location, address: record.address }, ...(record.secondaryLocations || [])].map(place => {
    const address = place.address?.postalAddress || place.address || {}
    const explicitCountry = countryName(address.addressCountry), namedCountry = countryName(place.location)
    const conflict = Boolean(address.addressCountry && !explicitCountry || explicitCountry && namedCountry && explicitCountry !== namedCountry)
    return { originalLocation: place.location, originalAddress: place.address, country: conflict ? null : explicitCountry || namedCountry,
      conflict, city: text(address.addressLocality) || null, state: text(address.addressRegion) || null }
  })
  const applicants = schema?.applicantLocationRequirements == null ? [] : Array.isArray(schema.applicantLocationRequirements)
    ? schema.applicantLocationRequirements : [schema.applicantLocationRequirements]
  const applicantCountries = applicants.map(value => countryName(value?.name))
  const applicantConflict = applicantCountries.length > 0 && (applicantCountries.some(value => !value)
    || places.some(place => place.country && !applicantCountries.includes(place.country)))
  const countries = [...new Set(places.map(place => place.country).filter(Boolean))]
  const schemaLocations = schema?.jobLocation == null ? [] : Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
  const schemaAddresses = schemaLocations.map(place => place?.address?.postalAddress || place?.address || {})
  const schemaCountries = schemaAddresses.map(address => countryName(address.addressCountry))
  const primary = places[0]
  const same = (a, b) => Boolean(text(a) && text(b) && text(a).toLowerCase() === text(b).toLowerCase())
  const schemaPlaceCorrespondence = schemaAddresses.map((address, index) => {
    const cityMatches = text(address.addressLocality) ? places.filter(place =>
      same(address.addressLocality, place.city) || same(address.addressLocality, place.originalLocation)) : []
    const regionMatches = !text(address.addressLocality) && text(address.addressRegion) ? places.filter(place =>
      same(address.addressRegion, place.state) || same(address.addressRegion, place.originalLocation)) : []
    const matches = cityMatches.length ? cityMatches : regionMatches
    const countryMatches = matches.filter(place => place.country && place.country === schemaCountries[index])
    const relevant = countryMatches.length ? countryMatches : matches
    const countryConflict = Boolean(schemaCountries[index] && matches.length
      && matches.every(place => place.country && place.country !== schemaCountries[index]))
    const stateConflict = Boolean(cityMatches.length && text(address.addressRegion) && relevant.length
      && relevant.every(place => place.state && !same(place.state, address.addressRegion)))
    return { schemaIndex: index, nativePlaceIndexes: matches.map(place => places.indexOf(place)),
      matchingCountryPlaceIndexes: countryMatches.map(place => places.indexOf(place)), countryConflict, stateConflict }
  })
  const correspondingPlaceConflict = schemaPlaceCorrespondence.some(place => place.countryConflict || place.stateConflict)
  const primarySchemaConflict = schemaAddresses.length === 1 && primary && (
    primary.country && schemaCountries[0] && primary.country !== schemaCountries[0]
    || primary.city && text(schemaAddresses[0].addressLocality) && text(primary.city).toLowerCase() !== text(schemaAddresses[0].addressLocality).toLowerCase()
    || primary.state && text(schemaAddresses[0].addressRegion) && text(primary.state).toLowerCase() !== text(schemaAddresses[0].addressRegion).toLowerCase())
  const schemaConflict = Boolean(primarySchemaConflict || correspondingPlaceConflict || schemaAddresses.some((address, index) =>
    address.addressCountry && !schemaCountries[index] || schemaCountries[index] && !countries.includes(schemaCountries[index])))
  const unresolved = applicantConflict || schemaConflict || places.some(place => !place.country)
  const single = countries.length === 1 && !unresolved ? countries[0] : null
  const knownSchemaConflict = Boolean(primarySchemaConflict || correspondingPlaceConflict || schemaAddresses.some((_address, index) =>
    schemaCountries[index] && !countries.includes(schemaCountries[index])))
  // Select a proven target worksite; preserve every original foreign/unknown
  // place below. A positive India allowance is independent of uncertainty in
  // other countries, while a known contradiction still blocks this projection.
  const indiaPlaces = !knownSchemaConflict && (!applicants.length || applicantCountries.includes('India'))
    ? places.filter(place => place.country === 'India' && !place.conflict) : []
  const selected = indiaPlaces.length ? indiaPlaces : single ? places : []
  const selectedCountry = indiaPlaces.length ? 'India' : single
  return { ...unknownGeography(), country: selectedCountry, city: selected.length === 1 ? selected[0].city : null,
    state: selected.length === 1 ? selected[0].state : null,
    location: selectedCountry ? selected.map(place => [place.city, place.state, place.country].filter(Boolean).join(', ')).join('; ') : null,
    locations: selectedCountry ? selected.map(place => [place.city, place.state, place.country].filter(Boolean).join(', ')) : [],
    indiaWorksiteQualified: indiaPlaces.length > 0,
    publicProjection: { kind: indiaPlaces.length ? 'explicit-native-india-worksites' : single ? 'single-native-country' : 'no-single-country-projection',
      originalPlaceIndexes: selected.map(place => places.indexOf(place)), knownSchemaConflict },
    countries, unresolved, originalPlaces: places, originalApplicantRequirements: schema?.applicantLocationRequirements ?? null,
    applicantCountries, applicantConflict, originalSchemaJobLocations: schema?.jobLocation ?? null, schemaCountries, schemaConflict,
    schemaPlaceCorrespondence }
}
export const fullCriteria = posting => {
  const pieces = [plain(posting.descriptionHtml)]
  const walk = value => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(walk);return }
    for (const [name, part] of Object.entries(value)) {
      if (name === 'descriptionHtml') continue
      if (typeof part === 'string' && /html$/i.test(name)) pieces.push(plain(part))
      else if (part && typeof part === 'object') walk(part)
    }
  }
  walk(posting)
  for (const tier of posting.compensationTiers || []) pieces.push(text(decode(tier.title)), text(decode(tier.tierSummary)))
  if (typeof posting.compensationTierSummary === 'string') pieces.push(text(decode(posting.compensationTierSummary)))
  return pieces.filter(Boolean).join('\n\n')
}
