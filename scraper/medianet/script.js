import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { nativeMediaRole, nativeMediaText } from './nativeRoleObservations.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://careers.media.net/'

const CAREERS_HOST = new URL(CAREERS_URL).hostname
const COMPANY = 'Media.net'
const SOURCE = 'medianet'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const toSameHostUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    const url = new URL(normalized, baseUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return null
    return url.hostname === CAREERS_HOST ? url.toString() : null
  } catch {
    return null
  }
}

const getPathSegments = (value) => {
  try {
    return new URL(value).pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  } catch {
    return []
  }
}

const toRoleSlug = (value) => getPathSegments(value).at(-1) || null

const extractFirst = (pattern, value) => {
  const match = String(value ?? '').match(pattern)
  return match ? stripTags(match[1]) : null
}

const extractAnchorMatches = (html) => [...String(html ?? '').matchAll(
  /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
)]

const isActiveDepartmentLink = (href, text) => {
  const url = toSameHostUrl(href)
  if (!url) return false

  const countMatch = stripTags(text)?.match(/(\d+)\s+Positions?\b/i)
  if (!countMatch || Number(countMatch[1]) <= 0) return false

  return getPathSegments(url).length === 1
}

const findActiveDepartmentUrls = (html) => {
  const urls = []
  const seen = new Set()

  for (const [, href, text] of extractAnchorMatches(html)) {
    if (!isActiveDepartmentLink(href, text)) continue
    const url = toSameHostUrl(href)
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }

  return urls
}

const toDepartmentNameFromUrl = (departmentUrl) => {
  const [slug] = getPathSegments(departmentUrl)
  if (!slug) return null

  return slug
    .split('-')
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
    .join(' ')
}

const extractExperienceRequired = (value) => {
  const match = String(value ?? '').match(
    /(\d+\+?\s+years?[^.]*experience|\d+\s+to\s+\d+\s+years?[^.]*experience)/i,
  )

  return match ? normalizeWhitespace(match[1]) : null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /media\.net/i.test(page)
    && /open positions/i.test(page)
    && findActiveDepartmentUrls(html).length > 0
}

export const extractDepartmentUrls = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Expected verified Media.net careers surface with public opportunities')
  }

  return findActiveDepartmentUrls(html)
}

