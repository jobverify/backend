import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'paltech'
export const COMPANY = 'PalTech'
export const COMPANY_DOMAIN = 'pal-tech.com'
export const CAREERS_URL = 'https://pal-tech.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const parsePostingDate = (value) => {
  const cleaned = normalizeWhitespace(value)
  const parsed = Date.parse(cleaned ? `${cleaned} UTC` : '')

  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10)
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const extractOpenPositionsSection = (html) => String(html ?? '').match(
  /<div id=["']open-positions["'][\s\S]*?>([\s\S]*?)<div id=["']closed-positions["']/i,
)?.[1] ?? null

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*-\s*Paltech: Elevating Performance\s*<\/title>/i.test(page)
    && /id=["']open-positions["']/i.test(page)
    && /business-analyst/i.test(page)
}

export const extractOpenPositionListings = (html) => {
  const section = extractOpenPositionsSection(html)
  if (!section) return []

  return [...section.matchAll(
    /<div class=["'][^"']*careers-page_jobs--item[^"']*["'][\s\S]*?<h3>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>[\s\S]*?<div class=["'][^"']*careers-page_jobs--item-extras[^"']*["'][\s\S]*?<span>([\s\S]*?)<\/span>[\s\S]*?<span>([\s\S]*?)<\/span>[\s\S]*?<span>([\s\S]*?)<\/span>[\s\S]*?<\/div>[\s\S]*?<\/div>/gi,
  )].map((match) => {
    const sourceUrl = toAbsoluteUrl(match[1])
    const title = stripTags(match[2])
    const locationLabel = stripTags(match[3])
    const department = stripTags(match[4]) || null
    const postingDate = parsePostingDate(stripTags(match[5]))
    const city = locationLabel.split(',')[0]?.trim() || null

    return {
      title,
      company: COMPANY,
      department,
      location: locationLabel ? `${locationLabel}, United States` : null,
      city,
      country: 'United States',
      jobId: 'business-analyst',
      requisitionId: 'business-analyst',
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription: null,
    }
  }).filter((job) => job.title && job.sourceUrl)
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return response.text()
}

export const createPaltechScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('PalTech careers page no longer matches the verified first-party open positions surface')
    }

    return extractOpenPositionListings(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-first-party-open-positions-page',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createPaltechScraper().run(options)

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
