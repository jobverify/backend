import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { RIPPLING_CATALOG } from './catalog.js'
import { isExactPublicJobUrl } from '../../rewriting/publicPostingDescription.js'
import { ripplingPostingDescription } from '../../rewriting/ripplingPostingDescription.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = RIPPLING_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OPEN_ROLES_URL = PROVIDER_METADATA.openRolesUrl
export const ALGOLIA_SEARCH_URL = PROVIDER_METADATA.algoliaSearchUrl
export const ALGOLIA_APPLICATION_ID = PROVIDER_METADATA.algoliaApplicationId
export const ALGOLIA_API_KEY = PROVIDER_METADATA.algoliaApiKey
export const ALGOLIA_INDEX_NAME = PROVIDER_METADATA.algoliaIndexName
export const DEFAULT_HITS_PER_PAGE = 1000

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractFirst = (pattern, value) => pattern.exec(String(value ?? ''))?.[1] ?? null

const parseNextData = (html) => {
  const payload = extractFirst(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    html,
  )

  if (!payload) {
    throw new Error('Rippling verified open roles surface no longer exposes __NEXT_DATA__')
  }

  return JSON.parse(payload)
}

const getPageProps = (nextData) => nextData?.props?.pageProps ?? nextData?.pageProps ?? null

const isIndiaLocationName = (value) => /\bIndia\b/i.test(String(value ?? ''))

const toAbsoluteUrl = (value, baseUrl = OPEN_ROLES_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const deriveCity = (locationName) => {
  const normalized = normalizeWhitespace(locationName)
  if (!normalized) return null

  const remoteMatch = /^Remote\s*\((.+)\)$/i.exec(normalized)
  const candidate = remoteMatch?.[1] ?? normalized
  const firstPart = normalizeWhitespace(candidate.split(',')[0])

  if (!firstPart || /^india$/i.test(firstPart) || /^remote$/i.test(firstPart)) {
    return null
  }

  return firstPart
}

const findIndiaLocation = (hit = {}) => {
  if (!Array.isArray(hit?.locations)) return null

  return hit.locations.find((location) => (
    String(location?.countryCode ?? '').toUpperCase() === 'IN'
    || normalizeWhitespace(location?.country) === 'India'
    || isIndiaLocationName(location?.name)
  )) ?? null
}

const getAlgoliaHits = (payload) => {
  const hits = payload?.hits
  if (!Array.isArray(hits)) {
    throw new Error('Rippling Algolia payload no longer matches the verified search response')
  }

  return hits
}

const normalizeHit = (
  hit,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const indiaLocation = findIndiaLocation(hit)
  if (!indiaLocation) return null

  const title = normalizeWhitespace(hit?.name)
  const jobId = normalizeWhitespace(hit?.jobId) || normalizeWhitespace(String(hit?.objectID ?? '').split('__')[0])
  const location = normalizeWhitespace(
    indiaLocation?.name
      || (Array.isArray(hit?.locationNames) ? hit.locationNames.find((value) => isIndiaLocationName(value)) : null),
  )
  const sourceUrl = toAbsoluteUrl(hit?.url, 'https://ats.rippling.com/')

  if (!title || !jobId || !location || !sourceUrl) {
    throw new Error('Rippling Algolia payload no longer exposes the verified India job fields')
  }

  return {
    title,
    company: COMPANY,
    department: normalizeWhitespace(hit?.departmentName ?? hit?.department?.name),
    location,
    city: deriveCity(location),
    country: 'India',
    workplaceType: normalizeWhitespace(indiaLocation?.workplaceType ?? (hit?.isRemote ? 'REMOTE' : null)),
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    link: sourceUrl,
    source: SOURCE,
    scrapedAt,
  }
}

const requestSignal = signal => signal
  ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)