export const extractListings = (html, { departmentUrl } = {}) => {
  const resolvedDepartmentUrl = toSameHostUrl(departmentUrl) || CAREERS_URL
  const [departmentSlug] = getPathSegments(resolvedDepartmentUrl)
  const department = extractFirst(/Current Openings for\s*([^<]+)/i, html)
    || extractFirst(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i, html)
    || toDepartmentNameFromUrl(resolvedDepartmentUrl)

  const jobs = []
  const seen = new Set()

  for (const [, href, text] of extractAnchorMatches(html)) {
    const sourceUrl = toSameHostUrl(href, resolvedDepartmentUrl)
    if (!sourceUrl || seen.has(sourceUrl)) continue

    const pathSegments = getPathSegments(sourceUrl)
    if (pathSegments.length !== 2) continue
    if (departmentSlug && pathSegments[0] !== departmentSlug) continue

    const title = nativeMediaText(text) || null
    const roleSlug = toRoleSlug(sourceUrl)
    if (!title || !roleSlug) continue

    seen.add(sourceUrl)
    jobs.push({
      title,
      company: COMPANY,
      department,
      location: null,
      city: null,
      country: null,
      jobId: null,
      requisitionId: null,
      nativeObservationKey: sourceUrl,
      nativeObservationKeyKind: 'published-role-URL-not-a-posting-id',
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    })
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const role = nativeMediaRole(html)
  if (listing.title && normalizeWhitespace(role.title) !== normalizeWhitespace(listing.title)) throw new Error('Media.net native listing/detail title mismatch')

  return {
    title: role.title,
    company: COMPANY,
    department: listing.department || toDepartmentNameFromUrl(listing.sourceUrl) || null,
    sourceUrl: listing.sourceUrl || null,
    jobId: null,
    requisitionId: null,
    nativePostingID: null,
    nativeObservationKey: listing.sourceUrl || null,
    nativeObservationKeyKind: 'published-role-URL-not-a-posting-id',
    postingDate: null,
    closingDate: null,
    location: role.location,
    nativeLocationLabel: role.location,
    city: role.city,
    country: role.country,
    applyUrl: listing.sourceUrl || listing.applyUrl || null,
    employmentType: role.employmentType,
    experienceRequired: extractExperienceRequired(role.description),
    minimumQualification: role.minimumQualification,
    preferredQualification: role.preferredQualification,
    requiredSkills: [],
    nativeRequirementItems: role.requirementItems,
    jobDescription: role.description,
    sourceDescription: role.description,
    nativeSourceRecord: role.record,
    nativeDescriptionWholeContainerRetained: true,
    remoteStatus: role.remoteStatus,
    sourceDetailComplete: false,
    sourceDetailStatus: 'unqualified-native-observation',
    sourceDetailFailureKind: 'current-role-country-employer-and-closing-proof-unqualified',
    sourceCountryScopeUnresolved: role.countryUnresolved,
    nativeCanonicalRoleURL: null,
    nativePublishedRoleURL: listing.sourceUrl || null,
    nativePublishedApplyURL: null,
    applicationLinkIsPublicRolePage: true,
    applicationVisited: false,
    applicationFormSubmitted: false,
    activeApplyVerified: false,
    nativeApplicationsOpen: null,
    sourceScopeComplete: false,
    sourceListingComplete: false,
    lifecycleCleanupAllowed: false,
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  attempts: 1,
  headers: {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMediaNetScraper = ({ now = () => new Date().toISOString(), maxJobs: factoryCap = Infinity } = {}) => ({
  async run(options = {}) {
    const { fetchText = defaultFetchText, now: overrideNow, signal } = options
    signal?.throwIfAborted()
    const cap = Object.hasOwn(options, 'maxJobs') ? options.maxJobs ?? Infinity : factoryCap ?? Infinity
    if (!(cap === Infinity || Number.isSafeInteger(cap) && cap >= 0)) throw new RangeError('Media.net invalid result cap')
    const finish = jobs => attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CAREERS_URL,
      firstParty: false, listingComplete: false, reportedTotal: null, indiaFacetCount: null,
      reason: 'Raw native observations only; current work-country, employer, closing and whole-company inventory remain unqualified' })
    if (cap === 0) return finish([])
    const get = async url => {
      signal?.throwIfAborted()
      let listener
      const cancelled = new Promise((_, reject) => {
        listener = () => reject(signal.reason)
        signal?.addEventListener('abort', listener, { once: true })
      })
      try {
        const html = await Promise.race([Promise.resolve().then(() => {
          signal?.throwIfAborted()
          return fetchText(url, { signal })
        }), cancelled])
        signal?.throwIfAborted()
        if (typeof html !== 'string') throw new Error('Media.net observation callback must return original HTML text')
        return html
      } finally { signal?.removeEventListener('abort', listener) }
    }
    const rootHtml = await get(CAREERS_URL)
    const jobs = []
    const seenUrls = new Set()

    for (const departmentUrl of extractDepartmentUrls(rootHtml)) {
      const departmentHtml = await get(departmentUrl)

      for (const listing of extractListings(departmentHtml, { departmentUrl })) {
        if (seenUrls.has(listing.sourceUrl)) continue
        seenUrls.add(listing.sourceUrl)

        const detailHtml = await get(listing.sourceUrl)
        jobs.push(extractJobDetail(detailHtml, listing))
        if (jobs.length === cap) break
      }
      if (jobs.length === cap) break
    }

    signal?.throwIfAborted()
    const result = jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
    signal?.throwIfAborted()
    return finish(result)
  },
})

export const run = async (options = {}) => createMediaNetScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total Media.net jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
