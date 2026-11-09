import { createHash } from 'node:crypto'
import { identifyPublicAtsBoard } from './publicAtsIdentity.js'
import { hasUnhandledGreenhouseGeography } from './greenhouseLocations.js'
import { isGreenhouseProspectPost } from './greenhouseProspects.js'

const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const display = new Intl.DisplayNames(['en'], { type: 'region' }), countries = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = display.of(code)
  if (name && name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) {
    countries.set(code.toLowerCase(), code)
    countries.set(name.toLowerCase(), code)
  }
}
for (const [name, code] of Object.entries({ IND: 'IN', USA: 'US', 'United States of America': 'US',
  GBR: 'GB', UK: 'GB', SGP: 'SG', CAN: 'CA', AUS: 'AU' })) countries.set(name.toLowerCase(), code)
const country = value => countries.get(text(value).toLowerCase()) || null
const BROAD = /\b(?:remote|hybrid|on[- ]site|in[- ]office|worldwide|global|anywhere|everywhere|all locations|APAC|EMEA|AMER|LATAM|Europe|Asia|Africa|North America|South America|Middle East)\b/i
const TALENT = /talent (?:community|network|pool)|speculative|future opportunities|general application/i
const GEO = /country|countries|location|address|geograph|region|latitude|longitude|postal|territor|continent/i
const unknownGeo = (value, allowed) => Object.keys(value || {}).some(key => GEO.test(key)
  && !allowed.includes(key) && value[key] != null)
const id = value => Number.isSafeInteger(value) && value > 0
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const boardRegion = (value, provider) => {
  try {
    const url = new URL(value), board = identifyPublicAtsBoard(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && board?.atsPlatform === 'greenhouse' && board.boardToken === provider.boardToken
      ? url.hostname.includes('.eu.') ? 'eu' : 'global' : null
  } catch { return null }
}
const expectedRegion = provider => {
  for (const value of [provider.runtimeInventoryVerification?.boardUrl, provider.companyCareerPage]) {
    const region = boardRegion(value, provider)
    if (region) return region
  }
  const regions = new Set((provider.bindingEvidence?.matchedLinks || []).map(value => boardRegion(value, provider)).filter(Boolean))
  // The standard Greenhouse template uses the global board unless a reviewed
  // URL pins its EU counterpart. Conflicting pins cannot establish authority.
  return regions.size > 1 ? null : [...regions][0] || 'global'
}
const roleIdentity = (record, provider, { definitionsOnly = false } = {}) => {
  if (!record || record.isListed === false || isGreenhouseProspectPost(record) || !id(record.id) || !text(record.title) || TALENT.test(record.title)
    || (!definitionsOnly && hasUnhandledGreenhouseGeography(record))) return null
  try {
    const url = new URL(record.absolute_url)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash
      || !['job-boards.greenhouse.io', 'boards.greenhouse.io', 'job-boards.eu.greenhouse.io', 'boards.eu.greenhouse.io'].includes(url.hostname)
      || url.pathname.replace(/\/+$/, '') !== `/${encodeURIComponent(provider.boardToken)}/jobs/${record.id}`) return null
    const region = url.hostname.includes('.eu.') ? 'eu' : 'global'
    if (region !== expectedRegion(provider)) return null
    return { jobId: String(record.id), url: url.href, region }
  } catch { return null }
}
const officeDefinition = office => {
  if (!office || !id(office.id) || !text(office.name) || office.location != null
    || !Array.isArray(office.child_ids) || office.child_ids.length
    || (office.parent_id != null && !id(office.parent_id)) || unknownGeo(office, ['location'])) return null
  return JSON.stringify({ id: office.id, name: text(office.name), location: null,
    child_ids: [], parent_id: office.parent_id ?? null })
}

// Embedded offices sometimes omit geography even though a current posting
// explicitly names that same sole office and country. Reconcile stable office
// IDs within this exact response; never infer a country from a city dictionary,
// another board, a remote/region label, or evidence cached from a previous run.
export const reconcileGreenhouseOfficeCountries = (records, provider) => {
  const definitions = new Map(), references = new Map(), invalid = new Set(), byId = new Map(), proofs = []
  if (!Array.isArray(records)) return { byId, proofs }
  for (const record of records) {
    const identity = roleIdentity(record, provider, { definitionsOnly: true })
    if (!identity || !Array.isArray(record.offices)) continue
    for (const office of record.offices) {
      if (!id(office?.id)) continue
      const definition = officeDefinition(office), previous = definitions.get(office.id)
      if (!definition || (previous && (previous.definition !== definition || previous.region !== identity.region))) invalid.add(office.id)
      else definitions.set(office.id, { definition, region: identity.region })
    }
    if (record.offices.length !== 1 || hasUnhandledGreenhouseGeography(record)) continue
    const office = record.offices[0], definition = officeDefinition(office)
    if (!definition || BROAD.test(office.name) || country(office.name)) continue
    const parts = text(record.location?.name).split(',').map(text)
    const code = parts.length === 2 && text(office.name).toLowerCase() === parts[0].toLowerCase() && country(parts[1])
    if (!code) continue
    const reference = { jobId: identity.jobId, nativeUrl: identity.url, nativeLocation: record.location.name,
      countryLabel: parts[1], country: code, region: identity.region, nativeRecordSha256: hash(record) }
    const current = references.get(office.id) || []
    current.push(reference)
    references.set(office.id, current)
  }
  for (const [officeId, values] of references) {
    if (invalid.has(officeId) || new Set(values.map(value => value.country)).size !== 1) continue
    const definition = definitions.get(officeId), office = JSON.parse(definition.definition)
    const references = values.sort((left, right) => left.jobId.localeCompare(right.jobId))
    const proof = { officeId, officeName: office.name, country: references[0].country, region: definition.region,
      boardToken: provider.boardToken, method: 'same-response-native-office-id-and-explicit-country-posting', references }
    proof.sha256 = hash(proof)
    proofs.push(proof)
    byId.set(officeId, { ...definition, country: proof.country, location: references[0].nativeLocation, proof })
  }
  return { byId, proofs }
}

export const greenhouseOfficeCountryForRole = (record, office, provider, scope) => {
  const identity = roleIdentity(record, provider), entry = scope?.byId?.get(office?.id)
  return identity && entry && identity.region === entry.region && officeDefinition(office) === entry.definition ? entry : null
}

// Only the mapper sees reconciled office labels. Each label is copied verbatim
// from a current role with that same office ID; original native data stays intact.
export const withGreenhouseOfficeCountries = (record, provider, scope) => {
  if (!Array.isArray(record?.offices) || !scope?.byId?.size) return record
  return { ...record, offices: record.offices.map(office => {
    const entry = greenhouseOfficeCountryForRole(record, office, provider, scope)
    return entry ? { ...office, location: entry.location,
      sourceScopeEvidence: { method: entry.proof.method, officeId: office.id, country: entry.country,
        nativeOfficeLocation: office.location, referenceJobId: entry.proof.references[0].jobId, sha256: entry.proof.sha256 } } : office
  }) }
}

export const greenhouseOfficeProofReason = proofs => proofs.length
  ? `:native-office-country-verified:${proofs.map(proof => `${proof.officeId}=${proof.country}@${proof.sha256}`).join(',')}` : ''
