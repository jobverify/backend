import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_URL = 'https://jobs.egis-group.com/jobs'
export const INDIA_FILTER_OPTION_ID = '837'
export const COMPANY = 'Egis Group'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripTags = (value) => String(value ?? '')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, ' ')
  .replace(/<li\b[^>]*>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(stripTags(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const getCardStartIndexes = (html) => [...String(html ?? '').matchAll(/<div class="attrax-vacancy-tile\b/gi)]
  .map((match) => match.index)

const splitJobCards = (html) => {
  const pageHtml = String(html ?? '')
  const indexes = getCardStartIndexes(pageHtml)

  return indexes.map((start, index) => {
    const end = indexes[index + 1] ?? pageHtml.length
    return pageHtml.slice(start, end)
  })
}

const extractTileValue = (cardHtml, classFragment) => {
  const match = new RegExp(
    `<div class="[^"]*${classFragment}[^"]*"[^>]*>[\\s\\S]*?<p class="[^"]*attrax-vacancy-tile__item-value[^"]*">([\\s\\S]*?)<\\/p>`,
    'i',
  ).exec(cardHtml)

  return normalizeWhitespace(match?.[1])
}

const extractTitleAndUrl = (cardHtml) => {
  const match = /<a[^>]*class="[^"]*attrax-vacancy-tile__title[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(cardHtml)
  return {
    sourceUrl: toAbsoluteUrl(match?.[1]),
    title: normalizeWhitespace(match?.[2]),
  }
}

const extractJobId = (cardHtml, sourceUrl) =>
  /data-jobid="(\d+)"/i.exec(cardHtml)?.[1]
  || /jid-(\d+)/i.exec(sourceUrl ?? '')?.[1]
  || null

const extractReferenceId = (cardHtml) =>
  extractTileValue(cardHtml, 'attrax-vacancy-tile__reference')
    || extractJobId(cardHtml, null)

const isIndiaCard = (cardHtml) => /attrax-vacancy-tile--india\b/i.test(cardHtml)
  || /\b(Bengaluru|Gurugram|Mumbai|New Delhi|Chennai|Kolkata|Surat)\b/i.test(cardHtml)

const hasOfficialSearchPageShape = (html) => /Job results \| Egis/i.test(html)
  && /attrax-vacancy-tile/i.test(html)

const hasOfficialDetailPageShape = (html) => /\| Egis/i.test(html)
  && /jobApplyBtn/i.test(html)

const extractDescriptionWidgetHtml = (html) => {
  const pageHtml = String(html ?? '')
  const markerIndex = pageHtml.indexOf('description-widget')
  if (markerIndex === -1) return null

  const start = pageHtml.lastIndexOf('<div', markerIndex)
  const tail = pageHtml.slice(start === -1 ? markerIndex : start)
  const nextWidgetIndex = tail.indexOf('<div class="cop-widget dynamic-widget', 1)
  return nextWidgetIndex === -1 ? tail : tail.slice(0, nextWidgetIndex)
}

const normalizeClosingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || normalized === '01/01/0001') return null
  return normalized
}

export const buildIndiaSearchPageUrl = (page = 1) => {
  const normalizedPage = Math.max(1, Number(page) || 1)
  return `${CAREERS_URL}?options=${INDIA_FILTER_OPTION_ID}&page=${normalizedPage}`
}

export const extractTotalPages = (html) => {
  const pageNumbers = [...String(html ?? '').matchAll(/pagination\((\d+)\)/g)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite)

  if (!pageNumbers.length) {
    return splitJobCards(html).length ? 1 : 0
  }

  return Math.max(...pageNumbers)
}

export const extractSearchResults = (html) => splitJobCards(html)
  .filter((cardHtml) => isIndiaCard(cardHtml))
  .map((cardHtml) => {
    const { title, sourceUrl } = extractTitleAndUrl(cardHtml)
    const city = extractTileValue(cardHtml, 'attrax-vacancy-tile__option-location')
      || extractTileValue(cardHtml, 'attrax-vacancy-tile__location-freetext')
    const jobId = extractJobId(cardHtml, sourceUrl)
    const requisitionId = extractReferenceId(cardHtml)

    if (!title || !sourceUrl || !city || !jobId) return null

    return {
      title,
      company: COMPANY,
      department: extractTileValue(cardHtml, 'attrax-vacancy-tile__option-job-family'),
      location: `${city}, India`,
      city,
      country: 'India',
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: extractTileValue(cardHtml, 'attrax-vacancy-tile__option-type-of-contract'),
      experienceRequired: extractTileValue(cardHtml, 'attrax-vacancy-tile__option-experience-level'),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: normalizeClosingDate(extractTileValue(cardHtml, 'attrax-vacancy-tile__expiry')),
      jobDescription: extractTileValue(cardHtml, 'attrax-vacancy-tile__description'),
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const applyUrl = toAbsoluteUrl(
    /<a[^>]*class="[^"]*jobApplyBtn[^"]*"[^>]*href="([^"]+)"/i.exec(html)?.[1],
  ) || listing.applyUrl

  const minimumQualification = normalizeWhitespace(
    /jobad-qualifications[\s\S]*?<li>([\s\S]*?)<\/li>/i.exec(html)?.[1],
  ) || listing.minimumQualification || null

  const descriptionWidgetHtml = extractDescriptionWidgetHtml(html)
  const jobDescription = normalizeWhitespace(descriptionWidgetHtml) || listing.jobDescription || null

  return {
    ...listing,
    applyUrl,
    minimumQualification,
    jobDescription,
  }
}

const defaultFetchText = async (url) => fetchTextWithRetry(url, {
  label: 'egis fetch',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
})

export const createEgisScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run() {
    const firstPageHtml = await fetchText(buildIndiaSearchPageUrl(1))
    if (!hasOfficialSearchPageShape(firstPageHtml)) {
      throw new Error('Response is not the official Egis India jobs page')
    }

    const totalPages = extractTotalPages(firstPageHtml)
    const pageLimit = Math.min(totalPages || 1, maxPages)
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= pageLimit; page += 1) {
      const pageHtml = page === 1
        ? firstPageHtml
        : await fetchText(buildIndiaSearchPageUrl(page))
      const listings = extractSearchResults(pageHtml)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        let job = listing

        try {
          const detailHtml = await fetchText(listing.sourceUrl)
          if (hasOfficialDetailPageShape(detailHtml)) {
            job = extractJobDetail(detailHtml, listing)
          }
        } catch {
          job = listing
        }

        jobs.push({
          ...job,
          source: 'egis',
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }
    }

    return jobs
  },
})

export const run = async () => createEgisScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Egis scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'egis')
    console.log('DB result:', result)
    process.exit(0)
  }
}
