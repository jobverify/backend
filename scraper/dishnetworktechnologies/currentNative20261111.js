import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { decodeHTML } from 'entities'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName, nativeDate } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { withCallerSignal } from '../abmknowledgeware/publicIntake.js'

const HOME = 'https://echostar.com/'
const CAREERS = HOME + 'careers'
const INDIA = CAREERS + '/locations/india'
const PROGRAM = 'https://jobs.echostar.com'
const CANONICAL = 'https://dish.jibeapply.com'
const SEARCH_CLIENT = 'https://app.jibecdn.com/prod/search/4.11.225/main.js'
const DESCRIPTION_CLIENT = 'https://app.jibecdn.com/prod/descriptions/1.1.100/main.js'
const SEARCH_SHA = '8fa15e15e8165865026e2f5768af0160b4e1739096302d078e540131894c7f3f'
const DESCRIPTION_SHA = 'fc31de5557e316926aaa23755d10152e33f418ebbbdb731fd20b32023a93d880'
const EMPLOYER = 'EchoStar'
// Exact state/label pairs in the captured current native page. These reconcile
// existing explicit US locations; they never identify a country or add a city.
const nativeUSStateLabels = new Map([['Arizona', 'AZ'], ['Illinois', 'IL'], ['Tennessee', 'TN'], ['Michigan', 'MI'], ['Ohio', 'OH']])
const hash = value => createHash('sha256').update(value).digest('hex')
const need = (condition, reason) => {
  if (!condition) throw Object.assign(Error('DISH current native recruitment: ' + reason), { abortRetries: true, code: 'NATIVE_JIBE_CONTRACT' })
}
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const one = (values, name) => { need(values.length === 1, 'one active ' + name + ' required'); return values[0] }
const executable = node => !Object.hasOwn(node.attrs, 'nomodule') && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || '')
const textBlocks = new Set(['root', 'html', 'body', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'section', 'article', 'main', 'header', 'footer', 'br', 'hr'])

function fullText(html) {
  const doc = readNativeDocument(html)
  const text = node => {
    if (typeof node === 'string') return decodeHTML(node)
    if (node.inert || ['script', 'style', 'title'].includes(node.tag)) return ''
    const content = node.children.map(text).join('')
    return textBlocks.has(node.tag) ? ' ' + content + ' ' : content
  }
  return norm(text(one(doc.nodes(n => n.tag === 'root'), 'criteria root')))
}

function document(html) {
  const doc = readNativeDocument(html), bases = doc.nodes(n => n.tag === 'base')
  need(bases.length <= 1 && bases.every(n => n.attrs.href === '/' || n.attrs.href === ''), 'unreviewed native base URL')
  return doc
}

function uniqueJSONKeys(node) {
  if (node.type === 'ArrayExpression') node.elements.forEach(uniqueJSONKeys)
  if (node.type !== 'ObjectExpression') return
  const keys = new Set()
  for (const property of node.properties) {
    need(property.type === 'Property' && !property.computed && property.kind === 'init', 'unreviewed native JSON property')
    const key = property.key.type === 'Literal' ? String(property.key.value) : property.key.name
    need(!keys.has(key), 'duplicate native JSON key ' + key); keys.add(key)
    uniqueJSONKeys(property.value)
  }
}

function json(raw) {
  const value = JSON.parse(raw)
  uniqueJSONKeys(parse('(' + raw + ')', { ecmaVersion: 'latest' }).body[0].expression)
  return value
}

// Parse only a literal JSON right-hand side of an active top-level assignment.
// No publisher script is evaluated, and quoted/inert data cannot declare it.
function assignment(doc, name) {
  const values = []
  for (const script of doc.nodes(n => n.tag === 'script' && !n.attrs.src && executable(n) && n.raw.includes('window.' + name))) {
    for (const item of parse(script.raw, { ecmaVersion: 'latest' }).body) {
      if (item.type !== 'ExpressionStatement' || item.expression.type !== 'AssignmentExpression' || item.expression.operator !== '=') continue
      const { left, right } = item.expression
      if (left.type === 'MemberExpression' && !left.computed && left.object.type === 'Identifier'
        && left.object.name === 'window' && left.property.name === name && right.type === 'ObjectExpression') {
        uniqueJSONKeys(right)
        values.push(JSON.parse(script.raw.slice(right.start, right.end)))
      }
    }
  }
  return one(values, 'native ' + name + ' declaration')
}

