import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREERS_PAGE_URL = 'https://www.crio.do/about-us/'

const SOURCE = 'criodo'
const COMPANY = 'Crio.Do'
const INDIA_LOCATIONS = /\b(?:ahmedabad|bengaluru|bangalore|chennai|coimbatore|delhi|gurugram|gurgaon|hyderabad|india|jaipur|kolkata|mumbai|noida|pune)\b/i

const normalize = (value) => String(value ?? '')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim() || null

const toAbsoluteUrl = (value) => {
  const normalized = normalize(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREERS_PAGE_URL).toString()
  } catch {
    return null
  }
}

const toSlug = (value) => normalize(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractLastHeading = (html) => {
  const headings = [...String(html ?? '').matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
  return normalize(headings.at(-1)?.[1])
}

const extractLabeledValue = (html, label) => {
  const text = normalize(html) || ''
  return normalize(text.match(new RegExp(`${label}\\s*:\\s*(.+?)(?=\\s+(?:Team|Location)\\s*:|\\s+Apply\\s+Now\\b|$)`, 'i'))?.[1])
}

const extractTitle = (cardHtml) => {
  const modernTitle = normalize(
    String(cardHtml ?? '').match(
      /<div[^>]+class=["'][^"']*text-v5-neutral-500[^"']*md:text-lg[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    )?.[1],
  )
  if (modernTitle) return modernTitle

  const heading = extractLastHeading(cardHtml)
  if (heading) return heading

  const text = normalize(cardHtml) || ''
  return normalize(text.match(/(.+?)\s+Team\s*:/i)?.[1])
}

const isIndiaLocation = (location) => INDIA_LOCATIONS.test(location || '')

const formatLocation = (location) => {
  const normalized = normalize(location)
  if (!normalized) return null
  return /\bindia\b/i.test(normalized) ? normalized : `${normalized}, India`
}

const getCity = (location) => normalize(location)
  ?.replace(/,?\s*India$/i, '')
  .split(',')[0]
  .trim() || null

const getRemoteStatus = (location) => /remote/i.test(location || '') ? 'Remote' : 'On-site'

const getCareersSection = (html) => {
  const source = String(html ?? '')
  const start = source.search(/\bWork\s+With\s+Us\b/i)
  if (start < 0) throw new Error('Unable to validate Crio.Do careers page shape: missing Work With Us section')
  return source.slice(start)
}

const findApplyLinks = (section) => [...String(section ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .filter((match) => /\bApply\s+Now\b/i.test(normalize(match[2]) || ''))

const findCardStart = (section, index) => {
  const candidates = [
    section.lastIndexOf('<article', index),
    section.lastIndexOf('<div class="swiper-slide', index),
    section.lastIndexOf('<div class="job-card', index),
  ].filter((value) => value >= 0)

  return candidates.length ? Math.max(...candidates) : 0
}

export const extractCareerJobs = (html) => {
  const section = getCareersSection(html)
  const applyLinks = findApplyLinks(section)
  if (applyLinks.length === 0) {
    throw new Error('Unable to validate Crio.Do careers page shape: missing Apply Now links')
  }

  const jobs = []
  let cardStart = 0

  for (const match of applyLinks) {
    const currentCardStart = findCardStart(section, match.index)
    const cardHtml = section.slice(Math.max(cardStart, currentCardStart), match.index + match[0].length)
    cardStart = match.index + match[0].length

    const title = extractTitle(cardHtml)
    const department = extractLabeledValue(cardHtml, 'Team')
    const rawLocation = extractLabeledValue(cardHtml, 'Location')
    const applyUrl = toAbsoluteUrl(match[1])

    if (!title || !department || !rawLocation || !applyUrl) {
      throw new Error('Unable to validate Crio.Do career card shape')
    }
    if (!isIndiaLocation(rawLocation)) continue

    const jobId = toSlug(title)
    jobs.push({
      title,
      company: COMPANY,
      department,
      location: formatLocation(rawLocation),
      city: getCity(rawLocation),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: getRemoteStatus(rawLocation),
      companyCareerPage: CAREERS_PAGE_URL,
      atsPlatform: 'official-company-careers',
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCriodoScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobs = extractCareerJobs(await fetchText(CAREERS_PAGE_URL))

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createCriodoScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  console.log(`Crio.Do jobs scraped: ${jobs.length}`)
}
