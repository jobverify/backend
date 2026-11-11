import { createHash } from 'node:crypto'
import { readNativeDocument, activeIframeSources, extractActiveDescription } from './activeNativeHtml.js'
import { normalizeNativeAttributeBoundaries } from './nativeHtmlAttributes.js'
import { nativeCountryName, nativeLocationCountryName } from '../shared/nativeJobPosting.js'

// Reviewed from the current public careers application: the app chunk builds
// the list/detail GETs and View URL; careers renders the native full criteria.
// No tenant, company ID, role ID or source date is frozen in this profile.
const rendererProfiles = Object.freeze({
  app: 'f841c4112bc24caeb45737ae58aa543ddba6eae57caae48af60d0371832e5213',
  careers: '94adf09cc9598b297db5e2b3621e247215cdc0d8b613e5830df032cd68ac17b6',
})
const requireValue = (value, message) => { if (!value) throw new Error('Pyjama ' + message) }
const sha = value => createHash('sha256').update(value).digest('hex')
const text = value => typeof value === 'string' ? value.trim() : ''
const key = value => text(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const visibleText = value => text(value).normalize('NFKC').replace(/\s+/g, ' ')
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]])) : item)
const https = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && !/^localhost$|\.localhost$|\.local$|^\[|^\d+(?:\.\d+){3}$/i.test(url.hostname) ? url : null
  } catch { return null }
}
const documentOf = html => readNativeDocument(normalizeNativeAttributeBoundaries(html))
const singleQuery = (url, keys) => url.searchParams.size === keys.length
  && keys.every(name => url.searchParams.getAll(name).length === 1)
const boardIdentity = value => {
  const url = https(value)
  if (!url || url.origin !== 'https://app.pyjamahr.com' || url.pathname !== '/careers' || url.hash
    || !singleQuery(url, ['company', 'company_uuid', 'isHeaderVisible', 'is_careers_page'])
    || !text(url.searchParams.get('company')) || !/^[a-f\d]{10}$/i.test(url.searchParams.get('company_uuid') || '')
    || url.searchParams.get('isHeaderVisible') !== 'true' || url.searchParams.get('is_careers_page') !== 'true') return null
  return { boardURL: url.href, companyUUID: url.searchParams.get('company_uuid'), companyLabel: url.searchParams.get('company') }
}

export const declaredPyjamaRecruitment = (page, config = {}) => {
  const publisher = https(page?.url)
  if (page?.status !== 200 || !publisher || typeof page.html !== 'string' || !text(config.source)) return null
  const registrations = [config.companyCareerPage, config.officialHomepageUrl,
    config.companyDomain ? 'https://' + config.companyDomain + '/' : null].map(https)
    .filter(url => url && !/(?:^|\.)pyjamahr\.com$/i.test(url.hostname))
  if (!registrations.some(url => publisher.hostname === url.hostname || publisher.hostname.endsWith('.' + url.hostname.replace(/^www\./, '')))) return null
  const document = documentOf(page.html)
  if (document.nodes(node => node.tag === 'base').length) return null
  const expectedCompanyNames = [...new Set([config.companyName, ...(config.nativeEmployerNames || []), ...(config.publisherNames || [])].filter(text))]
  const publisherNames = document.nodes(node => ['title', 'h1'].includes(node.tag)).map(node => node.tag === 'title' ? node.raw || '' : document.text(node))
  if (!publisherNames.some(name => expectedCompanyNames.some(expected => key(expected).length >= 2 && key(name).includes(key(expected))))) return null
  const declarations = new Map()
  for (const raw of [...activeIframeSources(page.html), ...document.nodes(node => node.tag === 'a' && node.attrs.href).map(node => node.attrs.href)]) {
    let url
    try { url = new URL(raw, publisher) } catch { continue }
    const identity = boardIdentity(url.href)
    if (identity && expectedCompanyNames.some(name => key(name) === key(identity.companyLabel))) declarations.set(identity.boardURL, identity)
  }
  if (declarations.size !== 1) return null
  return { source: config.source, publisherURL: publisher.href, expectedCompanyNames, ...declarations.values().next().value }
}

