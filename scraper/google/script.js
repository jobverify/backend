import path from 'path'
import { fileURLToPath } from 'url'

import { extractJobDetail } from '../../scraper-support/detailExtractors/index.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { loadNativePaginationDefaults, nativePaginationLimits, createNativePagination, readNativeWithSignal } from '../../scraper-support/utils/nativePagination.js'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)
const nativeDefaults = loadNativePaginationDefaults(currentDir)

export const COUNTRY_NAME = 'India'
export const BASE_URL = `https://www.google.com/about/careers/applications/jobs/results?location=${COUNTRY_NAME}`
export const GOOGLE_HOST = new URL(BASE_URL).hostname
export const GOOGLE_APPLICATIONS_BASE_URL = 'https://www.google.com/about/careers/applications/'
export const DEFAULT_DETAIL_CONCURRENCY = 8

const GOOGLE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const decodeHtmlEntities = (value = '') => String(value)
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripTags = (value = '') => String(value).replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value = '') => decodeHtmlEntities(stripTags(value))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractAttribute = (tag = '', attributeName) => {
  const match = String(tag).match(new RegExp(`${attributeName}\\s*=\\s*(['"])([\\s\\S]*?)\\1`, 'i'))
  return match ? decodeHtmlEntities(match[2]).trim() : null
}

const extractCity = (location) => {
  if (!location) return null
  const loc = location.trim()
  if (/remote/i.test(loc)) return 'Remote'
  return loc.split(',')[0].trim() || null
}

const extractJobId = (link) => {
  const match = link.match(/\/results\/(\d+)-/)
  return match ? match[1] : null
}

const toCanonicalLink = (href) => {
  try {
    const normalizedHref = decodeHtmlEntities(href).trim()
    const baseUrl = /^\.?\/?jobs\/results\//i.test(normalizedHref)
      ? GOOGLE_APPLICATIONS_BASE_URL
      : BASE_URL
    const url = new URL(normalizedHref, baseUrl)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.hostname === GOOGLE_HOST ? url.href.split('?')[0] : null
  } catch {
    return null
  }
}

