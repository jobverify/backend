import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

import { CALENDLY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CALENDLY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const GREENHOUSE_BOARD_URL = PROVIDER_METADATA.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeEntities = value => String(value ?? '').replace(/&(#x[\da-f]+|#\d+|amp|nbsp|quot|apos|lt|gt|ndash|mdash|rsquo|lsquo|ldquo|rdquo|hellip);/gi, (entity, key) => {
  if (key.startsWith('#')) return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1)))
  return ({ amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…' })[key.toLowerCase()]
})
const decodeHtml = value => {
  let decoded = String(value ?? '')
  // Greenhouse content=true returns escaped HTML with some entities escaped again.
  for (let pass = 0; pass < 3; pass++) decoded = decodeEntities(decoded)
  return normalizeWhitespace(decoded)
}

const collectLocationValues = (job = {}) => [
  normalizeWhitespace(job?.location?.name),
  ...(Array.isArray(job?.offices)
    ? job.offices.map((office) => normalizeWhitespace(office?.location || office?.name))
    : []),
  ...(Array.isArray(job?.metadata)
    ? job.metadata.filter(entry => /^(country|job country|location)$/i.test(entry?.name || '')).map((entry) => normalizeWhitespace(entry?.value))
    : []),
].filter(Boolean)

const hasIndiaMarker = (value) => /\bindia\b/i.test(String(value ?? ''))

const inferCity = (location) => {
  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return firstToken
}

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  signal: options.signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  signal: options.signal,
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = async (url, { signal } = {}) => {
  const timeout = AbortSignal.timeout(15000)
  const response = await fetch(url, { method: 'GET', redirect: 'manual',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json,text/html' } })
  return { status: response.status, url: response.url, location: response.headers.get('location'), body: await response.text() }
}

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  const canonicalJobId = normalizeWhitespace(jobId)
  if (!canonicalJobId) return null

  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '')

    if (hostname !== 'job-boards.greenhouse.io') return null
    if (pathname !== `/calendly/jobs/${canonicalJobId}`) return null

    return `https://job-boards.greenhouse.io/calendly/jobs/${canonicalJobId}`
  } catch {
    return null
  }
}

const careersHandoff = html => {
  const document = readVisibleNativeDocument(String(html), { strict: true })
  return document.nodes(node => node.tag === 'a' && node.attrs.href && document.text(node))
  .map(node => { try { return new URL(node.attrs.href) } catch { return null } })
  .filter(url => url?.protocol === 'https:' && ['boards.greenhouse.io', 'job-boards.greenhouse.io'].includes(url.hostname)
    && !url.username && !url.password && !url.port && !url.hash
    && (/^\/calendly(?:\/jobs\/\d+)?\/?$/.test(url.pathname)
      || (url.pathname === '/embed/job_app' && url.searchParams.getAll('for').length === 1 && url.searchParams.get('for') === 'calendly'
        && url.searchParams.getAll('token').length === 1 && /^\d+$/.test(url.searchParams.get('token') || ''))))
}
const careersJobIds = html => [...new Set(careersHandoff(html).map(url => url.pathname.match(/^\/calendly\/jobs\/(\d+)\/?$/)?.[1]
  || (url.pathname === '/embed/job_app' ? url.searchParams.get('token') : null)).filter(Boolean))]
const countryForJob = job => {
  const values = collectLocationValues(job)
  const india = values.some(value => hasIndiaMarker(value) || /^IN$/i.test(value))
  const foreign = values.some(value => /\b(?:US|USA|United States|Canada|United Kingdom|UK|Singapore|Australia|Germany|Ireland|Philippines)\b/i.test(value))
  if (india && foreign) throw new Error('Calendly contradictory public location country')
  if (!india && !foreign) throw new Error('Calendly unresolved public location country')
  return { country: india ? 'India' : 'foreign', location: values.find(value => hasIndiaMarker(value)) || normalizeWhitespace(job.location?.name) || values[0] }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const document = readVisibleNativeDocument(page, { strict: true })
  const normalized = document.nodes(node => node.tag === 'root').map(node => document.text(node)).join(' ')
  const titles = document.nodes(node => node.tag === 'title')
  const hasVerifiedHeroCopy =
    normalized.includes('Join us in creating better meeting experiences')
    || normalized.includes('Join us in helping people make space for what matters')

  return titles.length === 1 && /^\s*Let(?:'|&#x27;|&#39;|&apos;)s make meetings better together \| Calendly\s*$/i.test(titles[0].raw)
    && normalized.includes('Careers at Calendly')
    && hasVerifiedHeroCopy
    && (
      (
        normalized.includes('Filter by location')
        && normalized.includes('Filter by department')
        && careersHandoff(page).length > 0
      ) || (
        normalized.includes('Open roles')
        && normalized.includes('Take a look at our open positions and join us on our mission to make people love meetings.')
      )
    )
    && careersHandoff(page).length > 0
    && normalized.includes('Copyright Calendly')
}

const inventoryFailure = message => new Error('Calendly careers inventory: ' + message)
const validateNativeBoard = (html, payload) => {
  const document = readVisibleNativeDocument(String(html), { strict: true })
  const titles = document.nodes(node => node.tag === 'title')
  const headings = document.nodes(node => /^h[1-6]$/.test(node.tag)).map(node => document.text(node))
  const totals = headings.filter(value => /^\d+ jobs?$/.test(value))
  if (titles.length !== 1 || titles[0].raw !== 'Jobs at Calendly' || !headings.includes('Current openings at Calendly') || totals.length !== 1) {
    throw inventoryFailure('native board identity or published total changed')
  }
  const links = document.nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
    let url
    try { url = new URL(node.attrs.href, GREENHOUSE_BOARD_URL) } catch { return [] }
    if (!url.pathname.includes('/jobs/')) return []
    const id = url.pathname.match(/^\/calendly\/jobs\/(\d+)$/)?.[1]
    if (!id || url.protocol !== 'https:' || url.hostname !== 'job-boards.greenhouse.io' || url.username || url.password || url.port || url.hash) {
      throw inventoryFailure('native board role identity changed')
    }
    return [id]
  })
  const total = Number(totals[0].split(' ')[0])
  if (new Set(links).size !== links.length || total !== links.length || total !== payload.meta.total
    || payload.jobs.some(job => !links.includes(String(job.id)))) throw inventoryFailure('native board duplicate/count/identity inventory disagreement')
  return links.sort().join(',')
}

