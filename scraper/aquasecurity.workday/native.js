import { parse } from 'acorn'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { nativeCountryName, nativeDate, requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS = 'https://www.aquasec.com/about-us/careers/'
const COMPANY_UID = '91.001'
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const key = value => norm(value).replace(/\s/g, '')
const one = (values, label) => { requireNative(values.length === 1, `Aqua Security: missing or ambiguous ${label}`); return values[0] }
const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name)
const role = value => {
  const url = new URL(value, CAREERS)
  requireNative(url.origin === 'https://www.aquasec.com' && !url.username && !url.password && !url.search && !url.hash, 'Aqua Security: foreign or filtered role URL')
  const match = /^\/about-us\/careers\/co\/([a-z0-9-]+)\/([A-F0-9]{2}\.[A-F0-9]{3})\/([a-z0-9-]+)\/all\/?$/.exec(url.pathname)
  requireNative(match, 'Aqua Security: native role identity changed')
  return { id: match[2], locationSlug: match[1], url: url.href.replace(/\/?$/, '/') }
}

function account(doc) {
  const script = one(doc.nodes(node => node.tag === 'script' && node.attrs.id === 'comeet_script-js-extra'
    && !node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
    && /^(?:|(?:text|application)\/javascript)$/.test(node.attrs.type || '')), 'active Comeet configuration')
  const ast = parse(script.raw, { ecmaVersion: 'latest' })
  const declarations = ast.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
    .filter(node => node.id.type === 'Identifier' && node.id.name === 'comeetvar')
  const object = one(declarations, 'Comeet configuration declaration').init
  requireNative(object?.type === 'ObjectExpression', 'Aqua Security: native account configuration unavailable')
  const properties = new Map()
  for (const property of object.properties) {
    requireNative(property.type === 'Property' && property.kind === 'init' && !property.computed
      && property.key.type === 'Literal' && typeof property.key.value === 'string'
      && property.value.type === 'Literal' && !properties.has(property.key.value), 'Aqua Security: native account configuration changed')
    properties.set(property.key.value, property.value.value)
  }
  requireNative(properties.get('comeet_uid') === COMPANY_UID, 'Aqua Security: native employer account changed')
}

export function parseAquaListing(html) {
  const doc = document(html)
  account(doc)
  const anchors = doc.nodes(node => node.tag === 'a' && hasClass(node, 'careers_pos_item'))
  requireNative(anchors.length > 0 && anchors.length <= 200, 'Aqua Security: no enumerable current native listing')
  const records = anchors.map(anchor => {
    const identity = role(anchor.attrs.href)
    const text = cls => doc.text(one(doc.nodes(node => hasClass(node, cls), anchor), cls))
    const title = text('pos_name'), location = text('pos_location')
    requireNative(title && location, 'Aqua Security: listing title or location missing')
    return { ...identity, title, locations: [location], countries: [], department: text('pos_department') }
  })
  requireNative(new Set(records.map(row => row.id)).size === records.length, 'Aqua Security: duplicate native role identity')
  return { records, observedRows: records.length, reportedTotal: null, pageNumber: 1, lastPage: 1,
    nextURL: null, terminationKnown: true, fingerprint: JSON.stringify([...records].sort((a, b) => a.id.localeCompare(b.id))) }
}