const modelOf = (page, expectedURL) => {
  requireValue(page?.status === 200 && page.url === expectedURL && typeof page.html === 'string', 'public response identity changed')
  const document = documentOf(page.html)
  requireValue(!document.nodes(node => node.tag === 'base').length, 'unreviewed native document base')
  const carriers = document.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__'
    && node.attrs.type === 'application/json' && !node.attrs.src)
  requireValue(carriers.length === 1, 'native SSR identity is missing or ambiguous')
  let model
  try { model = JSON.parse(carriers[0].raw) } catch { throw new Error('Pyjama native SSR identity is invalid') }
  requireValue(model.page === '/careers' && model.props?.pageProps && typeof model.props.pageProps === 'object', 'native SSR route identity changed')
  return { document, model, props: model.props.pageProps }
}
const rendererDeclarations = document => {
  const result = {}
  for (const node of document.nodes(node => node.tag === 'script' && node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
    && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || ''))) {
    let url
    try { url = https(new URL(node.attrs.src, 'https://app.pyjamahr.com').href) } catch { continue }
    const match = url?.pathname.match(/^\/_next\/static\/chunks\/pages\/(_app|careers)-[a-f\d]+\.js$/i)
    if (!match || url.origin !== 'https://app.pyjamahr.com' || url.search || url.hash) continue
    const kind = match[1] === '_app' ? 'app' : 'careers'
    requireValue(!result[kind], 'native renderer declaration is ambiguous')
    result[kind] = url.href
  }
  requireValue(result.app && result.careers, 'native active renderer declarations are unavailable')
  return result
}
const companyOf = (parsed, descriptor, matchingEmployer) => {
  const company = parsed.props.companyDetails, url = https(company?.url)
  requireValue(company && Number.isSafeInteger(company.id) && company.id > 0 && company.uuid === descriptor.companyUUID
    && key(company.name) === key(descriptor.companyLabel) && matchingEmployer(company.name)
    && url && !url.search && !url.hash && text(company.slug), 'native company/employer identity changed')
  requireValue(parsed.model.query?.company_uuid === descriptor.companyUUID
    && key(parsed.model.query?.company) === key(company.name), 'native SSR company identity changed')
  return { company, domain: url.hostname.replace(/^www\./, '').toLowerCase() }
}
const listURL = descriptor => 'https://api.pyjamahr.com/api/career/jobs/?company_uuid=' + encodeURIComponent(descriptor.companyUUID)
  + '&page=1&is_careers_page=true'
const detailURL = (descriptor, row) => 'https://api.pyjamahr.com/api/career/jobs/' + row.id
  + '/?company_uuid=' + encodeURIComponent(descriptor.companyUUID) + '&is_careers_page=false'
const roleURL = (descriptor, row) => 'https://app.pyjamahr.com/careers?company=' + encodeURIComponent(descriptor.companyLabel)
  + '&job_id=' + row.id + '&company_uuid=' + encodeURIComponent(descriptor.companyUUID)
  + '&utm_source=DIRECT&source=DIRECT&isHeaderVisible=true'
