import { parse } from 'acorn'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { nativeCountryName, nativeLocationCountryName, nativeDate, requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS = 'https://arize.com/careers/'
const one = (values, label) => { requireNative(values.length === 1, `Arize AI: missing or ambiguous ${label}`); return values[0] }
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const countryFromLabel = value => nativeLocationCountryName(norm(value).replace(/^Remote\s*\((.*)\)$/i, '$1'))
const countryFromFlag = value => {
  const points = typeof value === 'string' ? [...value].map(character => character.codePointAt(0)) : []
  return points.length === 2 && points.every(point => point >= 0x1f1e6 && point <= 0x1f1ff)
    ? nativeCountryName(String.fromCharCode(...points.map(point => point - 0x1f1e6 + 65))) : null
}
const executable = node => node.tag === 'script' && !node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
  && /^(?:|(?:text|application)\/javascript)$/i.test(node.attrs.type || '')

function literal(node) {
  if (node?.type === 'Literal' && !node.regex && (node.value === null || ['string', 'number', 'boolean'].includes(typeof node.value))) return node.value
  if (node?.type === 'ArrayExpression') return node.elements.map(literal)
  requireNative(node?.type === 'ObjectExpression', 'Arize AI: nonliteral native listing')
  const values = new Map()
  for (const property of node.properties) {
    requireNative(property.type === 'Property' && property.kind === 'init' && !property.computed && property.key.type === 'Literal'
      && typeof property.key.value === 'string' && !values.has(property.key.value), 'Arize AI: duplicate or unreviewed native listing field')
    values.set(property.key.value, literal(property.value))
  }
  return Object.fromEntries(values)
}

function roleURL(value) {
  const url = new URL(value)
  requireNative(url.origin === 'https://arize.com' && !url.username && !url.password && !url.hash && url.pathname === '/role/'
    && [...url.searchParams].length === 1 && /^\d+$/.test(url.searchParams.get('gh_jid') || ''), 'Arize AI: public native role URL changed')
  return url
}

export function readArizeDate(value, options = {}) {
  if (value == null || value === '') return nativeDate(value, options)
  requireNative(typeof value === 'string', 'Arize AI: invalid native date')
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(Z|([+-])(\d{2}):(\d{2}))$/.exec(value)
  requireNative(match, 'Arize AI: unreviewed native publication date format')
  nativeDate(`${match[1]}T${match[2]}Z`, { required: true })
  requireNative(!match[4] || Number(match[5]) <= 14 && Number(match[6]) < 60 && (match[5] !== '14' || match[6] === '00'), 'Arize AI: invalid native timezone offset')
  const date = nativeDate(new Date(value).toISOString(), options)
  return { ...date, raw: value, precision: 'second', exact: true }
}

export function parseArizeListing(html) {
  const doc = document(html)
  requireNative(doc.text(one(doc.nodes(node => node.tag === 'h1'), 'careers heading')) === 'Careers', 'Arize AI: careers identity changed')
  requireNative(one(doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'canonical careers URL').attrs.href === CAREERS,
    'Arize AI: careers canonical identity changed')
  const section = one(doc.nodes(node => node.attrs['x-data'] === 'careersJobBoard()'), 'active native careers renderer')
  requireNative(doc.nodes(node => node.tag === 'script' && node.attrs.src?.startsWith('https://arize.com/wp-content/themes/arize-2022/includes/js/alpine.min.js')
    && !Object.hasOwn(node.attrs, 'nomodule') && /^(?:|(?:text|application)\/javascript)$/i.test(node.attrs.type || '')).length === 1,
  'Arize AI: active Alpine loader unavailable')
  // Interpret only the reviewed declarative renderer. Template fallback text
  // never supplies visible role content or authorizes a different URL pattern.
  const templates = doc.nodes(node => node.children.some(child => typeof child === 'object' && child.tag === 'template'
    && child.attrs['x-for'] === '(job, index) in filtered'), section)
    .flatMap(node => node.children.filter(child => typeof child === 'object' && child.tag === 'template' && child.attrs['x-for'] === '(job, index) in filtered'))
  const template = one(templates, 'native job template')
  requireNative(!Object.hasOwn(template.attrs, 'hidden') && !Object.hasOwn(template.attrs, 'inert') && !template.attrs.style
    && template.children.some(child => typeof child === 'object' && child.tag === 'a' && child.attrs[':href'] === '`/role/?gh_jid=${job.id}`'),
  'Arize AI: native role renderer identity changed')
  const scripts = doc.nodes(executable).filter(node => node.raw?.includes('function careersJobBoard'))
  const script = one(scripts, 'native listing script'), ast = parse(script.raw, { ecmaVersion: 'latest' })
  const handler = one(ast.body.filter(node => node.type === 'FunctionDeclaration' && node.id.name === 'careersJobBoard'), 'native listing function')
  const result = one(handler.body.body, 'native listing return')
  requireNative(result.type === 'ReturnStatement' && result.argument?.type === 'ObjectExpression', 'Arize AI: native listing return changed')
  const properties = result.argument.properties
  const jobs = one(properties.filter(property => property.type === 'Property' && property.key.name === 'jobs' && property.kind === 'init'), 'native jobs array')
  const filtered = one(properties.filter(property => property.type === 'Property' && property.key.name === 'filtered' && property.kind === 'get'), 'native listing filter')
  requireNative(filtered.value.body.body.some(node => node.type === 'ReturnStatement' && node.argument?.type === 'CallExpression'
    && node.argument.callee?.object?.type === 'MemberExpression' && node.argument.callee.object.object?.type === 'ThisExpression'
    && node.argument.callee.object.property?.name === 'jobs' && node.argument.callee.property?.name === 'filter'), 'Arize AI: listing data flow changed')
  const records = literal(jobs.value)
  requireNative(Array.isArray(records) && records.length > 0 && records.length <= 500, 'Arize AI: no enumerable current native jobs')
  const identities = new Set()
  const rows = records.map(record => {
    requireNative(Number.isSafeInteger(record.id) && record.id > 0 && !identities.has(record.id)
      && norm(record.title) && norm(record.location) && norm(record.locationInfo?.city), 'Arize AI: malformed or duplicate native listing identity')
    identities.add(record.id)
    return { id: String(record.id), title: record.title, url: `https://arize.com/role/?gh_jid=${record.id}`,
      locations: [record.location], countries: [], nativeRecord: record }
  })
  return { records: rows, observedRows: rows.length, reportedTotal: null, pageNumber: 1, lastPage: 1,
    nextURL: null, terminationKnown: true, fingerprint: JSON.stringify([...rows].sort((left, right) => left.id.localeCompare(right.id))) }
}

export function parseArizeDetail(html, row) {
  const doc = document(html), postings = []
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit)
    if (!value || typeof value !== 'object') return
    if ([value['@type']].flat().includes('JobPosting')) postings.push(value)
    if (value['@graph']) visit(value['@graph'])
  }
  for (const script of doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) visit(JSON.parse(script.raw))
  const posting = one(postings, 'native JobPosting')
  requireNative(posting.identifier?.name === 'Greenhouse' && posting.identifier.value === row.id
    && posting.hiringOrganization?.name === 'Arize AI' && posting.hiringOrganization.sameAs === 'https://arize.com/',
  'Arize AI: native employer or role identity mismatch')
  const title = doc.text(one(doc.nodes(node => node.tag === 'h1'), 'visible title'))
  requireNative(title === row.title && norm(posting.title) === title, 'Arize AI: native title mismatch')
  const locationBlocks = doc.nodes(node => node.tag === 'div' && node.children.some(child => typeof child === 'object' && child.tag === 'h4' && doc.text(child) === 'Location'))
  const locations = [...new Set(locationBlocks.map(node => doc.text(one(doc.nodes(child => child.tag === 'p', node), 'visible location'))))]
  requireNative(locations.length === 1 && locations[0] === row.locations[0], 'Arize AI: listing and visible location disagree')
  requireNative(posting.jobLocation && !Array.isArray(posting.jobLocation) && posting.jobLocation.address
    && typeof posting.jobLocation.address.addressLocality === 'string', 'Arize AI: unreviewed native location inventory')
  const address = posting.jobLocation.address
  requireNative(address.addressLocality === locations[0], 'Arize AI: native schema location mismatch')
  requireNative(address.addressCountry == null || typeof address.addressCountry === 'string' && nativeCountryName(address.addressCountry),
    'Arize AI: unreviewed native country representation')
  const country = nativeCountryName(address.addressCountry) || countryFromLabel(address.addressLocality)
  requireNative(country, 'Arize AI: native country remains unresolved')
  const listingCountry = countryFromLabel(row.locations[0])
  requireNative(!listingCountry || listingCountry === country, 'Arize AI: native country contradicts listing')
  const flagCountry = countryFromFlag(row.nativeRecord.locationInfo.flag)
  requireNative(!flagCountry || country === flagCountry, 'Arize AI: country flag contradicts native detail')
  const form = one(doc.nodes(node => node.tag === 'form' && node.attrs.id === 'application-job-frm'), 'native application form')
  requireNative(one(doc.nodes(node => node.tag === 'input' && node.attrs.name === 'job_id', form), 'native application role identity').attrs.value === row.id,
    'Arize AI: native application identity mismatch')
  const description = one(doc.nodes(node => (node.attrs.class || '').split(/\s+/).includes('prose')), 'visible full description')
  const schemaHTML = typeof posting.description === 'string' ? posting.description.replace(/\\"/g, '"').replace(/\\n/g, '\n') : ''
  const schema = document(schemaHTML), text = doc.text(description)
  requireNative(text.length >= 100 && schema.text(schema.root).replace(/\s/g, '') === text.replace(/\s/g, ''), 'Arize AI: visible/schema full content mismatch')
  const posted = readArizeDate(posting.datePosted, { required: true }), closing = readArizeDate(posting.validThrough)
  requireNative(!closing.iso || closing.iso >= posted.iso, 'Arize AI: native expiry precedes publication')
  const city = row.nativeRecord.locationInfo.city
  const fact = { id: row.id, title, sourceURL: row.url, nativeListingRecord: row, nativeJobPosting: posting,
    nativeHiringOrganization: posting.hiringOrganization,
    nativeCountryAddresses: [{ raw: { ...address, addressLocality: city }, country, nativeCountryRaw: address.addressCountry || address.addressLocality }],
    nativeLocationEvidence: { schemaAddress: address, visibleLocation: locations[0], listingLocation: row.locations[0], listingCity: city },
    nativeVisibleLocationTexts: locations, nativeApplicationURL: row.url, nativeDirectApplyFlag: posting.directApply ?? null,
    nativeSchemaDescription: posting.description, nativeVisibleDescriptionHTML: doc.inner(description), nativePostedDate: posted,
    nativeValidThrough: closing, sourceScopeComplete: false }
  if (country !== 'India') return { ...fact, excluded: true, exclusionReason: 'native-explicit-non-India-country' }
  requireNative(/\bIndia\b/i.test(locations[0]) && norm(city) && !/^(?:Remote|India)$/i.test(city)
    && locations[0].toLowerCase().includes(city.toLowerCase()), 'Arize AI: explicit India city evidence unresolved')
  return fact
}

