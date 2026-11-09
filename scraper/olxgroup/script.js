import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { attachInventoryEvidence, mapJobsWithInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import OLX_GROUP_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = OLX_GROUP_CATALOG.source
export const COMPANY = OLX_GROUP_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = OLX_GROUP_CATALOG.officialBrandName
export const VERIFIED_ON = OLX_GROUP_CATALOG.verifiedOn
export const PROVIDER_METADATA = OLX_GROUP_CATALOG
export const CAREERS_PAGE_URL = OLX_GROUP_CATALOG.companyCareerPage
export const LEVER_BOARD_URL = OLX_GROUP_CATALOG.leverBoardUrl
export const LEVER_API_URL = OLX_GROUP_CATALOG.leverApiUrl

const DEFAULT_JSON_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&'),
)?.toLowerCase() || ''

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.any([...(signal ? [signal] : []), createTimeoutSignal(15000)]),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = (url, options) => fetchJsonWithRetry(url, {
  ...options,
  headers: DEFAULT_JSON_HEADERS,
  label: SOURCE,
  timeoutMs: 15000,
})

const extractCity = (location) => normalizeWhitespace(location)?.split(/\s+-\s+|,/)[0] || null

const toRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const toIsoDateTime = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const isIndiaLeverJob = (job) => [
  job?.categories?.location,
  ...(Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations : []),
].some((location) => /(^|[\s,-])india\b/i.test(normalizeWhitespace(location) || ''))

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Jobs\s*-\s*Careers OLX Group\s*<\/title>/i.test(page)
    && normalized.includes('shape your future at olx')
    && normalized.includes('search open roles')
    && normalized.includes('showing all open roles')
    && /https:\/\/jobs\.eu\.lever\.co\/olx\/[0-9a-f-]{8,}/i.test(page)
}

const nativeLeverLinks = html => readNativeDocument(html).nodes(node => node.tag === 'a' && node.attrs.href)
  .flatMap(node => {
    try {
      const url = new URL(node.attrs.href, CAREERS_PAGE_URL)
      return url.origin === 'https://jobs.eu.lever.co' && !url.username && !url.password
        && /^\/olx(?:\/[^/]+(?:\/apply)?)?\/?$/.test(url.pathname) ? [url] : []
    } catch { return [] }
  })

export const extractVerifiedLeverBoardUrl = (html = '') => nativeLeverLinks(html).length ? LEVER_BOARD_URL : null

export const hasOfficialLeverBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return normalized.includes('olx')
    && normalized.includes('location type')
    && normalized.includes('location')
    && normalized.includes('team')
    && normalized.includes('work type')
    && /https:\/\/jobs\.eu\.lever\.co\/olx\/[0-9a-f-]{8,}/i.test(page)
}

export const extractLeverJobs = (leverJobs = []) => {
  if (!Array.isArray(leverJobs)) {
    throw new Error('OLX Group verified Lever payload changed materially')
  }

  return leverJobs
    .filter(isIndiaLeverJob)
    .map((job) => {
      const title = normalizeWhitespace(job?.text)
      const location = normalizeWhitespace(job?.categories?.location)
      const sourceUrl = normalizeWhitespace(job?.hostedUrl)
      const id = normalizeWhitespace(job?.id)

      if (!title || !location || !sourceUrl || !id) {
        throw new Error('OLX Group verified Lever payload no longer exposes the expected India job fields')
      }

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
        location,
        city: extractCity(location),
        country: 'India',
        jobId: id,
        requisitionId: id,
        sourceUrl,
        applyUrl: normalizeWhitespace(job?.applyUrl) || sourceUrl,
        employmentType: normalizeWhitespace(job?.categories?.commitment),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: toIsoDateTime(job?.createdAt),
        closingDate: null,
        jobDescription: normalizeWhitespace(job?.descriptionPlain),
        remoteStatus: toRemoteStatus(job?.workplaceType),
      }
    })
}

export const createOlxGroupScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const careersPage = await fetchPage(CAREERS_PAGE_URL, { signal })
    signal?.throwIfAborted()
    if (
      Number(careersPage.status) !== 200
      || !sameUrl(careersPage.url, CAREERS_PAGE_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('OLX Group verified official careers page changed materially')
    }

    const verifiedLeverBoardUrl = extractVerifiedLeverBoardUrl(careersPage.html)
    if (!sameUrl(verifiedLeverBoardUrl, LEVER_BOARD_URL)) {
      throw new Error('OLX Group verified official careers page handoff changed materially')
    }

    const leverBoardPage = await fetchPage(LEVER_BOARD_URL, { signal })
    signal?.throwIfAborted()
    if (
      Number(leverBoardPage.status) !== 200
      || !sameUrl(leverBoardPage.url, LEVER_BOARD_URL)
      || !hasOfficialLeverBoardSignal(leverBoardPage.html)
    ) {
      throw new Error('OLX Group verified public Lever board changed materially')
    }

    const payload = await fetchJson(LEVER_API_URL, { signal })
    signal?.throwIfAborted()
    if (!Array.isArray(payload)) {
      throw new Error('OLX Group verified Lever payload changed materially')
    }

    const jobs = await createPublishingGapAtsScraper({ source: SOURCE, companyName: COMPANY,
      companyCareerPage: CAREERS_PAGE_URL, atsPlatform: 'lever', boardToken: 'olx', leverRegion: 'eu',
    }).run({ fetchJson: async () => payload, signal })
    const advertisedIds = [...nativeLeverLinks(careersPage.html), ...nativeLeverLinks(leverBoardPage.html)]
      .map(url => url.pathname.split('/').filter(Boolean)[1]).filter(Boolean)
    if (advertisedIds.some(id => !payload.some(row => row.id === id))) {
      attachInventoryEvidence(jobs, { ...readInventoryEvidence(jobs), status: 'discovery-only',
        listingComplete: false, reason: 'olxgroup-official-role-links-not-reconciled' })
      for (const job of jobs) job.sourceListingComplete = false
    }
    const byId = new Map(payload.map(row => [row.id, row]))
    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      department: normalizeWhitespace(byId.get(job.jobId)?.categories?.team || byId.get(job.jobId)?.categories?.department),
      city: extractCity(job.location),
      postingDate: toIsoDateTime(byId.get(job.jobId)?.createdAt),
      remoteStatus: toRemoteStatus(byId.get(job.jobId)?.workplaceType),
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_PAGE_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createOlxGroupScraper(options).run(options)

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