const toAbsoluteUrl = (href, currentUrl = BASE_URL) => {
  try {
    const url = new URL(decodeHtmlEntities(href), currentUrl)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

const fetchGoogleText = (url, label, { signal } = {}) =>
  fetchTextWithRetry(url, {
    headers: GOOGLE_HEADERS,
    signal,
    attempts: config.retryAttempts,
    baseDelayMs: config.retryBaseDelayMs,
    timeoutMs: Math.max(config.jobListingTimeoutMs || 0, 30000),
    label,
  })

const defaultFetchText = (url, options) => fetchGoogleText(url, 'google-detail', options)

const extractTagBlock = (html, openingTagPattern, tagName) => {
  const source = String(html ?? '')
  const match = openingTagPattern.exec(source)
  if (!match) return null

  const startIndex = match.index
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi')
  tagPattern.lastIndex = startIndex

  let depth = 0
  let currentMatch
  while ((currentMatch = tagPattern.exec(source)) !== null) {
    if (currentMatch[0][1] === '/') {
      depth -= 1
      if (depth === 0) {
        return source.slice(startIndex, tagPattern.lastIndex)
      }
      continue
    }

    depth += 1
  }

  return null
}

const splitTopLevelListItems = (html) => {
  const source = String(html ?? '')
  const tags = /<\/?ul\b[^>]*>|<\/?li\b[^>]*>/gi
  const items = []
  let ulDepth = 0
  let liDepth = 0
  let itemStart = -1
  let match

  while ((match = tags.exec(source)) !== null) {
    const tag = match[0]
    const isClosing = tag[1] === '/'
    const isUl = /^<\/?ul\b/i.test(tag)

    if (isUl) {
      ulDepth += isClosing ? -1 : 1
      continue
    }

    if (!isClosing) {
      if (ulDepth === 1 && liDepth === 0) {
        itemStart = match.index
      }
      liDepth += 1
      continue
    }

    if (liDepth === 0) continue

    liDepth -= 1
    if (ulDepth === 1 && liDepth === 0 && itemStart >= 0) {
      items.push(source.slice(itemStart, tags.lastIndex))
      itemStart = -1
    }
  }

  return items
}

const extractTextByClass = (html, tagName, className) =>
  normalizeWhitespace(
    String(html ?? '').match(
      new RegExp(`<${tagName}\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'),
    )?.[1],
  ) || null

const pickFirstJobsResultsHref = (html) => {
  const source = String(html ?? '')
  const matches = source.matchAll(/<a\b[^>]*href=(['"])([^'"]*jobs\/results[^'"]*)\1[^>]*>/gi)
  for (const match of matches) {
    const href = decodeHtmlEntities(match[2]).trim()
    if (href) return href
  }

  return null
}

export const extractGoogleListingCards = (html, currentUrl = BASE_URL) => {
  const listBlock = extractTagBlock(
    html,
    /<ul\b[^>]*class=["'][^"']*\bspHGqe\b[^"']*["'][^>]*>/i,
    'ul',
  )
  if (!listBlock) return []

  return splitTopLevelListItems(listBlock)
    .map((cardHtml) => {
      const title = extractTextByClass(cardHtml, 'h3', 'QJPWVe')
      const company = normalizeWhitespace(
        cardHtml.match(/<span\b[^>]*class=["'][^"']*\bRP7SMd\b[^"']*["'][^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1],
      ) || 'Google'
      const location = extractTextByClass(cardHtml, 'span', 'r0wTof')
      const link = toCanonicalLink(pickFirstJobsResultsHref(cardHtml))

      if (!title || !link) return null

      return {
        title,
        company,
        location: location || 'Unknown',
        link,
        cardHtml,
      }
    })
    .filter(Boolean)
}

export const extractGoogleNextPageUrl = (html, currentUrl = BASE_URL) => {
  const anchorTag = String(html ?? '').match(/<a\b[^>]*aria-label=["']Go to next page["'][^>]*>/i)?.[0]
  const href = extractAttribute(anchorTag, 'href')
  return href ? toAbsoluteUrl(href, currentUrl) : null
}

const isNativeEmptyResultsPage = html => {
  const doc = readNativeDocument(html)
  const titles = activeHead(html).titles
  return titles.length === 1 && titles[0] === 'Search Jobs — Google Careers'
    && doc.nodes(node => node.tag === 'h2' && doc.hasClass(node, 'r4nke') && doc.text(node) === 'No results').length === 1
    && doc.nodes(node => node.tag === 'span' && doc.hasClass(node, 'ij8cu')
      && doc.text(node) === 'Search again or try updating your filters').length === 1
}

const mergeJobDetail = (primary = {}, fallback = {}) => ({
  jobDescription: primary.jobDescription || fallback.jobDescription || null,
  minimumQualification: primary.minimumQualification || fallback.minimumQualification || null,
  preferredQualification: primary.preferredQualification || fallback.preferredQualification || null,
  requiredSkills: Array.isArray(primary.requiredSkills) && primary.requiredSkills.length > 0
    ? primary.requiredSkills
    : Array.isArray(fallback.requiredSkills)
      ? fallback.requiredSkills
      : [],
  experienceRequired: primary.experienceRequired || fallback.experienceRequired || null,
  publicExperienceChecked: Boolean(primary.publicExperienceChecked || fallback.publicExperienceChecked),
  postingDate: primary.postingDate || fallback.postingDate || null,
  department: primary.department || fallback.department || null,
  requisitionId: primary.requisitionId || fallback.requisitionId || null,
})

export const createGoogleScraper = ({
  detailConcurrency = DEFAULT_DETAIL_CONCURRENCY,
} = {}) => ({
  async run({
    fetchListingsText = (url, options) => fetchGoogleText(url, 'google-listings', options),
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
    signal,
    detailEnrichmentBudgetMs = 45000,
    maxPages,
    maxJobs,
    collectionBudgetMs,
  } = {}) {
    signal?.throwIfAborted()
    const limits = nativePaginationLimits({ maxPages, maxJobs }, nativeDefaults)
    const pagination = createNativePagination({ surface: BASE_URL, limits, signal, collectionBudgetMs })
    const detailBudgetMs = Number.isFinite(Number(detailEnrichmentBudgetMs))
      ? Math.max(0, Math.floor(Number(detailEnrichmentBudgetMs)))
      : 45000
    let detailBudgetSignal
    let detailSignal
    let currentUrl = BASE_URL

    const allJobs = []
    const completedPageJobs = []
    return pagination.run(allJobs, async () => {
      try {
        const seenLinks = new Set()
        let pageNum = 1

        while (currentUrl && pageNum <= limits.maxPages) {
          signal?.throwIfAborted()
          const html = await readNativeWithSignal(() => fetchListingsText(currentUrl, { signal: pagination.signal }), pagination.signal)
          signal?.throwIfAborted()
          console.log(`  [google] Scraping page ${pageNum} - ${currentUrl}`)

          const jobs = extractGoogleListingCards(html, currentUrl)
          if (jobs.length === 0) {
            // An advertised next page can become empty when the live inventory
            // changes. Preserve prior roles without certifying an employer zero
            // or a complete inventory (nativePagination retains discovery scope).
            if (isNativeEmptyResultsPage(html)) return pagination.finish(allJobs, { exhausted: true })
            throw new Error(`Google job list not found at: ${currentUrl}`)
          }

          console.log(`  [google] Found ${jobs.length} jobs on page ${pageNum}`)
          if (!pagination.page(jobs.map(job => job.link))) return pagination.finish(allJobs, { reason: 'native-pagination-no-progress' })

          const freshJobs = []
          for (const job of jobs) {
            if (seenLinks.has(job.link)) continue
            seenLinks.add(job.link)
            freshJobs.push(job)
          }

          const pageJobs = await mapWithConcurrency(
            freshJobs.slice(0, Math.max(0, limits.maxJobs - allJobs.length)),
            detailConcurrency,
            async (job, index) => {
              signal?.throwIfAborted()
              const fallbackDetail = await extractJobDetail({
                provider: 'google',
                html: job.cardHtml,
              })

              const fetchedDetail = await (async () => {
                signal?.throwIfAborted()
                if (detailBudgetMs === 0 || detailBudgetSignal?.aborted) return null
                if (!detailBudgetSignal) {
                  detailBudgetSignal = AbortSignal.timeout(detailBudgetMs)
                  detailSignal = AbortSignal.any([pagination.signal, detailBudgetSignal])
                }
                const detailHtml = await readNativeWithSignal(() => fetchText(job.link, { signal: detailSignal }), detailSignal)
                signal?.throwIfAborted()
                return extractJobDetail({
                  provider: 'google',
                  html: detailHtml,
                })
              })().catch(() => {
                signal?.throwIfAborted()
                pagination.throwIfAborted()
                return null
              })

              const detail = mergeJobDetail(fetchedDetail || {}, fallbackDetail)

              const completed = {
                jobId: extractJobId(job.link),
                title: job.title,
                company: job.company,
                department: detail.department,
                location: job.location,
                city: extractCity(job.location),
                country: COUNTRY_NAME,
                sourceUrl: job.link,
                applyUrl: job.link,
                link: job.link,
                source: 'google',
                jobDescription: detail.jobDescription,
                minimumQualification: detail.minimumQualification,
                preferredQualification: detail.preferredQualification,
                requiredSkills: detail.requiredSkills,
                experienceRequired: detail.experienceRequired,
                publicExperienceChecked: detail.publicExperienceChecked,
                scrapedAt: now(),
              }
              pagination.throwIfAborted()
              completedPageJobs[index] = completed
              return completed
            },
          )

          allJobs.push(...pageJobs)
          completedPageJobs.length = 0
          if (allJobs.length >= limits.maxJobs) return pagination.finish(allJobs)

          const nextUrl = extractGoogleNextPageUrl(html, currentUrl)
          if (!nextUrl) return pagination.finish(allJobs, { exhausted: true })
          if (nextUrl === currentUrl) return pagination.finish(allJobs, { reason: 'native-pagination-repeat-continuation' })

          currentUrl = nextUrl
          pageNum += 1
        }

        signal?.throwIfAborted()
        return pagination.finish(allJobs)
      } catch (err) {
        signal?.throwIfAborted()
        pagination.throwIfAborted()
        throw new Error(`[google] Scraping failed at ${currentUrl} - ${err.message}`)
      }
    }, { flushCompleted: () => allJobs.push(...completedPageJobs.filter(Boolean)) })
  },
})

/**
 * Scrapes India-based job listings from Google Careers.
 * @returns {Promise<object[]>} Array of normalised job objects
 */
export const run = async (options = {}) => createGoogleScraper(options).run(options)

// Standalone: node scraper/google/script.js [--dry-run]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Google scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'google')
    console.log('DB result:', result)
    process.exit(0)
  }
}