const defaultFetchText = async (url, { signal, includeResponseMetadata = false } = {}) => {
  const response = await fetch(url, {
    signal: requestSignal(signal),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const html = await response.text()
  return includeResponseMetadata ? { status: response.status, url: response.url, html } : html
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    signal: requestSignal(options.signal),
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
      'x-algolia-application-id': ALGOLIA_APPLICATION_ID,
      'x-algolia-api-key': ALGOLIA_API_KEY,
      ...(options.headers || {}),
    },
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const hasVerifiedCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Rippling Careers\b[\s\S]*?<\/title>/i.test(rawHtml)
    && /Work will never be the same\.\s*Neither will you\./i.test(rawHtml)
    && /href=["'](?:https:\/\/www\.rippling\.com)?\/careers\/open-roles["']/i.test(rawHtml)
}

export const hasVerifiedOpenRolesPageSignal = (html) => {
  const rawHtml = String(html ?? '')

  try {
    const pageProps = getPageProps(parseNextData(rawHtml))
    const data = pageProps?.data

    return /Open roles/i.test(rawHtml)
      && /@rippling\.com email addresses/i.test(rawHtml)
      && normalizeWhitespace(data?.algoliaIndexName) === ALGOLIA_INDEX_NAME
      && normalizeWhitespace(data?.listMode) === 'pagination'
  } catch {
    return false
  }
}

export const extractOpenRolesSearchConfig = (html) => {
  const rawHtml = String(html ?? '')
  const pageProps = getPageProps(parseNextData(rawHtml))
  const data = pageProps?.data
  const algoliaIndexName = normalizeWhitespace(data?.algoliaIndexName)
  const listMode = normalizeWhitespace(data?.listMode)

  if (
    !/Open roles/i.test(rawHtml)
    || !/@rippling\.com email addresses/i.test(rawHtml)
    || algoliaIndexName !== ALGOLIA_INDEX_NAME
    || listMode !== 'pagination'
  ) {
    throw new Error('Rippling verified open roles surface no longer matches the known search contract')
  }

  return { algoliaIndexName, listMode }
}

export const buildAlgoliaQueryUrl = (indexName = ALGOLIA_INDEX_NAME) =>
  `https://${ALGOLIA_APPLICATION_ID}-dsn.algolia.net/1/indexes/${encodeURIComponent(indexName)}/query`

export const buildAlgoliaQueryBody = ({
  page = 0,
  hitsPerPage = DEFAULT_HITS_PER_PAGE,
} = {}) => ({
  params: new URLSearchParams({
    query: '',
    hitsPerPage: String(hitsPerPage),
    page: String(page),
  }).toString(),
})

export const extractRipplingIndiaJobsFromAlgoliaPayload = (
  payload,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => getAlgoliaHits(payload)
  .map((hit) => normalizeHit(hit, { scrapedAt }))
  .filter(Boolean)

export const createRipplingScraper = ({
  hitsPerPage = DEFAULT_HITS_PER_PAGE,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()
    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Rippling verified careers page no longer matches the known first-party jobs surface')
    }

    const { algoliaIndexName } = extractOpenRolesSearchConfig(await fetchText(OPEN_ROLES_URL, { signal }))
    signal?.throwIfAborted()
    const scrapedAt = now()
    const jobs = []
    const seenKeys = new Set()
    let page = 0
    let totalPages = 1

    while (page < totalPages) {
      signal?.throwIfAborted()
      const payload = await fetchJson(buildAlgoliaQueryUrl(algoliaIndexName), {
        method: 'POST',
        body: JSON.stringify(buildAlgoliaQueryBody({ page, hitsPerPage })),
        signal,
      })
      signal?.throwIfAborted()

      totalPages = Number(payload?.nbPages) > 0 ? Number(payload.nbPages) : 1

      for (const job of extractRipplingIndiaJobsFromAlgoliaPayload(payload, { scrapedAt })) {
        const key = `${job.jobId}::${job.location}`
        if (seenKeys.has(key)) continue
        seenKeys.add(key)
        jobs.push(job)
      }

      page += 1
    }

    // Capture native descriptions before the runner measures detail health.
    // Search hits supply identity/location only; they do not contain role HTML.
    let nextJob = 0
    const detailPages = new Map()
    await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
      while (nextJob < jobs.length) {
        signal?.throwIfAborted()
        const job = jobs[nextJob++]
        job.sourceDetailComplete = false
        job.sourceDetailFailureKind = 'unverified-native-role'
        const url = new URL(job.sourceUrl)
        if (url.protocol !== 'https:' || url.host !== 'ats.rippling.com' || url.username || url.password
          || url.pathname !== `/rippling/jobs/${encodeURIComponent(job.jobId)}`) continue
        try {
          if (!detailPages.has(job.sourceUrl)) detailPages.set(job.sourceUrl,
            Promise.resolve().then(() => fetchText(job.sourceUrl, { signal, includeResponseMetadata: true })))
          const page = await detailPages.get(job.sourceUrl)
          signal?.throwIfAborted()
          const recovered = page && page.status >= 200 && page.status < 300 && isExactPublicJobUrl(job.sourceUrl, page.url)
            ? ripplingPostingDescription(job, readNativeDocument(page.html), page.url) : null
          if (recovered) {
            job.sourceDescription = recovered.description
            job.jobDescription = recovered.description
            job.sourceDetailComplete = true
            job.publicExperienceChecked = true
            delete job.sourceDetailFailureKind
          }
        } catch {
          signal?.throwIfAborted()
          job.sourceDetailFailureKind = 'upstream'
        }
      }
    }))
    return jobs
  },
})

export const run = async (options = {}) => createRipplingScraper(options).run(options)

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