const paginationURL = (value, descriptor, expectedPage, firstPagePrevious = false) => {
  const url = https(value)
  const omittedFirstPage = firstPagePrevious && expectedPage === 1 && url && !url.searchParams.has('page')
  requireValue(url && url.origin === 'https://api.pyjamahr.com' && url.pathname === '/api/career/jobs/' && !url.hash
    && singleQuery(url, ['company_uuid', 'is_careers_page', ...(omittedFirstPage ? [] : ['page'])])
    && url.searchParams.get('company_uuid') === descriptor.companyUUID
    && url.searchParams.get('is_careers_page') === 'true' && (omittedFirstPage || url.searchParams.get('page') === String(expectedPage)),
  'unsafe or cyclic native pagination next page')
  return url.href
}
const listingPage = payload => {
  requireValue(payload && Number.isSafeInteger(payload.count) && payload.count >= 0 && payload.count <= 2400
    && Array.isArray(payload.results) && payload.results.length <= 100 && (payload.next === null || typeof payload.next === 'string')
    && (payload.previous === null || typeof payload.previous === 'string'), 'native listing model changed')
  for (const row of payload.results) requireValue(row && Number.isSafeInteger(row.id) && row.id > 0 && text(row.title)
    && text(row.slug) && typeof row.published_internally === 'boolean' && typeof row.country === 'string'
    && typeof row.location === 'string' && Array.isArray(row.other_locations)
    && row.other_locations.every(value => typeof value === 'string'), 'native listing identity changed')
  return stable(payload)
}
const screeningQuestions = detail => {
  const questions = detail.job_screening_questions, seen = new Set()
  const fields = ['uuid', 'name', 'label', 'question', 'choices', 'mandatory', 'maximum_range', 'minimum_range', 'open_range']
  const labels = new Map([['multi_choice', 'Multiple choice'], ['single_text', 'Single Line text']])
  requireValue(Array.isArray(questions) && questions.length <= 100, 'native screening questions envelope requires review')
  for (const question of questions) {
    requireValue(question && !Array.isArray(question) && Object.keys(question).length === fields.length
      && fields.every(field => Object.hasOwn(question, field))
      && typeof question.uuid === 'string' && /^[a-f\d]{10}$/i.test(question.uuid) && !seen.has(question.uuid)
      && labels.has(question.name) && labels.get(question.name) === question.label
      && text(question.question) && question.question.length <= 10000 && typeof question.mandatory === 'boolean'
      && Array.isArray(question.choices) && question.choices.length <= 100 && question.choices.every(value => text(value))
      && (question.name === 'single_text' ? question.choices.length === 0 : question.choices.length >= 2)
      && question.maximum_range === null && question.minimum_range === null && question.open_range === null,
    'native screening question criteria/model requires review')
    seen.add(question.uuid)
  }
  return questions
}
const nativeDateInstant = value => {
  // The reviewed public model publishes six fractional digits and an explicit
  // numeric UTC offset. Validate the local calendar before applying the offset;
  // Date.parse otherwise silently rolls a nonexistent February day forward.
  const match = typeof value === 'string'
    && /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.(\d{6})[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00)$/.exec(value)
  requireValue(match, 'native date fraction/time/offset requires review')
  const calendar = new Date(match[1] + 'T00:00:00.000Z'), instant = Date.parse(value)
  requireValue(Number.isFinite(+calendar) && calendar.toISOString().slice(0, 10) === match[1]
    && Number.isFinite(instant), 'native date calendar is invalid')
  // Preserve the last three native fractional digits for ordering. The raw
  // source timestamp remains unchanged on the returned record and closing date.
  return BigInt(instant) * 1000n + BigInt(match[2].slice(3))
}
const detailModel = (detail, row, domain) => {
  requireValue(detail && detail.id === row.id && text(detail.uuid) && detail.title === row.title
    && detail.location === row.location && stable(detail.other_locations) === stable(row.other_locations), 'listing/detail role identity changed')
  requireValue(text(detail.email_domain).toLowerCase().replace(/^www\./, '') === domain, 'native detail employer domain changed')
  requireValue(nativeCountryName(row.country) === 'India' && nativeCountryName(detail.country) === 'India', 'native listing/detail country changed')
  for (const location of [row, detail]) {
    const writtenCountry = nativeLocationCountryName(location.location)
    requireValue(!writtenCountry || writtenCountry === nativeCountryName(location.country), 'native explicit primary location country conflicts with typed country')
  }
  requireValue(row.published_internally === false && detail.published_internally === false, 'native role is internal rather than public')
  requireValue(extractActiveDescription(detail.description)?.length >= 100, 'native full description is unavailable')
  requireValue(detail.min_experience === row.min_experience && detail.max_experience === row.max_experience
    && detail.department_name === row.department_name && detail.workplace_type === row.workplace_type, 'native listing/detail criteria changed')
  for (const name of ['skill', 'education', 'seniority']) requireValue(Array.isArray(detail[name]) && detail[name].every(value => typeof value === 'string'),
    'native structured criteria requires review')
  screeningQuestions(detail)
  requireValue(nativeDateInstant(detail.valid_through) >= nativeDateInstant(detail.created_at), 'native date range is invalid')
  for (const name of Object.keys(detail)) requireValue(!/^(?:datePosted|datePublished|dateModified|published_at|published_on|posted_at|validThrough|expiresAt|expirationDate|closingDate)$/i.test(name),
    'new native publication/expiry field requires review')
  return stable(detail)
}
const publicRole = (page, expectedURL, row, detail, descriptor, account, renderers, matchingEmployer) => {
  const parsed = modelOf(page, expectedURL), current = companyOf(parsed, descriptor, matchingEmployer)
  requireValue(stable(current.company) === stable(account.company), 'native SSR employer company context changed')
  requireValue(parsed.model.query.job_id === String(row.id) && parsed.props.job?.id === row.id
    && stable(parsed.props.job) === stable(detail), 'public SSR/detail content identity changed')
  requireValue(stable(rendererDeclarations(parsed.document)) === stable(renderers), 'public role active renderer changed')
  const titles = parsed.document.nodes(node => (node.attrs.class || '').split(/\s+/).includes('c-title')).map(node => parsed.document.text(node))
  requireValue(titles.some(title => visibleText(title) === visibleText(row.title)), 'public visible role title changed')
  const applies = parsed.document.nodes(node => node.tag === 'a' && parsed.document.text(node) === 'Apply'
    && !Object.hasOwn(node.attrs, 'disabled') && node.attrs['aria-disabled'] !== 'true')
  let apply
  try { if (applies.length === 1) apply = new URL(applies[0].attrs.href, expectedURL).href } catch {}
  requireValue(apply === expectedURL + '&apply_now=true', 'public application account identity changed')
  requireValue(!parsed.document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')
    .some(node => /JobPosting/.test(node.raw || '')), 'new native public JobPosting date/location contract requires review')
  return { job: parsed.props.job, applicationURL: apply }
}
const escapeHTML = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const completeDescription = detail => {
  const fields = [['Workplace Type', detail.workplace_type], ['Employment Type', detail.job_type], ['Industry Type', detail.industry],
    ['Experience Level', detail.seniority.join(', ')], ['Education', detail.education.join(', ')], ['Skills', detail.skill.join(', ')]]
  if (Number.isFinite(detail.min_experience) && Number.isFinite(detail.max_experience)) fields.push(['Work Experience (years)', detail.min_experience + ' - ' + detail.max_experience])
  if (detail.is_salary_visible === true && detail.min_salary != null && detail.max_salary != null) fields.push(['Compensation',
    [detail.currency, detail.min_salary + ' - ' + detail.max_salary, detail.salary_type].filter(value => value != null).join(' ')])
  const questions = screeningQuestions(detail)
  const screening = questions.length ? '\n<section><h2>Application screening questions</h2><ol>' + questions.map(question =>
    '<li><p>' + escapeHTML(question.question) + '</p><dl><dt>Question type</dt><dd>' + escapeHTML(question.label)
    + '</dd><dt>Mandatory</dt><dd>' + question.mandatory + '</dd></dl>'
    + (question.choices.length ? '<ul>' + question.choices.map(choice => '<li>' + escapeHTML(choice) + '</li>').join('') + '</ul>' : '')
    + '</li>').join('') + '</ol></section>' : ''
  return detail.description + '\n<dl>' + fields.filter(([, value]) => value != null && String(value).trim())
    .map(([label, value]) => '<dt>' + label + '</dt><dd>' + escapeHTML(value) + '</dd>').join('') + '</dl>' + screening
}