const proveUnavailableCard = async (id, readPage) => {
  const jobUrl = GREENHOUSE_BOARD_URL + '/jobs/' + id
  const page = await readPage(jobUrl)
  let redirect
  try { redirect = new URL(page.location, jobUrl) } catch { throw inventoryFailure('missing native unavailable-role redirect proof for ' + id) }
  if (page.status !== 302 || redirect.origin !== new URL(GREENHOUSE_BOARD_URL).origin || redirect.pathname !== '/calendly'
    || redirect.username || redirect.password || redirect.hash || redirect.search !== '?error=true') {
    throw inventoryFailure('native role is not proven unavailable by the published redirect contract: ' + id)
  }
  const api = await readPage(GREENHOUSE_JOBS_API_URL + '/' + id)
  let value
  try { value = JSON.parse(api.body) } catch { throw inventoryFailure('unavailable-role API proof is not the native error envelope: ' + id) }
  if (api.status !== 404 || value?.status !== 404 || value?.error !== 'Job not found' || Object.keys(value).some(key => !['status', 'error'].includes(key))) {
    throw inventoryFailure('native API does not prove the role unavailable: ' + id)
  }
}

const nativeJobDate = (value, { publication = false, now } = {}) => {
  if (value == null || value === '') return null
  const match = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value)
  if (!match) throw new Error('Calendly invalid native publication/deadline date')
  const calendar = `${match[1]}T${match[2] || '00'}:${match[3] || '00'}:${match[4] || '00'}`
  const calendarCheck = new Date(calendar + '.000Z'), instant = new Date(value)
  if (!Number.isFinite(+calendarCheck) || calendarCheck.toISOString().slice(0, 19) !== calendar || !Number.isFinite(+instant)
    || (publication && (!Number.isFinite(Date.parse(now)) || +instant > Date.parse(now)))) throw new Error('Calendly invalid/future native publication date')
  return match[2] ? instant.toISOString() : match[1]
}

export const extractIndiaJobsFromGreenhousePayload = (
  payload,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('Calendly Greenhouse jobs API response no longer matches the expected payload')
  }

  if (!Number.isSafeInteger(payload?.meta?.total) || payload.meta.total !== jobs.length) {
    throw new Error('Calendly incomplete Greenhouse inventory: reported count disagrees')
  }
  const seen = new Set()
  for (const job of jobs) {
    if (!/^\d+$/.test(String(job?.id ?? '')) || !Number.isSafeInteger(Number(job.id)) || Number(job.id) <= 0 || seen.has(String(job.id))) {
      throw new Error('Calendly repeated or invalid public job identity')
    }
    seen.add(String(job.id))
  }

  return jobs.flatMap((job) => {
    const title = normalizeWhitespace(job?.title)
    const companyName = normalizeWhitespace(job?.company_name)
    const sourceUrl = normalizeGreenhouseJobUrl(job?.absolute_url, job?.id)

    if (!companyName || companyName.toLowerCase() !== COMPANY_NAME.toLowerCase()) {
      throw new Error('Calendly Greenhouse payload no longer maps to the verified company identity')
    }

    if (!title || !sourceUrl) {
      throw new Error('Calendly Greenhouse payload no longer exposes the verified Greenhouse detail route')
    }

    if (typeof job?.content !== 'string') throw new Error('Calendly malformed full public job description')
    const jobDescription = decodeHtml(job?.content)
    if (!jobDescription) throw new Error('Calendly incomplete public job description')
    const postingDate = nativeJobDate(job.first_published, { publication: true, now: scrapedAt })
    const closingDate = nativeJobDate(job.application_deadline)
    const { country, location } = countryForJob(job)
    if (country !== 'India') return []

    return [{
      title,
      company: COMPANY_NAME,
      location,
      city: inferCity(location),
      country: 'India',
      link: sourceUrl,
      applyUrl: sourceUrl,
      sourceUrl,
      source: SOURCE,
      jobId: String(job?.id),
      requisitionId: normalizeWhitespace(job?.requisition_id),
      department: normalizeWhitespace(job?.departments?.[0]?.name),
      employmentType: null,
      experienceRequired: null,
      jobDescription,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      sourcePostingDateRaw: job.first_published || null,
      sourcePostingDateProvenance: postingDate ? 'native Greenhouse.first_published' : null,
      nativeUpdatedAtOriginal: job.updated_at ?? null,
      nativeDateUnknown: postingDate === null,
      originalPublicationDateQualified: postingDate !== null,
      publicationDateProvenance: postingDate ? 'official-greenhouse-first_published' : null,
      closingDate,
      nativeApplicationDeadlineOriginal: job.application_deadline ?? null,
      sourceClosingDateIsExact: Boolean(closingDate && closingDate.includes('T')),
      closingDateProvenance: closingDate ? 'official-greenhouse-application_deadline' : null,
      scrapedAt,
    }]
  })
}

