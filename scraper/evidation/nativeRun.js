import { createHash } from 'node:crypto'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const CAREERS = 'https://evidation.com/open-positions'
const BOARD = 'https://ats.rippling.com/evidation/jobs'
const WIDGET = 'https://static-assets.ripplingcdn.com/ats/embeds/job-board.v1.js'
const FRAME = 'https://ats.rippling.com/embed/evidation/jobs?s=' + encodeURIComponent(CAREERS)
const CLIENT = 'https://ats.us1.rippling.com/_next/static/chunks/7387-5690a0f62ce3232b.js'
const WIDGET_SHA = 'ccbb518a08c80678c93c6028fc38579edc3edf0da0b03fd34a5d6834186aa6a2'
// The current advertised client reads page/pageSize from the URL and uses the
// unfiltered native board query. Requalify that delegation when it changes.
const CLIENT_SHA = 'd520877b89186e74f70527e109523145b718d64fe71e7f882ac1c89bc32f5150'
const PROOF = Symbol.for('jobverify.official-ats-discovery')
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/
const longCountries = new Intl.DisplayNames(['en'], { type: 'region' })
const shortCountries = new Intl.DisplayNames(['en'], { type: 'region', style: 'short' })
const plain = value => typeof value === 'string' && Boolean(value.trim()) && value.length <= 1000 && !/[<>\u0000-\u001f]/.test(value)
const hash = value => createHash('sha256').update(value).digest('hex')
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const same = (a, b) => canonical(a) === canonical(b)
const need = (condition, message) => {
  if (!condition) throw Object.assign(new Error('Evidation native: ' + message), {
    code: 'EVIDATION_NATIVE_CONTRACT', softFailure: true, abortRetries: true, failureKind: 'coverage_gap',
  })
}
const envelope = value => {
  need(value && typeof value === 'object' && !Array.isArray(value), 'native object missing')
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:error|errors|exception|fault)$/i.test(key)) need(item == null || item === '' || Array.isArray(item) && !item.length, 'native error envelope')
    if (/^(?:success|ok)$/i.test(key)) need(item === true, 'native failed response')
  }
}
const document = body => {
  const d = readVisibleNativeDocument(body, { strict: true })
  need(!d.nodes(node => node.tag === 'base').length, 'unqualified page base URL')
  return d
}
function corporate(body) {
  const d = document(body), widgets = d.nodes(node => node.attrs.id === 'rr-job-board')
  need(widgets.length === 1 && widgets[0].attrs['data-job-board-id'] === 'evidation'
    && !widgets[0].attrs['data-locale'] && d.nodes(node => node.tag === 'script' && node.attrs.src === WIDGET).length === 1,
  'current visible corporate widget/tenant handoff missing or ambiguous')
  need(!d.nodes(node => node.tag === 'script' && !node.attrs.src).some(node => /RR_BASE_URL/.test(node.raw || '')),
    'unqualified corporate widget origin override')
  return { officialURL: CAREERS, tenant: 'evidation', widgetURL: WIDGET, nativeBoardURL: FRAME }
}
function board(value) {
  envelope(value)
  need(value.boardType === 'RIPPLING' && value.slug === 'evidation' && value.companyName === 'Evidation'
    && value.title === 'Current Openings at Evidation' && value.boardURL === BOARD && value.isTest === false
    && value.groupJobsByLocation === false, 'native board/employer/test identity mismatch')
}
function next(body, route, query) {
  const d = document(body), scripts = d.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')
  need(scripts.length === 1 && scripts[0].attrs.type === 'application/json' && !scripts[0].attrs.src, 'native Next JSON missing/ambiguous')
  const n = JSON.parse(scripts[0].raw)
  envelope(n); envelope(n.props); envelope(n.props.pageProps)
  need(n.page === route && n.locale === 'en-US' && n.isFallback === false && same(n.query, query), 'native route/query identity mismatch')
  const p = n.props.pageProps, a = p.apiData
  envelope(a); board(a.jobBoard)
  return { d, p, a }
}
function geography(location) {
  need(location && plain(location.name) && plain(location.country) && /^[A-Z]{2}$/.test(location.countryCode || '')
    && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(location.countryCode)
    && longCountries.of(location.countryCode) !== location.countryCode
    && [longCountries.of(location.countryCode), shortCountries.of(location.countryCode)].some(name => name === location.country)
    && ((location.countryCode === 'IN') === (location.country === 'India')),
  'native country/geography missing or contradictory')
  for (const key of ['city', 'state', 'stateCode']) need(location[key] == null || plain(location[key]), 'native geography field malformed')
  need(['ON_SITE', 'HYBRID', 'REMOTE'].includes(location.workplaceType), 'native workplace scope missing')
  need(location.countryCode === 'IN' || !/\bIndia\b/i.test([location.name, location.city, location.state].join(' ')), 'native geography contradicts country')
}
function publicStatus(value) {
  for (const key of ['closed', 'isClosed', 'archived', 'isArchived', 'isInternal', 'isDeleted', 'unlistedFromSearch']) {
    need(value[key] == null || value[key] === false, 'native public job status is closed/internal/unlisted')
  }
  for (const key of ['isPublic', 'isActive', 'isPublished']) need(value[key] == null || value[key] === true, 'native public job status is inactive')
}
function countryHints(value, locations) {
  for (const key of ['country', 'countryCode', 'country_code']) {
    need(value[key] == null || locations.every(location => value[key] === location[key === 'country' ? 'country' : 'countryCode']),
      'native explicit country/geography conflicts with listed locations')
  }
}
function deadline(values, now) {
  const dates = values.flatMap(value => ['validThrough', 'closingDate', 'deadline', 'deadline_at'].map(key => value[key]))
    .filter(value => value != null && value !== '').map(raw => {
      need(typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(raw), 'native closing deadline format changed')
      const [year, month, day] = raw.slice(0, 10).split('-').map(Number), time = Date.parse(raw)
      need(month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
        && Number.isFinite(time) && time > Date.parse(now), 'native closing deadline is expired or invalid')
      return { raw, iso: new Date(time).toISOString() }
    })
  need(new Set(dates.map(date => date.iso)).size <= 1, 'native closing deadline contradiction')
  return dates[0] ?? null
}
function listing(body, page, pageSize) {
  const query = { s: CAREERS, ...(pageSize !== 20 ? { pageSize: String(pageSize) } : {}), ...(page ? { page: String(page) } : {}), jobBoardSlug: 'evidation' }
  const { d, p, a } = next(body, '/embed/[jobBoardSlug]/jobs', query)
  need(a.jobBoardSlug === 'evidation' && same(a.filtersConfig, { workLocations: [], departments: [] }), 'native board filter identity changed')
  need(Array.isArray(p.dehydratedState?.queries), 'native listing queries missing')
  const queries = p.dehydratedState.queries.filter(q => q.queryKey?.[2] === 'job-posts')
  need(queries.length === 1, 'native listing query missing/ambiguous')
  const q = queries[0]
  need(same(q.queryKey, ['board', 'evidation', 'job-posts', false,
    { searchQuery: '', departments: [], workplaceType: null, country: '', state: '', city: '', page, pageSize }])
    && q.state?.status === 'success' && q.state.error === null && q.state.fetchFailureCount === 0, 'native listing query filtered or failed')
  const value = q.state.data; envelope(value)
  need(Number.isSafeInteger(value.totalItems) && value.totalItems >= 0 && value.page === page && value.pageSize === pageSize
    && value.totalPages === Math.ceil(value.totalItems / pageSize) && Array.isArray(value.items)
    && value.items.length === Math.max(0, Math.min(pageSize, value.totalItems - page * pageSize)), 'native page counts or terminal inventory inconsistent')
  for (const row of value.items) {
    envelope(row)
    need(uuid.test(row.id || '') && plain(row.name) && row.url === BOARD + '/' + row.id && row.language === 'en-US'
      && plain(row.department?.name) && Array.isArray(row.locations) && row.locations.length, 'native listing role identity missing/mismatched')
    row.locations.forEach(geography)
    publicStatus(row); countryHints(row, row.locations)
    const href = 'https://ats.rippling.com/en-US/evidation/jobs/' + row.id
    need(d.nodes(node => node.tag === 'a' && node.attrs.href === href).some(node => d.text(node) === row.name), 'native rendered/listing title identity mismatch')
  }
  const expected = [...new Set(value.items.map(row => 'https://ats.rippling.com/en-US/evidation/jobs/' + row.id))].sort()
  const links = [...new Set(d.nodes(node => node.tag === 'a' && node.attrs.href?.startsWith('https://ats.rippling.com/en-US/evidation/jobs/'))
    .map(node => node.attrs.href))].sort()
  need(same(expected, links), 'native rendered/listing role inventory mismatch')
  return { d, value }
}
function merge(rows) {
  const groups = new Map(), seen = new Set()
  for (const row of rows) {
    const key = canonical([row.id, row.locations])
    need(!seen.has(key), 'native duplicate location row'); seen.add(key)
    const prior = groups.get(row.id)
    if (prior) {
      need(prior.name === row.name && prior.url === row.url && same(prior.department, row.department), 'native duplicate role identity contradiction')
      for (const location of row.locations) need(!prior.locations.some(old => same(old, location)), 'native duplicate job location')
      prior.locations.push(...row.locations)
      prior.nativeRows.push(row)
    } else groups.set(row.id, { ...row, locations: [...row.locations], nativeRows: [row] })
  }
  return [...groups.values()]
}
function detail(body, row, now) {
  const { d, a } = next(body, '/[jobBoardSlug]/jobs/[jobId]', { jobBoardSlug: 'evidation', jobId: row.id })
  const job = a.jobPost; envelope(job); board(job.board)
  need(job.uuid === row.id && job.name === row.name && job.url === row.url && job.companyName === 'Evidation'
    && job.unlistedFromSearch === false, 'native public job title/employer/status identity mismatch')
  publicStatus(job); countryHints(job, row.locations)
  const names = row.locations.map(location => location.name)
  need(same(job.workLocations, names) && same(a.workLocations, names), 'native listing/detail geography mismatch')
  need(job.department?.base_department === row.department.name && same(a.department, job.department), 'native detail department identity mismatch')
  const company = extractActiveDescription(job.description?.company), role = extractActiveDescription(job.description?.role)
  need(company && role && role.length >= 100 && role !== company, 'native full employer description/content missing')
  need(!/\b(?:this (?:job|position|role) is (?:no longer available|closed)|no longer accepting applications|position has been filled)\b/i.test(role), 'native job description is closed')
  const previews = d.nodes(node => (node.attrs.class || '').split(/\s+/).includes('ATS_htmlPreview'))
  need(previews.length === 1 && d.text(previews[0]) === company + ' ' + role, 'native rendered/full description content mismatch')
  const titles = d.nodes(node => node.tag === 'title'), og = d.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:title')
  const canonicals = d.nodes(node => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('canonical'))
  need(titles.length === 1 && titles[0].raw === job.name && og.length === 1 && og[0].attrs.content === job.name + ' | Current Openings at Evidation'
    && canonicals.length === 1 && canonicals[0].attrs.href === row.url, 'native rendered title/canonical identity mismatch')
  const buttons = d.nodes(node => node.tag === 'button' && node.attrs['data-testid'] === 'Apply now')
  need(buttons.length && buttons.every(node => d.text(node) === 'Apply now' && node.attrs['data-disabled'] === 'false'
    && !Object.hasOwn(node.attrs, 'disabled') && node.attrs['aria-disabled'] !== 'true'), 'native public application control unavailable')
  const fields = job.activeJobApplication?.basicQuestions
  need(Array.isArray(fields) && new Set(fields.map(field => field.oid)).size === fields.length
    && ['first_name', 'last_name', 'email', 'resume'].every(id => fields.some(field => field.oid === id && field.required === true)), 'native active application configuration missing')
  need(plain(job.createdOn) && Number.isFinite(Date.parse(job.createdOn)) && Date.parse(job.createdOn) <= Date.parse(now), 'native creation metadata malformed/future')
  // createdOn is creation metadata. The current source supplies no publication
  // date; preserve that absence instead of replacing it with the check time.
  need(job.jsonLd == null && ['datePosted', 'postedAt', 'publishedAt', 'publishedOn', 'postingDate', 'publicationDate'].every(key => job[key] == null),
    'native publication contract changed and needs qualification')
  const payRanges = job.payRangeDetails
  need(Array.isArray(payRanges) && payRanges.length <= 32 && same(payRanges, a.payRangeDetails), 'native page/job compensation records conflict')
  const amounts = payRanges.map(range => {
    need(plain(range.location) && /^[A-Z]{3}$/.test(range.currency || '') && range.frequency === 'YEAR' && range.isRemote === false
      && Number.isFinite(range.rangeStart) && range.rangeStart >= 0 && Number.isFinite(range.rangeEnd) && range.rangeEnd >= range.rangeStart,
    'native compensation contract changed or malformed')
    return range.rangeStart.toLocaleString('en-US') + ' - ' + range.rangeEnd.toLocaleString('en-US') + ' ' + range.currency + ' per year (' + range.location + ')'
  })
  const salaryNodes = d.nodes(node => node.tag === 'div' && (node.attrs.class || '').split(/\s+/).includes('css-enzntz'))
  need(payRanges.length ? salaryNodes.length === 1 && d.text(salaryNodes[0]) === 'The pay range for this role is: ' + amounts.join(' ')
    : salaryNodes.length === 0, 'native rendered compensation/pay range differs from native amounts')
  const salaryText = salaryNodes.length ? d.text(salaryNodes[0]) : null
  need(job.board.legalNotice === a.jobBoard.legalNotice && typeof a.jobBoard.legalNotice === 'string', 'native employer notice identity conflict')
  // Board-level notice metadata differs from individual rendered role notices
  // in the current source. Preserve it separately; the full rendered role HTML
  // above remains the source of the job description.
  return { id: job.uuid, name: job.name, url: job.url, locations: row.locations, description: job.description,
    department: job.department, employmentType: job.employmentType, createdOn: job.createdOn,
    activeJobApplication: job.activeJobApplication, closing: deadline([job, ...row.nativeRows], now),
    nativeRows: row.nativeRows, payRanges, salaryText, boardLegalNoticeHtml: a.jobBoard.legalNotice, company, role }
}

