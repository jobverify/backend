import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { HEXAVIEW_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_LISTING_URL = PROVIDER_METADATA.jobListingUrl

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal, attempts: 1,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripScriptsAndStyles = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const stripTags = (value) => normalizeWhitespace(stripScriptsAndStyles(value).replace(/<[^>]+>/g, ' '))

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const formatLocation = (locations) => {
  const label = locations.join('/')
  return label ? `${label}, India` : 'India'
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^full\s*time$/i.test(normalized) || /^fulltime$/i.test(normalized)) return 'Full-time'
  return normalized
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
}

const extractTags = (block = '') => Array.from(
  block.matchAll(/<div[^>]*class="job-list-gray-tag[^"]*"[^>]*>([\s\S]*?)<\/div>/gi),
  (match) => normalizeWhitespace(match[1]),
).filter(Boolean)

const extractDescription = (block = '') => {
  const match = block.match(/<div[^>]*class="job-body-rich-text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i)
  if (!match) return null
  return stripTags(match[1])
}

const extractDepartment = (block = '') => {
  const match = block.match(/fs-cmsfilter-field="category"[^>]*>([\s\S]*?)<\/div>/i)
  return normalizeWhitespace(match?.[1] ?? null)
}

const toAbsoluteUrl = (value, baseUrl = JOB_LISTING_URL) => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value, baseUrl)
    if (url.protocol !== 'https:' || url.origin !== new URL(JOB_LISTING_URL).origin
      || url.username || url.password || url.hash) return null
    return url.toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersLandingSignal = (html = '') => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Join Team of Innovators')
    && normalized.includes('Build the Best Work of Your Life')
    && /\/job-listing\b/i.test(String(html ?? ''))
}

export const hasOfficialJobListingSignal = (html = '') => {
  const normalized = stripTags(html) || ''

  return normalized.includes('Job Openings')
    && normalized.includes('Hexaview Technologies')
    && /job-openings\//i.test(String(html ?? ''))
    && normalized.includes('Apply Now')
}

export const extractNextPagePath = (html = '') => {
  const match = String(html ?? '').match(/<a[^>]+href="([^"]+)"[^>]*(?:aria-label="Next Page"|fs-cmsload-mode="load-under")[^>]*>/i)
  return normalizeWhitespace(match?.[1] ?? null)
}

const extractJobCards = (html = '') => {
  const cards = []
  const pattern = /<div role="listitem" class="job-list-item w-dyn-item">([\s\S]*?)<\/div>\s*<div class="job-category-hide w-dyn-list">([\s\S]*?)<\/div>\s*<\/div>/gi

  for (const match of html.matchAll(pattern)) {
    const body = match[1]
    const categoryMarkup = match[2]
    const title = normalizeWhitespace(body.match(/<h2[^>]*fs-cmsfilter-field="name"[^>]*>([\s\S]*?)<\/h2>/i)?.[1])
    const company = normalizeWhitespace(body.match(/<div[^>]*class="job-company-name"[^>]*>([\s\S]*?)<\/div>/i)?.[1])
    const locationText = normalizeWhitespace(body.match(/<div[^>]*class="job-location"[^>]*>([\s\S]*?)<\/div>/i)?.[1])
    // Button styling is not a role identity. The employer changed this class
    // to button-primary; new URL(undefined, base) previously became /undefined.
    const applyUrls = [...new Set(Array.from(body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi), (anchor) => {
      if (stripTags(anchor[2]) !== 'Apply Now') return null
      const url = toAbsoluteUrl(anchor[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1])
      return url && /^\/job-openings\/[a-z0-9-]+\/?$/i.test(new URL(url).pathname) ? url : null
    }).filter(Boolean))]
    if (title && company && applyUrls.length !== 1) throw new Error('HexaView role is missing one verified native Apply Now link')
    const applyUrl = applyUrls[0]
    const tags = extractTags(body)
    const locations = (locationText || '')
      .split('/')
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean)

    if (!title || !company || !applyUrl || locations.length === 0) continue

    cards.push({
      title,
      department: extractDepartment(categoryMarkup),
      company,
      location: formatLocation(locations),
      city: locations[0],
      locations,
      employmentType: normalizeEmploymentType(tags.find((tag) => /full\s*time|fulltime/i.test(tag))),
      remoteStatus: normalizeRemoteStatus(tags.find((tag) => /hybrid|remote|on-site|onsite/i.test(tag))),
      applyUrl,
      sourceUrl: applyUrl,
      requisitionId: applyUrl.split('/').filter(Boolean).at(-1) ?? null,
      jobDescription: extractDescription(body),
    })
  }

  return cards
}

