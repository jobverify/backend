import { readFileSync } from 'node:fs'
import { parse } from 'acorn'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'
import { countryName, normalizeText, unknownGeography } from '../../scraper-support/native-sources/jobPostingData.js'

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
export const requireNative = (ok, message) => { if (!ok) throw Error('Zapier native contract: ' + message) }
export const roleURL = (value, id, application = false) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://jobs.ashbyhq.com' && !url.username && !url.password && !url.search && !url.hash
      && url.pathname === `/zapier/${id}${application ? '/application' : ''}`
  } catch { return false }
}
export const documentLinks = (html, base) => readNativeDocument(html).nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
  try { return [{ url: new URL(node.attrs.href, base).href, text: content(node), originalAttributes: { ...node.attrs } }] } catch { return [] }
})
export const nativeOrganization = value => {
  try {
    const site = new URL(value?.publicWebsite)
    return value.name === 'Zapier' && value.hostedJobsPageSlug === 'zapier' && value.organizationId === '445b8e3d-921a-4001-9ef9-fee6982cf7af'
      && value.isDemoOrg === false && site.origin === 'https://zapier.com' && !site.username && !site.password
  } catch { return false }
}
export const appData = document => {
  const scripts = document.nodes(node => node.tag === 'script' && !node.inert && !node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
    && ['', 'text/javascript', 'application/javascript'].includes(node.attrs.type || ''))
  const property = node => !node.computed && node.property?.type === 'Identifier' ? node.property.name
    : node.property?.type === 'Literal' && typeof node.property.value === 'string' ? node.property.value : null
  const selectedTarget = node => node?.type === 'MemberExpression' && (
    node.object?.type === 'Identifier' && ['window', 'globalThis'].includes(node.object.name) && property(node) === '__appData'
    || selectedTarget(node.object))
  const writes = []
  for (const script of scripts) {
    // Parse website script syntax as data, never evaluate it. String values in
    // the published JSON remain terminal AST literals, not executable input.
    const queue = [parse(script.raw || '', { ecmaVersion: 'latest', sourceType: 'script' })]
    while (queue.length) {
      const node = queue.pop()
      if (!node || typeof node !== 'object') continue
      if (node.type === 'AssignmentExpression' && selectedTarget(node.left)
        || node.type === 'UpdateExpression' && selectedTarget(node.argument)
        || node.type === 'UnaryExpression' && node.operator === 'delete' && selectedTarget(node.argument)) writes.push({ script, node })
      if (node.type === 'Literal') continue
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) queue.push(...value)
        else if (value && typeof value === 'object') queue.push(value)
      }
    }
  }
  requireNative(writes.length === 1 && writes[0].node.type === 'AssignmentExpression'
    && writes[0].node.operator === '=' && writes[0].node.right.type === 'ObjectExpression', 'Ambiguous app-data or nested property writes')
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
export const nativeDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null
  const milliseconds = Date.parse(value)
  if (!Number.isFinite(milliseconds)) return null
  return new Date(milliseconds).toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z')) ? value : null
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
  const primarySchemaConflict = schemaAddresses.length === 1 && primary && (
    primary.country && schemaCountries[0] && primary.country !== schemaCountries[0]
    || primary.city && text(schemaAddresses[0].addressLocality) && text(primary.city).toLowerCase() !== text(schemaAddresses[0].addressLocality).toLowerCase()
    || primary.state && text(schemaAddresses[0].addressRegion) && text(primary.state).toLowerCase() !== text(schemaAddresses[0].addressRegion).toLowerCase())
  const schemaConflict = Boolean(primarySchemaConflict || schemaAddresses.some((address, index) =>
    address.addressCountry && !schemaCountries[index] || schemaCountries[index] && !countries.includes(schemaCountries[index])))
  const unresolved = applicantConflict || schemaConflict || places.some(place => !place.country)
  const single = countries.length === 1 && !unresolved ? countries[0] : null
  return { ...unknownGeography(), country: single, city: single && places.length === 1 ? places[0].city : null,
    state: single && places.length === 1 ? places[0].state : null,
    location: single ? places.map(place => [place.city, place.state, place.country].filter(Boolean).join(', ')).join('; ') : null,
    locations: single ? places.map(place => [place.city, place.state, place.country].filter(Boolean).join(', ')) : [],
    countries, unresolved, originalPlaces: places, originalApplicantRequirements: schema?.applicantLocationRequirements ?? null,
    applicantCountries, applicantConflict, originalSchemaJobLocations: schema?.jobLocation ?? null, schemaCountries, schemaConflict }
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
