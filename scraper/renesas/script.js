import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'renesas'
export const COMPANY = 'Renesas Electronics'
export const VERIFIED_AT = '2026-07-25'
export const INDIA_JOBS_URL = 'https://jobs.renesas.com/Jobs?options=659&page='
export const INDIA_CAREERS_URL = 'https://jobs.renesas.com/india'
export const BASE_URL = 'https://jobs.renesas.com'

const DEFAULT_DETAIL_CONCURRENCY = 4
const MAX_DETAIL_CONCURRENCY = 8
const MAX_LISTING_PAGES = 100
const INCOMPLETE_DESCRIPTION_PATTERN = /^(?:no\s+)?(?:job\s+)?description(?:\s+is)?\s+(?:currently\s+)?(?:unavailable|not available|coming soon|available soon|pending|to be (?:added|provided|updated))[\s.!]*$/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (entity, code) => {
    const codePoint = Number.parseInt(code, 10)
    return Number.isInteger(codePoint) && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity
  })
  .replace(/&#x([0-9a-f]+);/gi, (entity, code) => {
    const codePoint = Number.parseInt(code, 16)
    return Number.isInteger(codePoint) && codePoint <= 0x10ffff
      ? String.fromCodePoint(codePoint)
      : entity
  })
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#xA0;|&#160;|&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim()