const attribute = (tag, name) => tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null

// Balanced div boundaries keep the main CMS body separate from recommendation
// cards, which reuse the same rich-text class elsewhere on the native page.
const divBlocks = (html, classes) => {
  const stack = [], blocks = []
  for (const match of html.matchAll(/<\/?div\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)) {
    if (/^<\/div/i.test(match[0])) {
      const open = stack.pop()
      if (open?.matches) blocks.push({ start: open.start, inner: html.slice(open.innerStart, match.index) })
    } else {
      const tokens = (attribute(match[0], 'class') || '').split(/\s+/)
      stack.push({ start: match.index, innerStart: match.index + match[0].length,
        matches: classes.every(name => tokens.includes(name)) })
    }
  }
  return blocks
}

export const extractNativeRoleDescription = (html, job) => {
  if (typeof html !== 'string' || html.length > 1500000 || !job.title || !job.locations?.length
    || normalizeWhitespace(job.company)?.toLowerCase() !== COMPANY.toLowerCase()) return null
  const url = toAbsoluteUrl(job.applyUrl)
  if (!url || url !== job.sourceUrl || new URL(url).search
    || !/^\/job-openings\/[a-z0-9-]+$/.test(new URL(url).pathname)) return null
  const page = stripScriptsAndStyles(html).replace(/<!--[\s\S]*?-->/g, '')
  const root = page.match(/<html\b[^>]*>/i)?.[0]
  if (attribute(root || '', 'data-wf-domain') !== 'www.hexaviewtech.com'
    || attribute(root || '', 'data-wf-item-slug') !== job.requisitionId
    || new URL(url).pathname !== `/job-openings/${job.requisitionId}`) return null
  const canonicals = [...page.matchAll(/<link\b[^>]*>/gi)].filter(match => attribute(match[0], 'rel') === 'canonical')
  if (canonicals.length !== 1 || attribute(canonicals[0][0], 'href') !== url) return null
  const primary = divBlocks(page, ['job-list-body', 'block'])
  if (primary.length !== 1) return null
  const bodies = divBlocks(primary[0].inner, ['job-body-rich-text', 'w-richtext'])
  if (bodies.length !== 1) return null
  const explicitTitles = [...primary[0].inner.matchAll(/<(h[1-6]|div|span)\b([^>]*(?:fs-cmsfilter-field=["']name["']|class=["'][^"']*\bjob-title\b[^"']*["'])[^>]*)>([\s\S]*?)<\/\1>/gi)]
  if (explicitTitles.some(match => stripTags(match[3]) !== job.title)) return null
  const explicitCompany = primary[0].inner.match(/<div\b[^>]*class=["']job-company-name["'][^>]*>([\s\S]*?)<\/div>/i)
  if (explicitCompany && stripTags(explicitCompany[1])?.toLowerCase() !== COMPANY.toLowerCase()) return null
  const explicitLocation = primary[0].inner.match(/<div\b[^>]*class=["']job-location["'][^>]*>([\s\S]*?)<\/div>/i)
  if (explicitLocation && stripTags(explicitLocation[1]) !== job.locations.join('/')) return null
  const description = bodies[0].inner.replace(/<br\s*\/?>|<\/(?:p|div|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ').split(/\r?\n/).map(stripTags)
    .filter(line => line && !/^[\u200b-\u200d\ufeff]+$/.test(line)).join('\n\n')
  if (description.length < 100) return null
  const broaderDotnetTitle = /senior\s+\.net\s+developer/i.test(job.title) && /Senior Software Engineer/.test(description)
  if (broaderDotnetTitle) {
    const requirements = description.split(/Requirements:/i)[1] || ''
    if (!/\.NET Core/i.test(requirements) || !/SQL Server/i.test(requirements) || !/Angular/i.test(requirements)) return null
  }
  return { jobDescription: description, sourceDescription: description, sourceDetailComplete: true,
    sourceDetailUrl: url, nativeDescriptionSHA256: createHash('sha256').update(bodies[0].inner).digest('hex'),
    ...(broaderDotnetTitle ? { sourceDetailNativeCopyCaveat: 'broader-narrative-title' } : {}) }
}

const defaultFetchDetail = (url, { signal }) => fetchTextWithRetry(url, {
  signal, attempts: 1, timeoutMs: 10000, redirect: 'manual', includeResponseMetadata: true,
  headers: { 'User-Agent': USER_AGENT },
})

export const createHexaViewTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchDetail = defaultFetchDetail,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const landingHtml = await fetchText(CAREERS_URL, { signal })
    if (!hasOfficialCareersLandingSignal(landingHtml)) {
      throw new Error('The verified HexaView careers landing page no longer matches the trusted first-party surface')
    }

    const visited = new Set()
    const queued = [JOB_LISTING_URL]
    const jobs = []

    while (queued.length > 0) {
      const pageUrl = queued.shift()
      if (!pageUrl || visited.has(pageUrl)) continue
      visited.add(pageUrl)

      const html = await fetchText(pageUrl, { signal })
      if (!hasOfficialJobListingSignal(html)) {
        throw new Error(`The verified HexaView job listing surface changed unexpectedly at ${pageUrl}`)
      }

      jobs.push(...extractJobCards(html))

      const nextPagePath = extractNextPagePath(html)
      if (nextPagePath) {
        queued.push(toAbsoluteUrl(nextPagePath, pageUrl))
      }
    }

    const seen = new Set()

    const uniqueJobs = jobs.filter((job) => {
      const key = `${job.applyUrl}|${job.location}|${job.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const urlCounts = new Map()
    for (const job of uniqueJobs) urlCounts.set(job.applyUrl, (urlCounts.get(job.applyUrl) || 0) + 1)
    const budget = AbortSignal.timeout(45000), detailSignal = signal ? AbortSignal.any([signal, budget]) : budget
    let cursor = 0
    await Promise.all(Array.from({ length: Math.min(3, uniqueJobs.length) }, async () => {
      while (cursor < uniqueJobs.length) {
        const job = uniqueJobs[cursor++]
        let detail = null, failureKind = 'missing-authoritative-jobposting'
        if (job.company?.toLowerCase() === COMPANY.toLowerCase() && urlCounts.get(job.applyUrl) === 1) {
          if (job.jobDescription) detail = { sourceDescription: job.jobDescription, sourceDetailComplete: true, sourceDetailUrl: job.sourceUrl }
          else if (!detailSignal.aborted) {
            try {
              const requestSignal = AbortSignal.any([detailSignal, AbortSignal.timeout(10000)])
              const response = await fetchDetail(job.applyUrl, { signal: requestSignal })
              requestSignal.throwIfAborted()
              if (response?.status === 200 && response.url === job.applyUrl) detail = extractNativeRoleDescription(response.html, job)
              else failureKind = 'source-detail-access-failed'
            } catch { signal?.throwIfAborted(); failureKind = 'source-detail-access-failed' }
          }
        }
        job.detail = detail ? { ...detail, sourceDetailVerifiedAt: now() }
          : { sourceDescription: null, sourceDetailComplete: false, sourceDetailUrl: job.sourceUrl, sourceDetailFailureKind: failureKind }
      }
    }))
    signal?.throwIfAborted()
    return uniqueJobs.map((job) => ({
      title: job.title,
      company: COMPANY,
      department: job.department,
      location: job.location,
      locations: job.locations,
      city: job.city,
      country: 'India',
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      link: job.applyUrl,
      jobId: `${job.requisitionId}-${slugify(job.locations.join('-'))}`,
      requisitionId: job.requisitionId,
      employmentType: job.employmentType,
      remoteStatus: job.remoteStatus,
      jobDescription: job.jobDescription,
      postingDate: null,
      closingDate: null,
      ...job.detail,
      source: SOURCE,
      scrapedAt: now(),
      companyCareerPage: JOB_LISTING_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createHexaViewTechnologiesScraper(options).run(options)

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
