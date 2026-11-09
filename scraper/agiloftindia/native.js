import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readHtml, normalize, hasClass } from './nativeHtml.js'
import catalog from './catalog.js'

export const SOURCE = catalog.source
export const COMPANY = catalog.companyName
export const CAREERS_ENTRY_URL = catalog.companyCareerPage
export const CAREERS_URL = CAREERS_ENTRY_URL
export const ACCEPTED_CAREERS_URLS = ['https://www.agiloft.com/careers', 'https://www.agiloft.com/careers/', 'https://www.agiloft.com/about-us/careers', 'https://www.agiloft.com/about-us/careers/']
export const LEVER_BOARD_URL = catalog.officialLeverBoardUrl
export const LEVER_API_URL = catalog.leverApiUrl
const comparable = url => String(url || '').split('#')[0].replace(/\/$/, '')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const sorted = values => [...new Set(values)].sort()
const fail = message => { throw Object.assign(new Error(`Agiloft ${message}`), { abortRetries: true }) }
const denied = (status, body = '') => [401, 403, 429].includes(status)
  || /<(?:title|h1|h2)[^>]*>[^<]*(?:access denied|just a moment|attention required|forbidden)|verify you are human|checking your browser|cf-chl-|captcha-container/i.test(body)
const isDenial = error => [401, 403, 429].includes(error?.status) || /access den|HTTP (401|403|429)|bot.?gate|captcha|verify you are human/i.test(error?.message || '')
const htmlText = html => { const d = readHtml(html); return normalize(d.text(d.root)) }
const iso = value => value == null || value === '' || !Number.isFinite(+new Date(value)) ? null : new Date(value).toISOString()
const created = value => typeof value === 'number' && Number.isFinite(value) ? iso(value) : null
const descendants = (node, predicate) => [node, ...node.children.filter(c => typeof c !== 'string').flatMap(c => descendants(c, predicate))].filter(predicate)
const one = (nodes, label) => { if (nodes.length !== 1) fail(`native detail has ambiguous or missing ${label}`); return nodes[0] }

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { method: 'GET', headers: { Accept: 'text/html,application/json' }, signal: signal || AbortSignal.timeout(30000) })
  let html
  try { html = await response.text() }
  catch (error) { if ([401, 403, 429].includes(response.status)) fail(`access denied HTTP ${response.status}`); throw error }
  if (denied(response.status, html)) fail(`access denied HTTP ${response.status}`)
  return { status: response.status, url: response.url || url, html }
}