const htmlToParagraphText = (value) => {
  const text = decodeHtmlEntities(
    String(value ?? '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/\s+/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<\/li>/gi, '')
      .replace(/<\/(?:p|div|h[1-6])>/gi, '\n\n')
      .replace(/<(?:p|div|h[1-6])\b[^>]*>/gi, '')
      .replace(/<\/?(?:ul|ol)\b[^>]*>/gi, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return text || null
}

const extractJobDescriptionHtml = (html = '') => {
  const rawHtml = String(html ?? '')
  const openingTag = /<div\b[^>]*\baria-label\s*=\s*["']Job description["'][^>]*>/i.exec(rawHtml)
  if (!openingTag) return null

  const contentStart = openingTag.index + openingTag[0].length
  const divTags = /<\/?div\b[^>]*>/gi
  divTags.lastIndex = contentStart
  let depth = 1

  for (let tag = divTags.exec(rawHtml); tag; tag = divTags.exec(rawHtml)) {
    if (/^<\/div/i.test(tag[0])) {
      depth -= 1
      if (depth === 0) return rawHtml.slice(contentStart, tag.index)
    } else if (!/\/>$/.test(tag[0])) {
      depth += 1
    }
  }

  return null
}

const mapWithConcurrency = async (items, concurrency, mapper) => {
  const parsedConcurrency = Number.parseInt(concurrency, 10)
  const limit = Math.min(
    MAX_DETAIL_CONCURRENCY,
    Math.max(1, Number.isInteger(parsedConcurrency) ? parsedConcurrency : DEFAULT_DETAIL_CONCURRENCY),
  )
  const results = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )

  return results
}

const match = (value, pattern) => value.match(pattern)?.[1] || ''

const field = (card, name) => stripTags(match(
  card,
  new RegExp(
    `attrax-vacancy-tile__option-${name}(?:-valueset)?[\\s\\S]*?attrax-vacancy-tile__item-value[^>]*>([\\s\\S]*?)<`,
    'i',
  ),
))

const extractDescription = (card) => stripTags(match(
  card,
  /attrax-vacancy-tile__description-value[^>]*>([\s\S]*?)(?:<\/p>|<\/div>)/i,
))

const inferExperienceFromDescription = (description) => {
  const normalizedDescription = stripTags(description)
  if (!normalizedDescription) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalizedDescription,
  })?.experienceProfile
  const evidence = stripTags(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

export const extractRenesasJobs = (html = '') => {
  const cards = String(html).match(
    /<div\s+class=["'][^"']*\battrax-vacancy-tile\b[^"']*["'][\s\S]*?(?=<div\s+class=["'][^"']*\battrax-vacancy-tile\b|$)/gi,
  ) || []

  return cards.map((card) => {
    const title = stripTags(match(
      card,
      /attrax-vacancy-tile__title[^>]*href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/i,
    ))
    const link = match(card, /attrax-vacancy-tile__title[^>]*href=["']([^"']+)["']/i)
    const location = stripTags(match(
      card,
      /attrax-vacancy-tile__location-freetext[\s\S]*?attrax-vacancy-tile__item-value[^>]*>([\s\S]*?)<\/p>/i,
    ))
    const description = extractDescription(card)
    const jobId = match(card, /data-jobid=["']([^"']+)["']/i)

    if (!title || !link || !location || !/\bindia\b/i.test(location)) return null

    const sourceUrl = new URL(link, BASE_URL).toString()
    return {
      title,
      company: COMPANY,
      location,
      city: field(card, 'location') || location.split(',')[0]?.trim() || null,
      country: 'India',
      link: sourceUrl,
      sourceUrl,
      applyUrl: sourceUrl,
      jobId: jobId || null,
      requisitionId: jobId || null,
      department: field(card, 'function') || null,
      employmentType: field(card, 'type-of-employment') || null,
      remoteStatus: field(card, 'remote') || null,
      jobDescription: description || null,
      experienceRequired: inferExperienceFromDescription(description),
      publicExperienceChecked: false,
      source: SOURCE,
    }
  }).filter(Boolean)
}

export const extractRenesasJobDetail = (html = '') => {
  const descriptionHtml = extractJobDescriptionHtml(html)
  const description = htmlToParagraphText(descriptionHtml)
  const descriptionBody = description
    ?.replace(/^job description\s*:?\s*/i, '')
    .trim()

  if (
    !description
    || !descriptionBody
    || !/^job description\b/i.test(description)
    || INCOMPLETE_DESCRIPTION_PATTERN.test(descriptionBody)
  ) {
    return null
  }

  return {
    jobDescription: description,
    experienceRequired: inferExperienceFromDescription(description),
    publicExperienceChecked: true,
  }
}

const getTotalResults = (html) => Number.parseInt(
  match(html, /(\d+)\s+result\(s\)/i),
  10,
)

export const createRenesasScraper = ({
  detailConcurrency = DEFAULT_DETAIL_CONCURRENCY,
  now = () => new Date().toISOString(),
  onDetailError = (error, job) => {
    console.warn(`[renesas] retaining listing without description after detail fetch failed for ${job.sourceUrl}: ${error.message}`)
  },
} = {}) => ({
  async run({
    fetchText = (url, options = {}) => fetchTextWithRetry(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
      },
      label: SOURCE,
      timeoutMs: 25000,
      ...options,
    }),
  } = {}) {
    const firstPage = await fetchText(`${INDIA_JOBS_URL}1`)
    const totalResults = getTotalResults(firstPage)
    const firstPageJobs = extractRenesasJobs(firstPage)

    if (!Number.isFinite(totalResults) || totalResults < 0 || firstPageJobs.length === 0) {
      throw new Error('[renesas] official India jobs page did not contain a recognizable result set')
    }

    const pageSize = firstPageJobs.length
    const pageCount = Math.ceil(totalResults / pageSize)
    if (pageCount > MAX_LISTING_PAGES) {
      throw new Error(`[renesas] official India jobs page reported ${pageCount} pages, above the safety limit of ${MAX_LISTING_PAGES}`)
    }
    const pages = [firstPageJobs]

    for (let page = 2; page <= pageCount; page += 1) {
      const jobs = extractRenesasJobs(await fetchText(`${INDIA_JOBS_URL}${page}`))
      if (jobs.length === 0) {
        throw new Error(`[renesas] official India jobs page ${page} did not contain recognizable job cards`)
      }
      pages.push(jobs)
    }

    const seen = new Set()
    const uniqueJobs = pages.flat().filter((job) => {
      const identity = String(job.jobId || job.sourceUrl)
      if (seen.has(identity)) return false
      seen.add(identity)
      return true
    })

    return mapWithConcurrency(uniqueJobs, detailConcurrency, async (job) => {
      try {
        const detailHtml = await fetchText(job.sourceUrl)
        const detail = extractRenesasJobDetail(detailHtml)
        if (!detail) {
          throw new Error('official detail page did not contain a recognizable complete job description')
        }
        const sourceCheckedAt = now()

        return {
          ...job,
          ...detail,
          scrapedAt: sourceCheckedAt,
          scrapedTimestamp: sourceCheckedAt,
        }
      } catch (error) {
        const sourceCheckedAt = now()
        try {
          onDetailError(error, job)
        } catch {
          // Reporting a detail failure must not discard an otherwise valid listing.
        }
        return {
          ...job,
          jobDescription: null,
          experienceRequired: null,
          publicExperienceChecked: false,
          preserveExistingSourceContent: true,
          scrapedAt: sourceCheckedAt,
          scrapedTimestamp: sourceCheckedAt,
        }
      }
    })
  },
})

export const run = (options = {}) => createRenesasScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