export async function runNativeArize(options = {}) {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(120000)])
  signal.throwIfAborted()
  const config = { source: 'arizeai', companyName: 'Arize AI', boardURL: CAREERS,
    maxRequests: 505, maxAggregateBytes: 32 * 1024 * 1024, detailConcurrency: 3,
    validateURL(value) { if (value !== CAREERS) roleURL(value) }, sameReadIdentity: (left, right) => left === right,
    handoffs: [{ url: CAREERS, verify: parseArizeListing }], parseListing: parseArizeListing,
    candidateForIndia: row => !/talent (?:community|pool|network)|general application/i.test(row.title)
      && (/\bIndia\b/i.test(row.locations[0]) || row.nativeRecord.locationInfo.flag === '🇮🇳'),
    parseDetail: parseArizeDetail, pageFingerprint: page => page.fingerprint }
  let jobs
  try { jobs = await createFirstPartyHTMLScraper(config).run({ ...options, signal }) }
  catch (error) { signal.throwIfAborted(); throw error }
  signal.throwIfAborted()
  const evidence = jobs[Symbol.for('jobverify.native-html-evidence')]
  return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: CAREERS, firstParty: true, listingComplete: false,
    pagesFetched: evidence?.pagesFetched || 0, reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
    reason: `current-first-party-Arize-native-job-list-and-details;observed-listing-records=${evidence?.observedListingCount ?? 'unknown'};returned-india-details=${jobs.length};whole-company-scope-unverified` })
}