export const hasOfficialCareersSignal = html => {
  const text = htmlText(String(html).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ''))
  return /agiloft careers/i.test(String(html)) && /level up with us|why work at agiloft/i.test(text)
}
export const extractLeverBoardUrl = html => {
  const d = readHtml(html)
  return d.nodes(n => n.tag === 'a').some(n => comparable(n.attrs.href) === LEVER_BOARD_URL) ? LEVER_BOARD_URL : null
}
export const extractCareersChannels = html => {
  const d = readHtml(String(html).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ''))
  const links = d.nodes(n => n.tag === 'a').map(n => n.attrs.href || '')
  const scripts = d.nodes(n => n.tag === 'script' && !n.attrs.src).map(n => n.raw || '')
  const directApi = scripts.some(s => /\bconst\s+API_URL\s*=\s*['"]https:\/\/api\.lever\.co\/v0\/postings\/agiloft\?mode=json['"]/.test(s) && /fetch\(API_URL\)/.test(s) && /\.hostedUrl\b/.test(s))
  const channels = sorted([
    ...links.filter(u => /https:\/\/(?:jobs\.lever\.co|jobs\.ashbyhq\.com|boards\.greenhouse\.io|job-boards\.greenhouse\.io|apply\.workable\.com|careers\.[^/]+)\//i.test(u)),
    ...(directApi ? [LEVER_API_URL] : []),
  ])
  const locales = sorted(links.map(u => { try { return new URL(u, CAREERS_URL) } catch { return null } }).filter(u => u?.hostname === 'www.agiloft.com' && /careers/i.test(u.pathname) && !ACCEPTED_CAREERS_URLS.some(x => comparable(x) === comparable(u.href))).map(u => u.href))
  return { directApi, channels, locales }
}

export const extractBoard = html => {
  const d = readHtml(html)
  const organization = d.nodes(n => n.tag === 'a' && hasClass(n, 'main-header-logo')).flatMap(n => descendants(n, c => c.tag === 'img')).map(n => n.attrs.alt).find(Boolean)
  const ids = sorted(d.nodes(n => n.tag === 'a').map(n => n.attrs.href?.match(/^https:\/\/jobs\.lever\.co\/agiloft\/([a-f0-9-]{36})(?:\/apply)?$/i)?.[1]).filter(Boolean))
  if (!/agiloft/i.test(organization || '') || (!ids.length && !/no (?:open |current )?(?:positions|jobs|openings)/i.test(d.text(d.root)))) fail('verified public Lever board identity or inventory missing')
  const pagination = d.nodes(n => n.tag === 'a' && /next|load more|older/i.test(d.text(n))).map(n => n.attrs.href).filter(Boolean)
  return { organization, ids, pagination }
}
export const hasOfficialLeverBoardSignal = html => { try { extractBoard(html); return true } catch { return false } }

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countryNames = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = displayNames.of(code)
  if (name !== code && name !== 'Unknown Region') countryNames.set(code, name)
}
const codeCountry = code => countryNames.get(String(code || '').toUpperCase()) || null
const namedCountry = label => {
  const value = normalize(label)
  const countries = sorted([...countryNames.values()]).sort((a, b) => b.length - a.length)
  return countries.find(country => new RegExp(`(?:^|[,;\\s-])${country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i').test(value)) || null
}
const locationsOf = job => sorted([job?.categories?.location, ...(job?.categories?.allLocations || [])].filter(x => typeof x === 'string' && normalize(x)).map(normalize))
export const assembleDescription = job => {
  const main = job.description || [job.opening, job.descriptionBody].filter(Boolean).join('\n')
  const sections = [main ? htmlText(main) : normalize(job.descriptionPlain || [job.openingPlain, job.descriptionBodyPlain].filter(Boolean).join('\n'))]
  for (const item of job.lists || []) sections.push(normalize(item.text), htmlText(item.content || ''))
  sections.push(job.additional ? htmlText(job.additional) : normalize(job.additionalPlain))
  return sections.filter(Boolean).join('\n\n')
}
const validUrls = job => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(job.id || '')
  && job.hostedUrl === `${LEVER_BOARD_URL}/${job.id}` && job.applyUrl === `${job.hostedUrl}/apply`
const inactive = (job, clock) => (job.isActive === false || job.published === false || /^(closed|expired|withdrawn|archived|draft)$/i.test(job.state || job.status || '')
  || (iso(job.validThrough || job.closedAt || job.closingDate) && +new Date(job.validThrough || job.closedAt || job.closingDate) <= +new Date(clock)))
const feedSnapshot = payload => {
  if (!Array.isArray(payload)) fail('Lever postings payload no longer returns an array')
  const ids = new Set()
  for (const job of payload) {
    if (!validUrls(job) || !normalize(job.text) || !locationsOf(job).length || ids.has(job.id)) fail('native posting identity, locations or uniqueness invalid')
    if (job.categories.allLocations != null && !Array.isArray(job.categories.allLocations)) fail('native secondary locations malformed')
    ids.add(job.id)
  }
  return payload
}
const baseJob = job => {
  const locations = locationsOf(job)
  const primaryCountry = codeCountry(job.country) || namedCountry(job.categories.location)
  const countries = sorted([primaryCountry, ...locations.map(namedCountry)].filter(Boolean))
  const indiaLocations = locations.filter(x => namedCountry(x) === 'India')
  const india = countries.includes('India')
  const location = indiaLocations.length ? indiaLocations.join('; ') : normalize(job.categories.location)
  const cityParts = indiaLocations.map(x => /^([^,]+),\s*(?:[^,]+,\s*)?India$/i.exec(x)?.[1]).filter(Boolean)
  return {
    title: normalize(job.text), company: 'Agiloft', employerLegalName: null,
    department: normalize(job.categories.department) || null, team: normalize(job.categories.team) || null,
    location, locations, primaryLocation: normalize(job.categories.location), workCountries: countries,
    country: india ? 'India' : primaryCountry, city: cityParts.length === 1 ? cityParts[0] : null,
    jobId: job.id, requisitionId: normalize(job.requisitionId) || null,
    sourceUrl: job.hostedUrl, applyUrl: job.applyUrl, employmentType: normalize(job.categories.commitment) || null,
    remoteStatus: ({ remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' })[String(job.workplaceType).toLowerCase()] || null,
    postingDate: created(job.createdAt), closingDate: iso(job.validThrough || job.closingDate),
    experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
    jobDescription: assembleDescription(job), nativeFields: structuredClone(job), isIndia: india,
  }
}
export const extractLeverJobs = payload => feedSnapshot(payload).map(baseJob).filter(j => j.isIndia).map(({ isIndia, ...job }) => job)

export const extractNativeDetail = (job, page, clock) => {
  const d = readHtml(page.html)
  const headline = one(d.nodes(n => hasClass(n, 'posting-headline')), 'headline')
  const title = d.text(one(descendants(headline, n => n.tag === 'h2'), 'title'))
  const location = d.text(one(descendants(headline, n => hasClass(n, 'location')), 'primary location'))
  const structured = d.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json').map(n => JSON.parse(n.raw || '{}')).filter(n => n['@type'] === 'JobPosting')
  const schema = one(structured, 'JobPosting metadata')
  const applyLinks = sorted(d.nodes(n => n.tag === 'a' && /apply for this job/i.test(d.text(n))).map(n => n.attrs.href))
  if (title !== normalize(job.text) || location !== normalize(job.categories.location) || schema.title !== job.text || schema.hiringOrganization?.name !== 'Agiloft' || !same(applyLinks, [job.applyUrl])) fail(`native detail identity/location/employer/application mismatch:${job.id}`)
  const content = one(d.nodes(n => hasClass(n, 'content')), 'posting content')
  const sections = descendants(content, n => n.tag === 'div' && hasClass(n, 'section') && hasClass(n, 'page-centered') && !hasClass(n, 'posting-header'))
    .filter(n => !descendants(n, c => c.tag === 'a' && /apply for this job/i.test(d.text(c))).length)
  const description = sections.map(n => d.text(n)).filter(Boolean).join('\n\n')
  const apiBackedDescription = sections.filter(n => n.attrs['data-qa'] !== 'ai-disclaimer').map(n => d.text(n)).filter(Boolean).join('\n\n')
  const apiDescription = assembleDescription(job)
  // Ignore only redundant whitespace and literal escaped newlines emitted by Lever's template.
  const comparableDescription = text => normalize(text.replace(/\\n/g, ' '))
  if (!description || comparableDescription(apiBackedDescription) !== comparableDescription(apiDescription) || comparableDescription(htmlText(schema.description)) !== comparableDescription(apiDescription)) fail(`native detail full description mismatch:${job.id}`)
  const row = baseJob(job)
  const knownLocations = locationsOf(job).every(x => namedCountry(x) || (x === normalize(job.categories.location) && codeCountry(job.country)))
  if (!knownLocations || (job.country && !codeCountry(job.country)) || !row.country) fail(`unresolved native work country:${job.id}`)
  if (codeCountry(job.country) && namedCountry(job.categories.location) && codeCountry(job.country) !== namedCountry(job.categories.location)) fail(`contradictory native primary country:${job.id}`)
  if (schema.validThrough && inactive({ validThrough: schema.validThrough }, clock)) return { ...row, nativeDetail: schema, expired: true }
  return { ...row, jobDescription: description, company: schema.hiringOrganization.name, employerLegalName: schema.hiringOrganization.legalName || null,
    requisitionId: (/requisition/i.test(schema.identifier?.name || '') ? schema.identifier.value : null) || job.requisitionId || null, postingDate: iso(schema.datePosted) || row.postingDate,
    closingDate: iso(schema.validThrough) || row.closingDate, nativeDetail: schema, expired: inactive(job, clock) }
}

export const createAgiloftIndiaScraper = ({ now: defaultNow = () => new Date().toISOString(), maxJobs: defaultCap = null } = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchJson, signal, now = defaultNow, maxJobs = defaultCap, onNativeAudit } = {}) {
    let pagesFetched = 0
    const getPage = async url => {
      pagesFetched++
      const page = await fetchPage(url, { signal })
      if (denied(page.status, page.html)) fail(`access denied HTTP ${page.status}`)
      if (page.status !== 200 || !page.html) fail(`native HTTP ${page.status} or empty page:${url}`)
      return page
    }
    const getFeed = async () => {
      if (!fetchJson) return feedSnapshot(JSON.parse((await getPage(LEVER_API_URL)).html))
      pagesFetched++
      const payload = await fetchJson(LEVER_API_URL, { signal })
      if (payload?.status && denied(payload.status, payload.html || payload.body)) fail(`access denied HTTP ${payload.status}`)
      return feedSnapshot(payload)
    }
    const careers = await getPage(CAREERS_URL)
    if (!ACCEPTED_CAREERS_URLS.some(url => comparable(url) === comparable(careers.url)) || !hasOfficialCareersSignal(careers.html)) fail('verified official careers surface changed materially')
    const channels = extractCareersChannels(careers.html)
    if (!channels.directApi && !channels.channels.includes(LEVER_BOARD_URL)) fail('corporate careers does not advertise the verified native handoff')
    const issues = []
    if (channels.locales.length || channels.channels.some(u => ![LEVER_API_URL, LEVER_BOARD_URL].includes(u))) issues.push('unreconciled-advertised-channel-or-locale')
    const boardPage = await getPage(LEVER_BOARD_URL)
    if (comparable(boardPage.url) !== LEVER_BOARD_URL) fail('verified public Lever board redirect changed')
    const board = extractBoard(boardPage.html)
    if (board.pagination.length) issues.push('unreconciled-native-pagination')
    const opening = await getFeed()
    if (!same(board.ids, sorted(opening.map(j => j.id)))) issues.push('opening-board-feed-membership-mismatch')
    const rows = []; const clock = now()
    for (const job of opening) {
      try {
        const page = await getPage(job.hostedUrl)
        if (comparable(page.url) !== job.hostedUrl) fail(`native detail redirect changed:${job.id}`)
        rows.push(extractNativeDetail(job, page, clock))
      } catch (error) { if (isDenial(error) || signal?.aborted) throw error; issues.push(error.message) }
    }
    let closing = null; let closingBoard = null; let closingChannels = null
    try {
      closing = await getFeed()
      const closingBoardPage = await getPage(LEVER_BOARD_URL)
      if (comparable(closingBoardPage.url) !== LEVER_BOARD_URL) fail('closing public board redirect changed')
      closingBoard = extractBoard(closingBoardPage.html)
      const closingCareers = await getPage(CAREERS_URL)
      if (!ACCEPTED_CAREERS_URLS.some(url => comparable(url) === comparable(closingCareers.url)) || !hasOfficialCareersSignal(closingCareers.html)) fail('closing corporate identity changed')
      closingChannels = extractCareersChannels(closingCareers.html)
      const stable = jobs => [...jobs].sort((a, b) => a.id.localeCompare(b.id))
      if (!same(stable(opening), stable(closing)) || !same(board, closingBoard) || !same(channels, closingChannels)) issues.push('closing-native-details-countries-membership-or-channels-changed')
    } catch (error) { if (isDenial(error) || signal?.aborted) throw error; issues.push(`closing-check-failed:${error.message}`) }
    const scrapedAt = now()
    const closingById = new Map((closing || []).map(j => [j.id, j]))
    const healthy = rows.filter(row => !row.expired && !inactive(row.nativeDetail, scrapedAt) && closingById.has(row.jobId) && !inactive(closingById.get(row.jobId), scrapedAt)
      && same(opening.find(j => j.id === row.jobId), closingById.get(row.jobId)))
    const india = healthy.filter(row => row.isIndia)
    const capped = Number.isInteger(maxJobs) && maxJobs >= 0 && india.length > maxJobs
    if (capped) issues.push('output-cap-after-full-inventory')
    const complete = issues.length === 0 && rows.length === opening.length
    const result = (capped ? india.slice(0, maxJobs) : india).map(({ isIndia, expired, ...job }) => ({ ...job, source: SOURCE, scrapedAt, link: job.applyUrl,
      sourceListingComplete: complete, sourceReportedTotal: complete ? opening.length : null, allowSourceCleanup: complete,
      companyCareerPage: CAREERS_URL, companyDomain: catalog.companyDomain, atsPlatform: 'lever' }))
    const audit = { source: SOURCE, verifiedAt: scrapedAt, complete, issues, channels, closingChannels,
      openingIds: board.ids, closingIds: closingBoard?.ids || null, nativeCount: opening.length, fullyHealthyCount: healthy.length,
      fullDetailCount: rows.length, indiaCount: india.length, eligibleCount: result.length, pagesFetched,
      reportedTotal: complete ? opening.length : null, wholeSourceNativeTotal: complete ? opening.length : null,
      verifiedIndiaTotal: complete ? india.length : null, allowSourceCleanup: complete, rows }
    onNativeAudit?.(audit)
    return attachInventoryEvidence(result, { status: complete ? 'complete-inventory' : 'coverage-gap', surface: LEVER_API_URL,
      firstParty: true, listingComplete: complete, pagesFetched, reportedTotal: complete ? opening.length : null,
      indiaFacetCount: complete ? india.length : null, verifiedAt: scrapedAt,
      reason: complete ? 'corporate-native-handoff-full-descriptions-countries-and-closing-membership-reconciled' : issues.join('; ') || 'incomplete-native-details' })
  },
})