export const readPyjamaRecruitment = async (descriptor, {
  readPage, readRenderer, readJson, permit, matchingEmployer, addJob, recordRead, inventoryRead, unresolved,
  exclude = () => {}, canRead = () => true, remainingRequests, maxPages = 8, maxDetails = 5,
  now = new Date().toISOString(),
}) => {
  const identity = boardIdentity(descriptor?.boardURL)
  requireValue(identity && identity.companyUUID === descriptor.companyUUID && identity.companyLabel === descriptor.companyLabel
    && https(descriptor.publisherURL) && text(descriptor.source) && Array.isArray(descriptor.expectedCompanyNames)
    && descriptor.expectedCompanyNames.some(name => key(name) === key(descriptor.companyLabel)), 'unreviewed current publisher handoff')
  requireValue(Number.isSafeInteger(maxPages) && maxPages > 0 && maxPages <= 24
    && Number.isSafeInteger(maxDetails) && maxDetails > 0 && maxDetails <= 80 && Number.isFinite(Date.parse(now)), 'invalid native read budget or observation time')
  let ownReads = 0
  const availableReads = () => {
    const count = remainingRequests ? remainingRequests() : 48 - ownReads
    requireValue(Number.isSafeInteger(count) && count >= 0, 'invalid remaining source read budget')
    return count
  }
  const read = async (callback, url, init = {}) => {
    requireValue(canRead() && availableReads() > 0, 'source request budget reached')
    permit(url)
    ownReads++
    return callback(url, init)
  }
  const board = modelOf(await read(readPage, descriptor.boardURL), descriptor.boardURL)
  const account = companyOf(board, descriptor, matchingEmployer), renderers = rendererDeclarations(board.document)
  const checkRenderers = async (init = {}) => {
    for (const [kind, url] of Object.entries(renderers)) {
      const script = await read(readRenderer, url, init)
      requireValue(script?.status === 200 && script.url === url && typeof script.html === 'string'
        && sha(script.html) === rendererProfiles[kind], 'native active renderer data flow changed')
    }
  }
  await checkRenderers()
  const pages = [], rows = [], seen = new Set()
  let next = listURL(descriptor), total = null
  while (next) {
    if (pages.length >= maxPages || pages.length > 0 && availableReads() < pages.length + 10) {
      unresolved('native-listing-budget-reached'); break
    }
    const payload = await read(readJson, next), snapshot = listingPage(payload), pageNumber = pages.length + 1
    if (total === null) total = payload.count
    requireValue(payload.count === total && (pageNumber === 1 ? payload.previous === null
      : paginationURL(payload.previous, descriptor, pageNumber - 1, true)), 'native listing pagination/count changed')
    for (const row of payload.results) {
      requireValue(!seen.has(row.id), 'native listing pagination repeated a role identity')
      seen.add(row.id); rows.push(row)
    }
    pages.push({ url: next, snapshot })
    requireValue(rows.length <= total && (!payload.next || payload.results.length > 0), 'native pagination made no progress')
    next = payload.next ? paginationURL(payload.next, descriptor, pageNumber + 1) : null
  }
  requireValue(rows.length === total || next && rows.length < total, 'native listing count is incomplete')
  inventoryRead({ kind: 'pyjama', surface: descriptor.boardURL, reportedTotal: total, observedRecords: rows.length,
    pagesFetched: pages.length, nativeListingTruncated: Boolean(next), nativeUnreadNext: next,
    listingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
  for (const row of rows) {
    recordRead({ ...structuredClone(row), url: roleURL(descriptor, row) }, { ...descriptor, companyId: account.company.id, employerName: account.company.name })
    if (!nativeCountryName(row.country)) unresolved('native-location-scope-unresolved')
  }
  const candidates = rows.filter(row => nativeCountryName(row.country) === 'India' && row.published_internally === false)
  // Each selected role needs API + public SSR opening/closing reads. Reserve
  // every selected listing page and the board/publisher/renderers for closing.
  const closingReads = pages.length + 4
  requireValue(availableReads() >= closingReads, 'closing source read budget is unavailable')
  const selectedCount = Math.min(candidates.length, maxDetails, Math.max(0, Math.floor((availableReads() - closingReads) / 4)))
  if (selectedCount < candidates.length) unresolved('native-detail-budget-reached')
  const staged = []
  for (const row of candidates.slice(0, selectedCount)) {
    const apiURL = detailURL(descriptor, row), sourceURL = roleURL(descriptor, row)
    const detail = await read(readJson, apiURL), openingSnapshot = detailModel(detail, row, account.domain)
    const visible = publicRole(await read(readPage, sourceURL), sourceURL, row, detail, descriptor, account, renderers, matchingEmployer)
    const closingDetail = await read(readJson, apiURL, { cache: 'no-store' })
    requireValue(detailModel(closingDetail, row, account.domain) === openingSnapshot, 'closing native detail changed')
    publicRole(await read(readPage, sourceURL, { cache: 'no-store' }), sourceURL, row, closingDetail, descriptor, account, renderers, matchingEmployer)
    if (nativeDateInstant(detail.valid_through) <= BigInt(Date.parse(now)) * 1000n) { exclude({ id: row.id, url: sourceURL, reason: 'native-role-expired' }); continue }
    staged.push({ id: String(row.id), title: row.title, url: sourceURL, applyURL: visible.applicationURL,
      description: completeDescription(detail), employer: { name: account.company.name, url: account.company.url },
      employerBinding: { method: 'current-corporate-handoff-native-SSR-company-and-reciprocal-detail-domain',
        surface: sourceURL, companyUUID: descriptor.companyUUID, nativeCompanyId: account.company.id, legalEmployer: null },
      legalEmployer: null, location: detail.location, employmentType: detail.job_type || null,
      posted: null, closing: detail.valid_through,
      record: { nativeDetail: structuredClone(detail), publicRoleSSRJob: structuredClone(visible.job),
        nativeCompanyDetails: structuredClone(account.company), nativeListingRecord: structuredClone(row),
        nativeOriginalDescription: detail.description, nativeCreatedAt: detail.created_at, nativeValidThrough: detail.valid_through,
        sourceAdditionalLocationCountryScopeUnresolved: detail.other_locations.length > 0,
        nativeClosingContext: { eachFullRoleAndAPIRechecked: true, nativeDetailSHA256: sha(openingSnapshot), companyScopeComplete: false } } })
  }
  for (const page of pages) requireValue(listingPage(await read(readJson, page.url, { cache: 'no-store' })) === page.snapshot, 'closing native listing changed')
  const closingBoard = modelOf(await read(readPage, descriptor.boardURL, { cache: 'no-store' }), descriptor.boardURL)
  requireValue(stable(companyOf(closingBoard, descriptor, matchingEmployer).company) === stable(account.company)
    && stable(rendererDeclarations(closingBoard.document)) === stable(renderers), 'closing native board company context changed')
  const publisher = await read(readPage, descriptor.publisherURL, { cache: 'no-store' })
  const closingDeclaration = declaredPyjamaRecruitment(publisher, { source: descriptor.source, companyName: descriptor.expectedCompanyNames[0],
    nativeEmployerNames: descriptor.expectedCompanyNames.slice(1), companyCareerPage: descriptor.publisherURL })
  requireValue(stable(closingDeclaration) === stable(descriptor), 'closing current publisher handoff changed')
  await checkRenderers({ cache: 'no-store' })
  for (const job of staged) {
    job.record.nativeClosingContext.currentPublisherHandoffRechecked = true
    job.record.nativeClosingContext.allSelectedListingPagesRechecked = true
    addJob(job)
  }
}