function corporate(html, url) {
  const doc = document(html), title = one(doc.nodes(n => n.tag === 'title'), 'corporate publisher title').raw
  need(url === HOME ? /^EchoStar:/.test(title) : title === (url === CAREERS ? 'Careers at EchoStar' : 'DISH Network Technologies'),
    'current corporate publisher identity changed')
  const destination = url === HOME ? CAREERS : PROGRAM + '/jobs'
  const links = doc.nodes(n => n.tag === 'a').flatMap(n => {
    let href
    try { href = new URL(n.attrs.href, url) } catch { return [] }
    const label = doc.text(n)
    if (url === INDIA) {
      return href.origin === PROGRAM && href.pathname === '/jobs' && href.searchParams.get('location') === 'India'
        && href.searchParams.get('page') === '1' && /^(?:Search Jobs in India|Explore Opportunities in India)$/.test(label)
        && !href.username && !href.password && !href.hash ? [{ href: href.href, label }] : []
    }
    return href.href === destination && /career|opportunit|search jobs/i.test(label) ? [{ href: href.href, label }] : []
  })
  need(links.length > 0 && (url !== INDIA || new Set(links.map(link => link.href)).size === 1), 'current corporate career/India handoff declaration missing or ambiguous')
  return { title, links }
}

function search(html) {
  const doc = document(html)
  need(one(doc.nodes(n => n.tag === 'title'), 'native search title').raw === 'Jobs at EchoStar', 'native employer search title changed')
  need(one(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'native search canonical').attrs.href === CANONICAL + '/jobs',
    'native public program canonical changed')
  need(assignment(doc, '_jibe').cid === 'dish', 'native public program tenant changed')
  one(doc.nodes(n => n.tag === 'script' && n.attrs.src === SEARCH_CLIENT && n.attrs.type === 'module' && executable(n)), 'reviewed search renderer')
  const config = assignment(doc, 'searchConfig'), query = config.query
  need(query?.location === 'India' && query.page === '1' && query.internal === 'false'
    && Object.values(query).every(value => typeof value === 'string') && Object.keys(query).length <= 16,
  'current declared native India query changed')
  need(config.jobDescriptionAtsOverride === false && !config.useCustomJDUrl && !config.contextSettings?.currentContext,
    'native own-role navigation override is unreviewed')
  const api = new URL(PROGRAM + '/api/jobs')
  api.search = new URLSearchParams(query).toString()
  return { query, api: api.href, canonical: CANONICAL + '/jobs' }
}

const locations = job => [job, ...(job.additional_locations ?? [])]
function publicationDate(value) {
  // The current publisher emits UTC with a compact numeric offset. Validate the
  // calendar after the equivalent UTC notation change; retain its exact raw date.
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+0000$/.test(value),
    'unreviewed native publication format')
  return nativeDate(value.slice(0, -5) + 'Z', { required: true })
}
function country(location) {
  const name = nativeCountryName(location?.country), code = nativeCountryName(location?.country_code)
  need(name && (location?.country_code == null || name === code), 'native explicit work country name/code missing or conflicting')
  return name
}

