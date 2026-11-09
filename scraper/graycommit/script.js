import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://graycommit.com/'
export const CAREERS_URL = 'https://www.graycommit.com/careers'
export const APPLY_URL = 'https://forms.gle/JRRyEqayaV32F3xC7'
export const COMPANY = 'Graycommit'
export const SOURCE = 'graycommit'
export const VERIFIED_ON = '2026-08-07'

const INDIA_CITY_ALIASES = new Map([
  ['bangalore', 'Bangalore'],
  ['bengaluru', 'Bangalore'],
])

const normalizeText = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeText(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).href
  } catch {
    return null
  }
}

const slugify = (value) => normalizeText(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeCity = (value) => {
  const normalized = normalizeText(value)?.toLowerCase()
  if (!normalized) return null
  return INDIA_CITY_ALIASES.get(normalized) || null
}

const normalizeLocation = (value) => {
  const city = normalizeCity(value)
  if (!city) return null

  return {
    city,
    location: `${city}, India`,
    country: 'India',
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /graycommit/i.test(page)
    && /careers/i.test(page)
    && /apply\s+now/i.test(page)
    && new RegExp(APPLY_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(page)
}

export const extractBundleUrl = (html, pageUrl = CAREERS_URL) =>
  toAbsoluteUrl(
    String(html ?? '').match(/<script[^>]+src=["']([^"']*\/_expo\/static\/js\/web\/entry-[^"']+\.js)["']/i)?.[1]
    || String(html ?? '').match(/<script[^>]+src=["']([^"']*entry-[^"']+\.js)["']/i)?.[1],
    pageUrl,
  )

export const hasOfficialCareersShellSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Graycommit\s*<\/title>/i.test(page)
    && /<div\s+id=["']root["']>\s*<\/div>/i.test(page)
    && /Use static rendering with Expo Router/i.test(page)
    && Boolean(extractBundleUrl(page, CAREERS_URL))
}

export const hasPublicCareersBundleSignal = (bundleText) => {
  const page = String(bundleText ?? '')

  return /careers/i.test(page)
    || /apply\s+now/i.test(page)
    || /forms\.gle|docs\.google\.com/i.test(page)
    || /current openings|open positions/i.test(page)
}

export const hasVerifiedNoPublicCareersSignal = (bundleText) => {
  const page = String(bundleText ?? '')

  return /graycommit/i.test(page)
    && !hasPublicCareersBundleSignal(page)
}

const extractArticleBlocks = (html) => [...String(html ?? '').matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)]
  .map((match) => match[1])

const extractCurrentCardJobs = (html) => {
  const jobs = []
  const source = String(html ?? '')

  for (const match of source.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const applyLabel = normalizeText(match[2])
    if (!/^apply now$/i.test(applyLabel || '')) continue

    const applyUrl = normalizeText(match[1])
    const prefix = source.slice(Math.max(0, match.index - 2500), match.index)
    const suffix = source.slice(match.index, Math.min(source.length, match.index + 2000))

    const title = [...prefix.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
      .map((entry) => normalizeText(entry[1]))
      .filter(Boolean)
      .at(-1)

    const location = [...prefix.matchAll(/(?:icon-map-pin|map-pin)[\s\S]*?(?:<\/svg>|<\/span>)\s*([^<]+)\s*<\/div>/gi)]
      .map((entry) => normalizeText(entry[1]))
      .filter(Boolean)
      .at(-1)

    const locationData = normalizeLocation(location)
    const jobDescription = [...suffix.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((entry) => normalizeText(entry[1]))
      .filter(Boolean)
      .find((value) => !/ready to join our mission|current openings/i.test(value)) || null

    if (!title || !locationData || !applyUrl) continue

    const jobId = `${SOURCE}-${slugify(title)}-${slugify(locationData.city)}`
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
    })
  }

  return jobs
}

export const extractJobCards = (html) => {
  const articleJobs = extractArticleBlocks(html)
    .map((articleHtml) => {
      const title = normalizeText(articleHtml.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1])
      const paragraphs = [...articleHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((match) => normalizeText(match[1]))
        .filter(Boolean)
      const locationData = normalizeLocation(paragraphs[0])
      const jobDescription = paragraphs[1] || null
      const applyUrl = normalizeText(
        articleHtml.match(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>\s*apply\s+now\s*<\/a>/i)?.[1],
      )

      if (!title || !locationData || !applyUrl) return null

      const jobId = `${SOURCE}-${slugify(title)}-${slugify(locationData.city)}`

      return {
        title,
        company: COMPANY,
        department: null,
        location: locationData.location,
        city: locationData.city,
        country: locationData.country,
        jobId,
        requisitionId: jobId,
        sourceUrl: CAREERS_URL,
        applyUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription,
      }
    })
    .filter(Boolean)

  const jobsById = new Map(articleJobs.map((job) => [job.jobId, job]))
  for (const job of extractCurrentCardJobs(html)) {
    jobsById.set(job.jobId, job)
  }

  return [...jobsById.values()]
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createGraycommitScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (hasOfficialCareersSignal(careersHtml)) {
      const jobs = extractJobCards(careersHtml)

      if (jobs.length === 0) {
        throw new Error('Graycommit verified careers page no longer exposes the expected India opening')
      }

      return jobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl,
        scrapedAt: now(),
      }))
    }

    if (!hasOfficialCareersShellSignal(careersHtml)) {
      throw new Error('Graycommit official careers surface changed; refusing to scrape')
    }

    const bundleUrl = extractBundleUrl(careersHtml, CAREERS_URL)
    const bundleText = await fetchText(bundleUrl)

    if (hasPublicCareersBundleSignal(bundleText)) {
      throw new Error('Graycommit careers surface now exposes public listings and needs a structured scraper')
    }

    if (!hasVerifiedNoPublicCareersSignal(bundleText)) {
      throw new Error('Graycommit verified careers shell changed; refusing to assume no public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createGraycommitScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Graycommit scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
