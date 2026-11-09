import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as wait } from 'node:timers/promises'

import { IRON_MOUNTAIN_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { buildNativeDataUrl, extractNativeIronJob, resolveNativeWorkday, validateNativeNlx } from './nativeDetails.js'

export { buildNativeDataUrl, extractNativeIronJob, resolveNativeWorkday, validateNativeNlx }

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_PAGE_URL = PROVIDER_METADATA.aboutPageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_SITEMAP_URL = PROVIDER_METADATA.jobsSitemapUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const capitalizeWord = (word) => {
  const normalized = String(word ?? '').trim().toLowerCase()
  if (!normalized) return ''
  return normalized[0].toUpperCase() + normalized.slice(1)
}

const uppercaseShortWord = (word) => {
  const normalized = String(word ?? '').trim().toLowerCase()
  if (!normalized) return ''
  if (/^[a-z]+$/.test(normalized) && normalized.length <= 3) {
    return normalized.toUpperCase()
  }

  return capitalizeWord(normalized)
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)].filter(Boolean)),
  })
  if (Number(response.headers.get('content-length')) > 2000000) throw new Error('Iron Mountain native response exceeds2MB body bound')
  const html = await response.text()
  signal?.throwIfAborted()
  if (Buffer.byteLength(html) > 2000000) throw new Error('Iron Mountain native response exceeds2MB body bound')
  return {
    status: response.status,
    url: response.url,
    html,
  }
}

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