export const createCalendlyScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchPage = defaultFetchPage,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    let pagesFetched = 0
    const readText = async url => { signal?.throwIfAborted(); pagesFetched++; const value = await fetchText(url, { signal }); signal?.throwIfAborted(); return value }
    const readJson = async url => { signal?.throwIfAborted(); pagesFetched++; const value = await fetchJson(url, signal ? { method: 'GET', signal } : { method: 'GET' }); signal?.throwIfAborted(); return value }
    const readPage = async url => {
      signal?.throwIfAborted(); pagesFetched++
      const value = await fetchPage(url, { signal }); signal?.throwIfAborted()
      if ([401, 403, 429].includes(value?.status)) throw Object.assign(inventoryFailure('native role proof unavailable: HTTP ' + value.status), { status: value.status, abortRetries: true })
      if (!value || value.url !== url || typeof value.body !== 'string' || Buffer.byteLength(value.body) > 4000000) throw inventoryFailure('native role proof identity/response changed')
      return value
    }
    const careersHtml = await readText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Calendly verified official careers page no longer matches the trusted public surface')
    }

    const payload = await readJson(buildGreenhouseJobsApiUrl())
    const scrapedAt = now()
    const jobs = extractIndiaJobsFromGreenhousePayload(payload, { scrapedAt })
    const cardIds = careersJobIds(careersHtml)
    const unavailable = cardIds.filter(id => !payload.jobs.some(job => String(job.id) === id))
    if (cardIds.length && payload.jobs.some(job => !cardIds.includes(String(job.id)))) {
      throw inventoryFailure('official careers role cards and complete API inventory disagree: live role missing from careers cards')
    }
    let boardFingerprint
    if (unavailable.length) {
      if (unavailable.length > 5) throw inventoryFailure('unavailable corporate card proof exceeds bounded review scope')
      boardFingerprint = validateNativeBoard(await readText(GREENHOUSE_BOARD_URL), payload)
      for (const id of unavailable) await proveUnavailableCard(id, readPage)
    }
    const last = await readJson(buildGreenhouseJobsApiUrl())
    extractIndiaJobsFromGreenhousePayload(last, { scrapedAt })
    const fingerprint = value => JSON.stringify([...value.jobs].sort((a, b) => Number(a.id) - Number(b.id)))
    if (fingerprint(last) !== fingerprint(payload)) throw new Error('Calendly public inventory changed during validation')
    if (unavailable.length) {
      const closingCareers = await readText(CAREERS_URL)
      if (!hasOfficialCareersPageSignal(closingCareers) || careersJobIds(closingCareers).sort().join(',') !== [...cardIds].sort().join(',')) {
        throw inventoryFailure('official careers card inventory changed during closing validation')
      }
      if (validateNativeBoard(await readText(GREENHOUSE_BOARD_URL), last) !== boardFingerprint) throw inventoryFailure('native board inventory changed during closing validation')
      for (const id of unavailable) await proveUnavailableCard(id, readPage)
    }
    return attachInventoryEvidence(jobs, {
      status: payload.meta.total ? 'complete-inventory' : 'verified-empty',
      surface: buildGreenhouseJobsApiUrl(), firstParty: true, listingComplete: true, pagesFetched,
      reportedTotal: payload.meta.total, indiaFacetCount: jobs.length, verifiedAt: scrapedAt,
      reason: 'Verified visible Calendly Greenhouse handoff, complete total/unique identities/full descriptions and stable full snapshot before country filtering.'
        + (unavailable.length ? ' Corporate cards unavailable on the current public board: ' + unavailable.join(',') + '; branded native board omission, native 302 error redirect and 404 Job not found reconciled at opening and closing; closure reason/date unqualified.' : ' Matching public careers card identities.'),
    })
  },
})

export const run = async (options = {}) => createCalendlyScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