export function parseAquaDetail(html, row) {
  const doc = document(html)
  account(doc)
  const postings = []
  const visit = value => {
    if (Array.isArray(value)) { value.forEach(visit); return }
    if (!value || typeof value !== 'object') return
    if ([value['@type']].flat().includes('JobPosting')) postings.push(value)
    if (value['@graph']) visit(value['@graph'])
  }
  for (const script of doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) visit(JSON.parse(script.raw))
  const posting = one(postings, 'native JobPosting')
  requireNative(role(posting.url).id === row.id && role(posting.url).url === row.url
    && posting.hiringOrganization?.name === 'Aqua Security', 'Aqua Security: role URL or employer mismatch')
  const title = doc.text(one(doc.nodes(node => hasClass(node, 'comeet-position-name')), 'visible native title'))
  const location = doc.text(one(doc.nodes(node => hasClass(node, 'comeet-position-location')), 'visible native location'))
  requireNative(norm(posting.title) === title && title === row.title && location === row.locations[0], 'Aqua Security: listing/detail title or location mismatch')
  requireNative(posting.jobLocation && !Array.isArray(posting.jobLocation), 'Aqua Security: unreviewed location inventory')
  const address = posting.jobLocation.address
  const countryRaw = typeof address?.addressCountry === 'object' && address.addressCountry?.['@type'] === 'Country'
    ? address.addressCountry.name : address?.addressCountry
  const country = nativeCountryName(countryRaw)
  requireNative(country && typeof address.addressLocality === 'string', 'Aqua Security: explicit native country or city missing')
  const apply = doc.nodes(node => node.tag === 'script' && node.attrs.type === 'comeet-applyform')
  requireNative(apply.length === 1 && apply[0].attrs['data-position-uid'] === row.id, 'Aqua Security: public application identity mismatch')
  const fact = { id: row.id, title, sourceURL: row.url, nativeListingRecord: row, nativeHiringOrganization: posting.hiringOrganization,
    nativeCountryAddresses: [{ raw: address, country, nativeCountryRaw: countryRaw }], nativeJobPosting: posting,
    nativeVisibleLocationTexts: [location], nativeApplicationURL: row.url, nativeDirectApplyFlag: null,
    nativePostedDate: nativeDate(posting.datePosted, { required: true }), nativeValidThrough: nativeDate(posting.validThrough),
    sourceScopeComplete: false, nativeCompanyUID: COMPANY_UID }
  if (country !== 'India') {
    requireNative(!/\bIndia\b/i.test(location) && !row.locationSlug.endsWith('-india'), 'Aqua Security: native country contradicts India listing')
    return { ...fact, excluded: true, exclusionReason: 'native-explicit-non-India-country' }
  }
  requireNative(/\bIndia\b/i.test(location) && row.locationSlug.endsWith('-india')
    && norm(address.addressLocality) && location.startsWith(norm(address.addressLocality) + ','), 'Aqua Security: explicit India geography disagrees')
  const description = one(doc.nodes(node => hasClass(node, 'comeet-position-description')), 'visible description')
  const requirements = one(doc.nodes(node => hasClass(node, 'comeet-position-requirements')), 'visible requirements')
  const descriptionText = doc.text(description), requirementsText = doc.text(requirements)
  requireNative(descriptionText.length >= 100 && requirementsText.length >= 100 && typeof posting.description === 'string', 'Aqua Security: full native content missing')
  // This publisher emits an empty About the Team heading in JSON-LD while
  // omitting that empty section from the visible page. Keep all actual content.
  const comparableSchema = posting.description.replace(/<b>About the Team<\/b>(?:<br\s*\/?>\s*)+(?=<b>Requirements<\/b>)/g, '')
  const schema = document(comparableSchema), schemaText = schema.text(schema.root)
  requireNative(key(schemaText) === key(`Description ${descriptionText} Requirements ${requirementsText}`), 'Aqua Security: visible/schema full content mismatch')
  return { ...fact, nativeSchemaDescription: posting.description,
    nativeVisibleDescriptionHTML: `<h3>Description</h3>${doc.inner(description)}<h3>Requirements</h3>${doc.inner(requirements)}` }
}

export async function runNativeAqua(options = {}) {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(120000)])
  signal.throwIfAborted()
  const config = { source: 'aquasecurity', companyName: 'Aqua Security', boardURL: CAREERS,
    maxRequests: 205, maxAggregateBytes: 32 * 1024 * 1024, detailConcurrency: 3,
    validateURL(value) { if (value !== CAREERS) role(value) },
    sameReadIdentity(left, right) { return left === CAREERS || right === CAREERS ? left === right : role(left).url === role(right).url },
    handoffs: [{ url: CAREERS, verify: html => account(document(html)) }],
    parseListing: parseAquaListing,
    candidateForIndia: row => row.locationSlug.endsWith('-india') && /\bIndia\b/i.test(row.locations[0]),
    parseDetail: parseAquaDetail,
    pageFingerprint: page => page.fingerprint }
  let jobs
  try { jobs = await createFirstPartyHTMLScraper(config).run({ ...options, signal }) }
  catch (error) { signal.throwIfAborted(); throw error }
  signal.throwIfAborted()
  const evidence = jobs[Symbol.for('jobverify.native-html-evidence')]
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: CAREERS, firstParty: true, listingComplete: false,
    pagesFetched: evidence?.pagesFetched || 0, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
    reason: `current-first-party-Comeet-role-details;observed-listing-records=${evidence?.observedListingCount ?? 'unknown'};returned-india-details=${jobs.length};whole-company-scope-unverified` })
}