const receiveWithAbort = async (action, signal) => {
  signal.throwIfAborted()
  let onAbort, settlementTimer
  const aborted = new Promise((resolve, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  const operation = Promise.resolve().then(action)
  try { return await Promise.race([operation, aborted]) }
  catch (error) {
    if (!signal.aborted) throw error
    await Promise.race([operation.catch(() => {}), new Promise(resolve => { settlementTimer = setTimeout(resolve, 100) })])
    throw signal.reason
  } finally { signal.removeEventListener('abort', onAbort); clearTimeout(settlementTimer) }
}

export const hasOfficialAboutPageCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Discover who we are \| Iron Mountain United States\s*<\/title>/i.test(page)
    && /<h1>\s*About Iron Mountain\s*<\/h1>/i.test(page)
    && /meta name=["']careers-board-domain["'] content=["']ironmountain\.jobs["']/i.test(page)
    && /href=["']\/company\/about\/careers["']/i.test(page)
    && text.includes('We protect what our customers value most.')
  }

export const hasOfficialJobsBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Home \| Iron Mountain\s*<\/title>/i.test(page)
    && /"job-folder"\s*:\s*"ironmountain-jobs"/i.test(page)
    && /"x-origin"\s*:\s*"ironmountain\.jobs"/i.test(page)
}

export const hasVercelSecurityCheckpointSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Vercel Security Checkpoint\s*<\/title>/i.test(page)
    && text.includes('Vercel Security Checkpoint')
}

const hasOfficialJobDetailSignal = (html = '') => {
  const page = String(html ?? '')

  return /"job-folder"\s*:\s*"ironmountain-jobs"/i.test(page)
    && /"x-origin"\s*:\s*"ironmountain\.jobs"/i.test(page)
    && /id=["']__NUXT_DATA__["']/i.test(page)
}

export const extractSitemapEntries = (xml = '') =>
  [...String(xml ?? '').matchAll(/<url>\s*<loc>\s*([^<]+)\s*<\/loc>\s*<lastmod>\s*([^<]+)\s*<\/lastmod>\s*<\/url>/gi)]
    .map((match) => ({
      url: match[1].trim(),
      lastmod: match[2].trim(),
    }))

export const isIndiaJobUrl = (url = '') => /https:\/\/ironmountain\.jobs\/[^/]+-ind\/[^/]+\/[A-Z0-9]+\/job\/?$/i.test(String(url))

export const humanizeTitleSlug = (slug = '') =>
  String(slug ?? '')
    .split('-')
    .filter(Boolean)
    .map(uppercaseShortWord)
    .join(' ')

export const formatIndiaLocationFromSlug = (slug = '') => {
  const baseSlug = String(slug ?? '').replace(/-ind$/i, '')
  const location = baseSlug
    .split('-')
    .filter(Boolean)
    .map(capitalizeWord)
    .join(' ')

  return location ? `${location}, India` : 'India'
}

const parseJobUrl = (url) => {
  try {
    const { pathname } = new URL(url)
    const [locationSlug, titleSlug, jobId, marker] = pathname.split('/').filter(Boolean)
    if (!locationSlug || !titleSlug || !jobId || marker !== 'job') return null
    return { locationSlug, titleSlug, jobId }
  } catch {
    return null
  }
}

export const mapSitemapEntryToJob = (entry = {}) => {
  if (!isIndiaJobUrl(entry.url)) return null

  const parsed = parseJobUrl(entry.url)
  if (!parsed) return null

  const location = formatIndiaLocationFromSlug(parsed.locationSlug)
  const city = location.replace(/,\s*India$/i, '')

  return {
    title: humanizeTitleSlug(parsed.titleSlug),
    company: COMPANY_NAME,
    department: null,
    location,
    city,
    country: 'India',
    jobId: parsed.jobId,
    requisitionId: parsed.jobId,
    sourceUrl: entry.url,
    applyUrl: entry.url,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: entry.lastmod || null,
    closingDate: null,
    jobDescription: null,
  }
}

export const createIronMountainIndiaScraper = ({
  now = () => new Date().toISOString(),
  maxJobs = null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage, fetchText, fetchBrowserText, signal,
    now: currentTime = now, maxJobs: runMaxJobs = maxJobs, requestIntervalMs = 500, sourceBudgetMs = 120000,
  } = {}) {
    signal?.throwIfAborted()
    if (fetchText || fetchBrowserText || typeof fetchPage !== 'function') throw new Error('Iron Mountain native runtime requires response receipts; text-only hooks are unsupported')
    if ((runMaxJobs != null && (!Number.isSafeInteger(runMaxJobs) || runMaxJobs < 1 || runMaxJobs > 100))
      || !Number.isSafeInteger(requestIntervalMs) || requestIntervalMs < 0 || requestIntervalMs > 5000
      || !Number.isSafeInteger(sourceBudgetMs) || sourceBudgetMs < 1 || sourceBudgetMs > 120000) throw new Error('Iron Mountain native bounded run options are invalid')
    const controller = new AbortController(), combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    const timer = setTimeout(() => controller.abort(new Error(`Iron Mountain native ${sourceBudgetMs}ms source deadline exhausted`)), sourceBudgetMs)
    let lastStart = 0
    const loadPage = async (url, stage = 'publisher') => {
      combined.throwIfAborted()
      const remaining = requestIntervalMs - (Date.now() - lastStart)
      if (remaining > 0) {
        try { await wait(remaining, undefined, { signal: combined }) } catch (error) { combined.throwIfAborted(); throw error }
      }
      combined.throwIfAborted(); lastStart = Date.now()
      const response = await receiveWithAbort(() => fetchPage(url, { signal: combined }), combined)
      combined.throwIfAborted()
      if (!Number.isSafeInteger(response?.status) || typeof response.html !== 'string' || typeof response.url !== 'string'
        || (stage !== 'apply' && response.url !== url)) throw new Error(`Iron Mountain native ${stage} response identity changed`)
      if (Buffer.byteLength(response.html) > 2000000) throw new Error('Iron Mountain native response exceeds2MB body bound')
      if (response.status !== 200 && !(stage === 'publisher' && url === ABOUT_PAGE_URL)) {
        let upstreamErrorCode = null
        try { upstreamErrorCode = JSON.parse(response.html).errorCode || null } catch {}
        throw Object.assign(new Error(`Iron Mountain native ${stage} HTTP${response.status}${upstreamErrorCode ? ':' + upstreamErrorCode : ''}`),
          { status: response.status, statusCode: response.status, stage, upstreamErrorCode })
      }
      return response
    }
    const loadJson = async (url, stage) => {
      const response = await loadPage(url, stage)
      try { return JSON.parse(response.html) } catch { throw new Error(`Iron Mountain native ${stage} returned malformed JSON`) }
    }
    try {
    const aboutPage = await loadPage(ABOUT_PAGE_URL)
    const aboutPageHtml = getPageHtml(aboutPage)
    const aboutPageIsCheckpointed =
      Number(aboutPage.status) === 429
      && String(aboutPage.url || ABOUT_PAGE_URL) === ABOUT_PAGE_URL
      && hasVercelSecurityCheckpointSignal(aboutPageHtml)

    if (!aboutPageIsCheckpointed && (aboutPage.status !== 200 || !hasOfficialAboutPageCareersSignal(aboutPageHtml))) {
      throw new Error('Iron Mountain India verified about page changed materially')
    }

    const jobsBoardHtml = getPageHtml(await loadPage(CAREERS_URL))
    if (!hasOfficialJobsBoardSignal(jobsBoardHtml)) {
      throw new Error('Iron Mountain India verified jobs board changed materially')
    }

    const sitemapXml = getPageHtml(await loadPage(JOBS_SITEMAP_URL))
    if (!/<urlset\b/i.test(sitemapXml) || !/<\/urlset>/i.test(sitemapXml)) throw new Error('Iron Mountain native sitemap is truncated or malformed')
    const indiaEntries = extractSitemapEntries(sitemapXml).filter((entry) => isIndiaJobUrl(entry.url))
    if (indiaEntries.length > 100) throw new Error('Iron Mountain native India routes exceed100-role bounded limit')
    const identities = new Set()
    for (const entry of indiaEntries) {
      const identity = buildNativeDataUrl(entry)
      if (identities.has(identity)) throw new Error('Iron Mountain native sitemap repeats a role identity')
      identities.add(identity)
    }
    const selectedEntries = runMaxJobs == null ? indiaEntries : indiaEntries.slice(0, runMaxJobs)
    const jobs = [], errors = []

    for (const entry of selectedEntries) {
      try {
      const nlx = validateNativeNlx(entry, await loadJson(buildNativeDataUrl(entry), 'nlx-detail'))
      const applyReceipt = await loadPage(nlx.link, 'apply'), target = resolveNativeWorkday(applyReceipt)
      const primary = await loadJson(target.cxsUrl, 'workday-detail')
      const job = extractNativeIronJob(entry, nlx, applyReceipt, primary, { now: currentTime() })
      jobs.push({ ...job,
        publicExperienceChecked: true,
        link: job.applyUrl, source: SOURCE, scrapedAt: currentTime(), sourceListingComplete: false, lifecycleCleanupAllowed: false,
        companyDomain: PROVIDER_METADATA.companyDomain, companyCareerPage: CAREERS_URL, atsPlatform: 'nlx',
      })
      } catch (error) { combined.throwIfAborted(); errors.push(error) }
    }
    combined.throwIfAborted()
    return attachInventoryEvidence(jobs, { status: jobs.length ? 'discovery-only' : 'coverage-gap', surface: CAREERS_URL,
      firstParty: true, listingComplete: false, pagesFetched: 1, reportedTotal: null, indiaFacetCount: null, verifiedAt: currentTime(),
      reason: `full-company-scope-unverified;observed-india-routes=${indiaEntries.length};selected-details=${selectedEntries.length};verified-details=${jobs.length};detail-failures=${errors.length};publisher-about-checkpointed=${aboutPageIsCheckpointed}${errors.length ? ';' + errors.map(error => error.message).join(';') : ''}`,
    })
    } finally { clearTimeout(timer) }
  },
})

export const run = async (options = {}) => createIronMountainIndiaScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