function displayedLocations(job, formattedLocation) {
  const own = locations(job)
  const labels = location => {
    const name = country(location), parts = [location.city]
    need(typeof location.city === 'string' && location.city.trim(), 'native location city missing')
    const names = [name, location.country, location.country_code].filter(Boolean)
    const values = names.map(value => [...parts, value].join(', '))
    // US roles currently display a publisher-authored state instead of country.
    // This comparison uses the explicit typed country; no city/state infers it.
    if (location.state) {
      values.push([...parts, location.state].join(', '))
      values.push(...names.map(value => [...parts, location.state, value].join(', ')))
    }
    return values.map(norm)
  }
  const groups = own.map(labels)
  const full = value => {
    need(typeof value === 'string', 'native displayed full location missing')
    const pieces = value.split(';').map(norm)
    need(pieces.length === groups.length && pieces.every((piece, index) => groups[index].includes(piece)),
      'native displayed full location country or city contradicts typed locations')
  }
  full(job.full_location)
  for (const value of [job.short_location, formattedLocation].filter(value => value != null)) {
    need(value === 'Multiple' && own.length > 1 || groups[0].includes(norm(value)),
      'native displayed short/formatted location country or city contradicts typed locations')
  }
  for (const location of own) for (const field of ['location', 'location_name']) {
    const value = location[field]
    if (typeof value !== 'string' || !value.includes(',')) continue
    const suffix = value.split(',').at(-1).trim()
    // This publisher's US location_name labels include Phoenix, AZ; Chicago, IL;
    // and Nashville, TN. These are label aliases with an explicit US country and
    // state, not Azerbaijan/Israel/Tunisia country declarations. Its complete
    // full_location is independently reconciled above against those typed fields.
    if (field === 'location_name' && country(location) === 'United States' && nativeUSStateLabels.get(location.state) === suffix) continue
    // Check a declared written/ISO suffix against the already explicit country.
    // It never supplies missing country evidence; unreviewed label grammar fails
    // closed rather than treating a conflicting ISO label as an India worksite.
    if (suffix !== location.state && nativeCountryName(suffix)) {
      need(nativeCountryName(suffix) === country(location), 'native displayed location label country contradicts typed country')
    }
  }
}
function listing(payload) {
  need(payload && !payload.error && Array.isArray(payload.jobs) && payload.jobs.length > 0, 'current native inventory empty or unavailable; no verified zero')
  need(Number.isSafeInteger(payload.totalCount) && payload.totalCount > 0 && payload.totalCount === payload.count
    && payload.jobs.length === Math.min(10, payload.totalCount) && payload.filter?.displayLimit === 10,
  'native selected first-page inventory count changed')
  const seen = new Set()
  for (const row of payload.jobs) {
    const job = row?.data
    need(job?.hiring_organization === EMPLOYER, 'native listing employer changed')
    need(typeof job.slug === 'string' && /^\d+$/.test(job.slug) && job.req_id === job.slug
      && typeof job.title === 'string' && job.title && job.language === 'en-us' && job.internal === false
      && job.searchable === true && job.applyable === true, 'native listing identity or public availability changed')
    need(!seen.has(job.slug), 'duplicate native listing identity'); seen.add(job.slug)
    need(job.additional_locations == null || Array.isArray(job.additional_locations) && job.additional_locations.length <= 100,
      'native additional work countries unavailable')
    locations(job).forEach(country)
    displayedLocations(job)
  }
  return { rows: payload.jobs, total: payload.totalCount, snapshot: stable(payload.jobs) }
}

