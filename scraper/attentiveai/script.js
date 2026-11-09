import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.ibeam.ai/careers'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtml = (value) => normalizeWhitespace(value)

const extractTextMatches = (html, pattern) => {
  const matches = []
  for (const match of String(html ?? '').matchAll(pattern)) {
    const value = decodeHtml(match[1])
    if (value) matches.push(value)
  }
  return matches
}

const extractElementInnerHtml = (html, marker) => {
  const source = String(html ?? '')
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) return null

  const openTagStart = source.lastIndexOf('<div', markerIndex)
  if (openTagStart < 0) return null

  const openTagEnd = source.indexOf('>', openTagStart)
  if (openTagEnd < 0) return null

  let depth = 1
  let cursor = openTagEnd + 1

  while (cursor < source.length) {
    const nextOpen = source.indexOf('<div', cursor)
    const nextClose = source.indexOf('</div>', cursor)

    if (nextClose < 0) break

    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1
      cursor = source.indexOf('>', nextOpen)
      if (cursor < 0) break
      cursor += 1
      continue
    }

    depth -= 1
    if (depth === 0) {
      return source.slice(openTagEnd + 1, nextClose)
    }

    cursor = nextClose + '</div>'.length
  }

  return null
}

export const buildSearchUrl = () => CAREER_PAGE_URL

export const extractListingCards = (html) => {
  const cards = []
  const seenUrls = new Set()
  const pattern = /<div class="careers-page-jobs-listing-card">[\s\S]*?<p fs-list-field="job-title" class="careers-page-jobs-listing-card-title">([\s\S]*?)<\/p>[\s\S]*?<p fs-list-field="job-type" class="careers-page-jobs-listing-card-type">([\s\S]*?)<\/p>[\s\S]*?<p fs-list-field="job-description" class="careers-page-jobs-listing-card-description">([\s\S]*?)<\/p>[\s\S]*?href="(https:\/\/attentiveos\.keka\.com\/careers\/jobdetails\/\d+)"/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const card = {
      title: decodeHtml(match[1]),
      location: decodeHtml(match[2]),
      description: decodeHtml(match[3]),
      url: decodeHtml(match[4]),
    }

    if (!card.title || !card.url || seenUrls.has(card.url)) continue
    seenUrls.add(card.url)
    cards.push(card)
  }

  return cards
}

export const extractJobDetail = (html) => {
  const source = String(html ?? '')
  const title = decodeHtml((source.match(/<h1[^>]*title="([^"]+)"/i) || [])[1])
    || decodeHtml((source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1])

  const labelTexts = extractTextMatches(
    source,
    /<span class="kch-btn-label-color">([\s\S]*?)<\/span>/gi,
  )

  const descriptionHtml = extractElementInnerHtml(
    source,
    'job-description-container kch-description-color',
  )

  return {
    title,
    location: labelTexts[0] || null,
    employmentType: labelTexts[1] || null,
    jobDescription: decodeHtml(descriptionHtml),
  }
}

const isIndiaLocation = (location) => /india/i.test(normalizeWhitespace(location) || '')

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized
    .replace(/\s*\(.*?\)\s*/g, '')
    .split(',')[0]
    ?.trim() || null
}

const inferRemoteStatus = (location) => /remote/i.test(normalizeWhitespace(location) || '')
  ? 'Remote'
  : 'On-site'

const toJobId = (url) => {
  const match = String(url ?? '').match(/jobdetails\/(\d+)/i)
  return match?.[1] || null
}

export const extractSearchResults = (listingHtml, { detailHtmlByUrl = {} } = {}) =>
  extractListingCards(listingHtml)
    .map((card) => {
      const detail = extractJobDetail(detailHtmlByUrl[card.url] || '')
      const location = detail.location || card.location

      if (!isIndiaLocation(location)) return null

      const jobId = toJobId(card.url)
      if (!jobId) return null

      return {
        title: detail.title || card.title,
        company: 'Attentive.ai',
        department: null,
        location,
        city: extractCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: card.url,
        applyUrl: card.url,
        employmentType: detail.employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: detail.jobDescription || card.description,
        remoteStatus: inferRemoteStatus(location),
      }
    })
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'attentiveai',
  timeoutMs: 15000,
})

export const createAttentiveAiScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const listingHtml = await fetchText(buildSearchUrl())
    const cards = extractListingCards(listingHtml)

    const detailHtmlByUrl = {}
    await Promise.all(cards.map(async (card) => {
      detailHtmlByUrl[card.url] = await fetchText(card.url)
    }))

    const jobs = extractSearchResults(listingHtml, { detailHtmlByUrl })
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'attentiveai',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAttentiveAiScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Attentive.ai scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'attentiveai')
    console.log('DB result:', result)
    process.exit(0)
  }
}