export async function runNativeEvidation({ signal: callerSignal, now = () => new Date().toISOString(), pageSize = 20, maxPages = 100, maxJobs = 0 } = {}) {
  need(Number.isSafeInteger(pageSize) && pageSize >= 1 && pageSize <= 1000 && Number.isSafeInteger(maxPages) && maxPages >= 1 && maxPages <= 100
    && Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid page/output bounds')
  const checkedAt = typeof now === 'function' ? now() : now
  need(typeof checkedAt === 'string' && Number.isFinite(Date.parse(checkedAt)), 'invalid check time')
  const signal = AbortSignal.any([...(callerSignal ? [callerSignal] : []), AbortSignal.timeout(180000)])
  let requests = 0, totalBytes = 0
  const get = async url => {
    signal.throwIfAborted(); need(++requests <= 1200, 'native request bound exceeded')
    const response = await fetch(url, { method: 'GET', redirect: 'error', credentials: 'omit', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
      headers: { Accept: url.endsWith('.js') ? 'application/javascript,text/javascript' : 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)' } })
    need(response.status === 200, 'HTTP unavailable: ' + response.status)
    need(response.url === url, 'HTTP redirect identity changed')
    need((url.endsWith('.js') ? /^(?:application|text)\/(?:javascript|x-javascript)/i : /^text\/html\b|^application\/xhtml\+xml\b/i)
      .test(response.headers.get('content-type') || ''), 'native response content type changed')
    const chunks = [], reader = response.body?.getReader(); let bytes = 0
    need(reader, 'native response body missing')
    try {
      for (;;) {
        signal.throwIfAborted()
        const { done, value } = await reader.read(); if (done) break
        bytes += value.byteLength; totalBytes += value.byteLength
        need(bytes <= 3 * 1024 * 1024 && totalBytes <= 32 * 1024 * 1024, 'native body byte bound exceeded')
        chunks.push(value)
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error }
    finally { reader.releaseLock() }
    signal.throwIfAborted(); need(bytes > 0, 'native response body empty')
    return Buffer.concat(chunks).toString('utf8')
  }
  const frameURL = page => FRAME + (pageSize !== 20 ? '&pageSize=' + pageSize : '') + (page ? '&page=' + page : '')
  async function snapshot() {
    const binding = corporate(await get(CAREERS))
    need(hash(await get(WIDGET)) === WIDGET_SHA, 'current widget delegation contract changed')
    const first = listing(await get(frameURL(0)), 0, pageSize)
    need(first.d.nodes(node => node.tag === 'script' && node.attrs.src === CLIENT).length === 1, 'current advertised pagination client missing')
    need(hash(await get(CLIENT)) === CLIENT_SHA, 'current pagination client contract changed')
    const total = first.value.totalItems, totalPages = first.value.totalPages
    need(total <= 10000 && totalPages <= maxPages, 'page limit leaves incomplete native inventory')
    const rows = [...first.value.items]
    for (let page = 1; page < totalPages; page++) {
      const current = listing(await get(frameURL(page)), page, pageSize).value
      need(current.totalItems === total && current.totalPages === totalPages, 'native inventory total changed during pagination')
      rows.push(...current.items)
    }
    const terminal = listing(await get(frameURL(Math.max(1, totalPages))), Math.max(1, totalPages), pageSize).value
    need(terminal.totalItems === total && terminal.totalPages === totalPages && terminal.items.length === 0 && rows.length === total,
      'native terminal inventory totals changed')
    const groups = merge(rows), facts = []
    for (const row of groups) facts.push(detail(await get('https://ats.rippling.com/en-US/evidation/jobs/' + row.id), row, checkedAt))
    return { binding, rows, facts, pages: Math.max(1, totalPages) + 1 }
  }
  const initial = await snapshot(), closing = await snapshot()
  need(same(initial, closing), 'native corporate/listing/full detail content changed during closing reconciliation')
  const india = initial.facts.filter(fact => fact.locations.some(location => location.countryCode === 'IN'))
  const jobs = (maxJobs ? india.slice(0, maxJobs) : india).map(fact => {
    const locations = fact.locations.filter(location => location.countryCode === 'IN'), labels = locations.map(location => location.name)
    const content = [fact.company, fact.role, fact.salaryText].filter(Boolean)
    const fullDescription = content.join('\n\n')
    return { source: 'evidation', company: 'Evidation', jobId: fact.id, requisitionId: fact.id, title: fact.name,
      companyCareerPage: CAREERS, companyDomain: 'evidation.com', country: 'India', city: locations.length === 1 ? locations[0].city : null,
      state: locations.length === 1 ? locations[0].state : null, location: labels.join(' / '), locations: labels,
      sourceUrl: fact.url, applyUrl: fact.url, link: fact.url, sourceDescription: fullDescription,
      jobDescription: fullDescription, nativeDescriptionHtml: fact.description,
      nativePayRangeDetails: fact.payRanges, nativeVisiblePayRangeText: fact.salaryText, nativeBoardLegalNoticeHtml: fact.boardLegalNoticeHtml,
      nativeListingRecords: fact.nativeRows,
      nativeCreatedOn: fact.createdOn, nativePublicationDate: null, postingDate: null,
      nativeClosingDate: fact.closing?.raw ?? null, closingDate: fact.closing?.iso ?? null,
      nativeEmployerBrand: 'Evidation', nativeLegalEmployer: null, nativeLocations: fact.locations,
      nativeEmploymentType: fact.employmentType, employmentType: fact.employmentType?.id ?? null, department: fact.department.name,
      sourceOfficialBinding: initial.binding, sourceDetailComplete: true, sourcePostingStatusEvidence: 'current-listed-public-nontest-role+enabled-control+native-application-config',
      applicationSubmitted: false, applicationVisited: false, sourceListingComplete: false, sourceScopeComplete: false,
      lifecycleCleanupAllowed: false, scrapedAt: checkedAt }
  })
  signal.throwIfAborted()
  Object.defineProperty(jobs, PROOF, { value: { source: 'evidation', binding: initial.binding,
    nativeInventory: { observedNativeRows: initial.rows.length, observedUniqueRoles: initial.facts.length, observedIndiaRoles: india.length,
      snapshots: 2, pagesPerSnapshot: initial.pages, allDetailsValidated: true } } })
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: FRAME, firstParty: true, listingComplete: false,
    pagesFetched: initial.pages + closing.pages, reportedTotal: null, indiaFacetCount: null, verifiedAt: checkedAt,
    reason: `current-corporate-widget-native-pagination-all-details-and-closing-snapshot-reconciled;observedNativeRows=${initial.rows.length};observedUniqueRoles=${initial.facts.length};observedIndiaRoles=${india.length};whole-company-scope-unverified` })
}