const roleURL = job => PROGRAM + '/jobs/' + job.slug + '?lang=' + job.language
const knownAddressValue = value => typeof value === 'string' && value !== '' && value !== 'UNAVAILABLE'
const locationSnapshot = job => locations(job).map(location => {
  need(typeof location.city === 'string' && location.city.trim(), 'native work city missing')
  return { country: country(location), city: location.city }
}).sort((a, b) => stable(a).localeCompare(stable(b)))
function detail(html, row, at) {
  const doc = document(html), listed = row.data
  one(doc.nodes(n => n.tag === 'descriptions-app'), 'own-role rendering component')
  one(doc.nodes(n => n.tag === 'script' && n.attrs.src === DESCRIPTION_CLIENT && executable(n)), 'reviewed description renderer')
  need(assignment(doc, '_jibe').cid === 'dish', 'native role tenant changed')
  const config = assignment(doc, 'jobDescriptionConfig'), job = config.job
  need(job && job.client_code === 'dish' && job.slug === listed.slug && job.req_id === listed.req_id
    && job.language === listed.language && job.title === listed.title, 'native listing/detail title or requisition identity changed')
  need(job.hiring_organization === EMPLOYER && listed.hiring_organization === job.hiring_organization, 'native detail employer changed')
  need(job.internal === false && job.searchable === true && job.applyable === true, 'native detail current public availability changed')
  need(job.city === listed.city && stable(locationSnapshot(job)) === stable(locationSnapshot(listed)) && locations(job).every(value => country(value) === 'India'),
    'native listing/detail work country or location changed')
  displayedLocations(job, config.jobFormatted?.location)
  for (const own of locations(job)) {
    const published = one(locations(listed).filter(value => value.city === own.city && country(value) === country(own)), 'native listed work location')
    for (const field of ['postal_code', 'state', 'street_address']) need(!knownAddressValue(own[field]) || !knownAddressValue(published[field])
      || own[field] === published[field], 'native listing/detail ' + field + ' changed')
  }
  const posting = one(doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')
    .map(n => json(n.raw)).filter(record => record['@type'] === 'JobPosting'), 'native own-role JobPosting')
  const canonical = CANONICAL + '/jobs/' + job.slug + '?lang=' + job.language
  need(posting.url === canonical && one(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'native role canonical').attrs.href === canonical
    && posting.title === job.title && config.jobFormatted?.title === job.title, 'native schema/title/URL identity changed')
  need(posting.hiringOrganization?.name === EMPLOYER && posting.hiringOrganization.sameAs === CANONICAL, 'native schema employer changed')
  const schemaLocations = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]
  need(schemaLocations.length === locations(job).length && schemaLocations.every(location => nativeCountryName(location?.address?.addressCountry) === 'India'
    && locations(listed).some(own => own.city === location.address.addressLocality
      && (!knownAddressValue(location.address.postalCode) || own.postal_code === location.address.postalCode)))
    && locations(job).every(own => schemaLocations.some(location => location.address.addressLocality === own.city)),
  'native schema work country/location changed')
  need(stable(config.sectionOrder) === stable(['description']) && !config.contextSettings?.currentContext
    && !config.contextSettings?.jobDescriptionConfig, 'native full criteria rendering override is unreviewed')
  const metadata = config.jdSettings?.options
  need(metadata?.metadata?.locations?.enabled === true && metadata.metadata.options?.enabled === false
    && metadata.displayFields?.fieldOrder?.includes('locations') && (config.addressFormat == null || config.addressFormat === 'short')
    && one(metadata.displayFields.fields.filter(field => field.item === 'locations'), 'native displayed location mapping').fieldType === 'location'
    && !metadata.displayFields.fields.find(field => field.item === 'locations').locationConfig,
  'native displayed location rendering mapping changed')
  need(typeof job.description === 'string' && job.description.length >= 200 && posting.description === job.description
    && config.jobFormatted.description === job.description, 'native schema/rendered full criteria disagree')
  for (const field of ['description', 'responsibilities', 'qualifications']) {
    need(typeof listed[field] === 'string' && typeof job[field] === 'string' && norm(listed[field]) === fullText(job[field])
      && job.description.includes(job[field]), 'native listing/detail complete ' + field + ' criteria differ')
  }
  const apply = new URL(job.apply_url)
  need(job.apply_url === listed.apply_url && apply.origin === 'https://india-external-dish.icims.com'
    && apply.pathname === '/jobs/' + job.slug + '/login' && !apply.search && !apply.hash && !apply.username && !apply.password,
  'native application identity changed')
  need(job.posted_date === listed.posted_date && posting.datePosted === job.posted_date, 'native original publication changed')
  publicationDate(job.posted_date)
  const expiry = nativeDate(posting.validThrough)
  need(!expiry.iso || Date.parse(expiry.iso) > Date.parse(at), 'native schema availability expired')
  return { title: job.title, company: EMPLOYER, source: 'dishnetworktechnologies', sourceConfiguredCompanyName: 'DISH Network Technologies',
    jobId: job.slug, requisitionId: job.req_id, sourceUrl: roleURL(job), nativeCanonicalUrl: canonical,
    applyUrl: job.apply_url, link: job.apply_url, country: 'India', countryCode: 'IN', city: job.city,
    location: job.full_location, additionalLocations: structuredClone(job.additional_locations ?? []),
    employmentType: job.employment_type ?? null, department: job.department || null,
    postingDate: job.posted_date, closingDate: null, sourceClosingDateIsExact: false,
    nativeSchemaValidThrough: posting.validThrough ?? null, sourceClosingDateBasis: 'exact-closing-unknown-native-platform-validThrough-retained-separately',
    jobDescription: job.description, sourceDescription: job.description,
    experienceRequired: null, sourceExperienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
    publicExperienceChecked: false, skipPublicExperienceEnrichment: true,
    nativeJobPosting: posting, nativeDetailRecord: job, nativeRenderedDescription: config.jobFormatted.description,
    nativeListingRecord: structuredClone(row), nativeHiringOrganization: posting.hiringOrganization,
    legalEmployer: null, nativeLegalEmployer: null, legalEmployerVerified: false,
    nativeCriteriaRepresentations: { plainTextAndFullHtmlEqual: true,
      listingPlainText: { description: listed.description, responsibilities: listed.responsibilities, qualifications: listed.qualifications },
      fullCurrentRoleHTML: { description: job.description, responsibilities: job.responsibilities, qualifications: job.qualifications },
      currentRendererURL: DESCRIPTION_CLIENT, currentRendererSHA256: DESCRIPTION_SHA },
    nativeLocationRenderingEvidence: { fullLocation: job.full_location, shortLocation: job.short_location,
      formattedLocation: config.jobFormatted.location, metadataSettings: config.jdSettings, addressFormat: config.addressFormat ?? null },
    sourceDetailComplete: true, sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    applicationVisited: false, applicationSubmitted: false, scrapedAt: at }
}

