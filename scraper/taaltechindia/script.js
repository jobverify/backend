import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { TAAL_TECH_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN = /\b(?:india|bangalore|bengaluru|nelamangala|chennai|mumbai|hyderabad|pune)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (url.hostname !== 'www.taaltech.com') return null
    return url.toString()
  } catch {
    return null
  }
}

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const extractParagraphs = (html = '') => [...String(html ?? '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const stripHtmlComments = (value = '') => String(value ?? '').replace(/<!--[\s\S]*?-->/g, '')

const htmlToLines = (value = '') => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|a)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const extractLabeledValue = (html = '', label) =>
  normalizeWhitespace(String(html ?? '').match(new RegExp(`${label}\\s*\\|\\s*([^<]+)`, 'i'))?.[1]) || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasConnectTimeoutFailure = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const message = String(error?.cause?.message ?? error?.message ?? error ?? '')

  return code === 'UND_ERR_CONNECT_TIMEOUT'
    || /\bconnect timeout\b/i.test(message)
    || /\btimeout\b/i.test(message)
}

const normalizeIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/\bbangalore\b|\bbengaluru\b/i.test(normalized)) {
    return 'Bangalore, India'
  }

  const city = normalizeCity(normalized)
  if (!city) return null
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${city}, India`
}

export const buildArchivePageUrl = (page = 1) =>
  page <= 1 ? CAREERS_URL : `${CAREERS_URL}page/${page}/`

export const hasOfficialArchiveSignal = (html = '') => {
  const page = String(html ?? '')
  const title = extractTitle(page)
  const text = normalizeWhitespace(page)

  return /TAAL Tech/i.test(title)
    && text.includes('Careers')
    && text.includes('Apply Now')
    && (text.includes('Jobs Archive') || text.includes('Technical Publications Engineer'))
}

export const hasNoJobsFoundSignal = (html = '') =>
  /\bNo jobs found\b/i.test(normalizeWhitespace(html))

export const hasNextArchivePageSignal = (html = '') =>
  /<a[^>]*class=["'][^"']*next\s+page-numbers[^"']*["'][^>]*href=["'][^"']+["']/i.test(String(html ?? ''))

export const extractListingCards = (html = '') => {
  const page = stripHtmlComments(html)
  const jobs = []

  for (const match of String(page).matchAll(/<article[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)) {
    const block = match[1]
    const title = normalizeWhitespace(block.match(/<h[1-6][^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h[1-6]>/i)?.[1])
    const detailUrl = toAbsoluteUrl(block.match(/<a[^>]*href=["']([^"']+)["']/i)?.[1])
    const paragraphs = extractParagraphs(block)
    const [employmentType = null, location = null, postedLabel = null] = paragraphs

    if (!title || !detailUrl || !location) continue

    jobs.push({
      title,
      detailUrl,
      employmentType,
      location,
      postedLabel,
    })
  }

  if (jobs.length > 0) {
    return jobs
  }

  const anchorEntries = []
  const seenUrls = new Map()
  const anchors = [...String(page).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]

  for (const match of anchors) {
    const detailUrl = toAbsoluteUrl(match[1])
    const anchorText = normalizeWhitespace(match[2])
    if (!detailUrl) continue

    let parsedUrl
    try {
      parsedUrl = new URL(detailUrl)
    } catch {
      continue
    }

    if (!parsedUrl.pathname.startsWith('/careers/')) continue
    if (/^\/careers\/page\/\d+\/?$/i.test(parsedUrl.pathname)) continue
    if (/^\/careers\/?$/i.test(parsedUrl.pathname)) continue
    if (/^(?:apply now|\d+)$/i.test(anchorText || '')) continue

    if (!seenUrls.has(detailUrl)) {
      seenUrls.set(detailUrl, {
        detailUrl,
        title: anchorText,
        startIndex: match.index ?? 0,
      })
      anchorEntries.push(seenUrls.get(detailUrl))
      continue
    }

    const existing = seenUrls.get(detailUrl)
    if (!existing.title && anchorText) {
      existing.title = anchorText
    }
  }

  for (let index = 0; index < anchorEntries.length; index += 1) {
    const entry = anchorEntries[index]
    const nextIndex = anchorEntries[index + 1]?.startIndex ?? String(page).length
    const segment = String(page).slice(entry.startIndex, nextIndex)
    const lines = htmlToLines(segment)
    const employmentType = lines.find((line) => /\b(?:full time|part time|contract)\b/i.test(line)) || null
    const location = lines.find((line) =>
      INDIA_LOCATION_PATTERN.test(line)
      || /\bUnited States\b/i.test(line),
    ) || null
    const postedLabel = lines.find((line) => /^Posted\b/i.test(line)) || null

    if (!entry.title || !location) continue

    jobs.push({
      title: entry.title,
      detailUrl: entry.detailUrl,
      employmentType,
      location,
      postedLabel,
    })
  }

  return jobs
}

export const extractJobDetail = (html = '') => {
  const canonicalTitle = normalizeWhitespace(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const positionName = extractLabeledValue(html, 'Position name')
  const openings = extractLabeledValue(html, 'No\\. of positions')
  const minimumQualification = extractLabeledValue(html, 'Education required')
  const experienceRequired = extractLabeledValue(html, 'Experience required')
  const skillsRequired = extractLabeledValue(html, 'Skills required')
  const lines = [
    positionName ? `Position name | ${positionName}` : null,
    openings ? `No. of positions | ${openings}` : null,
    minimumQualification ? `Education required | ${minimumQualification}` : null,
    experienceRequired ? `Experience required | ${experienceRequired}` : null,
    skillsRequired ? `Skills required | ${skillsRequired}` : null,
  ].filter(Boolean)

  return {
    canonicalTitle,
    jobDescription: lines.join(' ') || null,
    minimumQualification,
    experienceRequired,
  }
}

const createJobFromCard = ({ card, detail, scrapedAt }) => {
  const location = normalizeIndiaLocation(card.location)
  const city = normalizeCity(card.location) || 'India'
  const jobId = slugify(card.title)

  return {
    jobId,
    title: detail.canonicalTitle || card.title,
    company: COMPANY,
    department: null,
    location,
    city,
    country: 'India',
    sourceUrl: card.detailUrl,
    applyUrl: card.detailUrl,
    link: card.detailUrl,
    employmentType: card.employmentType,
    experienceRequired: detail.experienceRequired,
    minimumQualification: detail.minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: card.postedLabel,
    closingDate: null,
    jobDescription: detail.jobDescription,
    remoteStatus: 'On-site',
    source: SOURCE,
    scrapedAt,
  }
}

export const createTaalTechIndiaScraper = ({
  now: defaultNow = () => new Date().toISOString(),
  maxPages = 10,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    try {
      const scrapedAt = now()
      const jobs = []
      let pageNumber = 1
      let pageHtml = await fetchText(CAREERS_URL)

      if (!hasOfficialArchiveSignal(pageHtml)) {
        throw new Error('The verified TAAL Tech jobs archive no longer matches the trusted first-party surface')
      }

      while (pageNumber <= maxPages) {
        if (hasNoJobsFoundSignal(pageHtml)) {
          break
        }

        const cards = extractListingCards(pageHtml)
        if (cards.length === 0) {
          throw new Error('The verified TAAL Tech jobs archive no longer exposes parsable listing cards')
        }

        for (const card of cards) {
          if (!INDIA_LOCATION_PATTERN.test(card.location)) continue

          const detailHtml = await fetchText(card.detailUrl)
          const detail = extractJobDetail(detailHtml)
          jobs.push(createJobFromCard({ card, detail, scrapedAt }))
        }

        if (!hasNextArchivePageSignal(pageHtml)) {
          break
        }

        pageNumber += 1
        if (pageNumber > maxPages) break
        pageHtml = await fetchText(buildArchivePageUrl(pageNumber))
      }

      return jobs.sort((left, right) => left.title.localeCompare(right.title))
    } catch (error) {
      if (hasConnectTimeoutFailure(error)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createTaalTechIndiaScraper(options).run(options)

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