export async function runCurrentDishInventory({ fetchImpl = globalThis.fetch, signal, now = () => new Date().toISOString(), maxDetails = 10, onAudit } = {}) {
  signal?.throwIfAborted()
  need(Number.isSafeInteger(maxDetails) && maxDetails >= 1 && maxDetails <= 10, 'invalid native detail budget')
  const at = new Date(now()).toISOString()
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(180000)]) : AbortSignal.timeout(180000)
  const receipts = [], requestBudget = 14 + 2 * maxDetails
  const read = async (url, kind, closing = false) => {
    deadline.throwIfAborted(); need(receipts.length < requestBudget, 'native request budget exhausted')
    const requestSignal = AbortSignal.any([deadline, AbortSignal.timeout(20000)]), requestedAt = new Date().toISOString()
    const response = await withCallerSignal(() => fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: requestSignal,
      ...(closing ? { cache: 'no-store' } : {}), headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        Accept: kind === 'json' ? 'application/json' : kind === 'javascript' ? 'application/javascript,text/javascript' : 'text/html,application/xhtml+xml' } }), [requestSignal])
    need(response.status === 200, 'native public HTTP ' + response.status)
    need(response.url === url, 'native final response identity changed')
    need((kind === 'json' ? /^application\/json\b/i : kind === 'javascript' ? /^(?:application|text)\/javascript\b/i : /^text\/html\b/i)
      .test(response.headers.get('content-type') || ''), 'native response content type changed')
    const byteLimit = 2 * 1024 * 1024
    need(Number(response.headers.get('content-length') || 0) <= byteLimit && response.body?.getReader, 'native response body budget unavailable')
    const reader = response.body.getReader(), chunks = []
    let size = 0
    try {
      while (true) {
        const next = await withCallerSignal(() => reader.read(), [requestSignal])
        if (next.done) break
        size += next.value.byteLength; need(size <= byteLimit, 'native response body budget exceeded'); chunks.push(next.value)
      }
    } finally { void reader.cancel().catch(() => {}) }
    const body = Buffer.concat(chunks), html = new TextDecoder('utf-8', { fatal: true }).decode(body)
    receipts.push({ url, method: 'GET', phase: closing ? 'closing' : 'opening', status: 200, requestedAt,
      completedAt: new Date().toISOString(), bodyBytes: size, bodySHA256: hash(body), bodyComplete: true, rawBodyBase64: body.toString('base64') })
    return kind === 'json' ? json(html) : html
  }
  const authority = async closing => {
    const corporateChain = []
    for (const url of [HOME, CAREERS, INDIA]) corporateChain.push(corporate(await read(url, 'html', closing), url))
    const searchModel = search(await read(corporateChain[2].links[0].href, 'html', closing))
    need(hash(await read(SEARCH_CLIENT, 'javascript', closing)) === SEARCH_SHA, 'current native search renderer changed')
    need(hash(await read(DESCRIPTION_CLIENT, 'javascript', closing)) === DESCRIPTION_SHA, 'current native description renderer changed')
    return { corporateChain, searchModel }
  }
  const opening = await authority(false), opened = listing(await read(opening.searchModel.api, 'json'))
  const candidates = opened.rows.filter(row => locations(row.data).some(value => country(value) === 'India'))
  const selected = candidates.slice(0, maxDetails), jobs = []
  for (const row of selected) jobs.push(detail(await read(roleURL(row.data), 'html'), row, at))
  need(jobs.length > 0, 'no qualified current India roles on selected native page; zero unavailable')
  for (let index = 0; index < selected.length; index++) {
    const closing = detail(await read(roleURL(selected[index].data), 'html', true), selected[index], at)
    need(stable(closing) === stable(jobs[index]), 'closing native complete role criteria or identity changed')
  }
  const closing = listing(await read(opening.searchModel.api, 'json', true))
  need(closing.total === opened.total && closing.snapshot === opened.snapshot, 'closing selected native inventory changed')
  need(stable(await authority(true)) === stable(opening), 'closing current corporate India declaration changed')
  deadline.throwIfAborted()
  const audit = { source: 'dishnetworktechnologies', observedListingCount: opened.rows.length, nativeListingRecords: opened.rows,
    nativeReportedSearchCount: opened.total, observedIndiaListingCount: candidates.length, nonIndiaListingCount: opened.rows.length - candidates.length,
    candidateDetails: candidates.length, extractedDetailJobs: jobs.length, excludedDetailJobs: 0, failures: [], omittedDetails: candidates.length - selected.length,
    listingPaginationComplete: opened.rows.length === opened.total, closingInventoryMatches: true,
    selectedRoleCriteriaRechecked: true, currentPublisherHandoffRechecked: true, currentRenderersRechecked: true,
    authority: opening, receipts, requestBudget, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    companyGlobalTotal: null, companyIndiaTotal: null,
    limitations: ['Only the currently selected first native page is inspected; additional published pages remain outside this partial positive recovery.',
      'Full current role HTML, schema, renderer input, and full published listing plain text reconcile; exact legal employing entity and exact closing date remain unknown.'] }
  await withCallerSignal(() => onAudit?.(structuredClone(audit)), [deadline])
  jobs[0].nativeCollectionEvidence = audit
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: audit })
  attachSourceObservationEvidence(jobs, { source: 'dishnetworktechnologies', recordKind: 'vacancy-rows',
    observedRecordCount: opened.rows.length, observedVacancyCount: opened.rows.length, sourceScopeComplete: false,
    companyGlobalTotal: null, companyIndiaTotal: null })
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: opening.corporateChain[2].links[0].href, firstParty: true,
    listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: receipts.length, reportedTotal: null, indiaFacetCount: null,
    verifiedAt: new Date().toISOString(), reason: 'Current corporate-declared first native page and selected India full own-role criteria rechecked unchanged; pagination, whole-employer scope, exact closing and lifecycle cleanup remain unqualified.' })
}
