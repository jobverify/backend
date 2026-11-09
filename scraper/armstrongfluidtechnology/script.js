import path from 'path'
import { fileURLToPath } from 'url'
import { runNativeArmstrong } from './nativeBamboo.js'

const BASE_URL = 'https://armstrongfluidtechnology.com'
const CAREERS_PAGE_URL = `${BASE_URL}/en/about-armstrong/careers`
const currentDir = path.dirname(fileURLToPath(import.meta.url))

const decodeHtmlEntities = (value) => String(value || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const repairMojibake = (value) => String(value || '')
  .replace(/â€“/g, '-')
  .replace(/â€”/g, '-')
  .replace(/â€˜|â€™/g, "'")
  .replace(/â€œ|â€�/g, '"')
  .replace(/[–—]/g, ' - ')
  .replace(/Â/g, '')

const normalizeWhitespace = (value) => repairMojibake(decodeHtmlEntities(value))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractFirst = (pattern, value) => {
  const match = String(value || '').match(pattern)
  return match ? match[1] : null
}

const toAbsoluteUrl = (value) => {
  const normalized = decodeHtmlEntities(value)
  if (!normalized) return null

  try {
    return new URL(normalized, BASE_URL).toString()
  } catch {
    return null
  }
}

const parseDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const months = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  }

  const match = normalized.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/)
  if (!match) return null

  const [, monthName, day, year] = match
  const month = months[monthName.toLowerCase()]
  if (!month) return null
  return `${year}-${month}-${day.padStart(2, '0')}`
}

export const buildCareersPageUrl = () => CAREERS_PAGE_URL

export const buildJobDetailUrl = (slug) => (
  `${BASE_URL}/en/about-armstrong/careers/careers/${normalizeWhitespace(slug) || ''}`
)

const extractIndiaSection = (html) => {
  const source = String(html || '')
  const start = source.indexOf('id="loc-india"')
  if (start < 0) return null

  const nextRegion = source.indexOf('<div class="container careers-region">', start + 1)
  if (nextRegion < 0) return source.slice(start)

  return source.slice(start, nextRegion)
}

export const extractListings = (html) => {
  const section = extractIndiaSection(html)
  if (!section) return []

  return [...section.matchAll(
    /<div class="job-post[\s\S]*?<h4><a name="[^"]+"><\/a>([\s\S]*?)<\/h4>[\s\S]*?<p class="location">[\s\S]*?<img[^>]*>\s*([\s\S]*?)\s*<\/p>[\s\S]*?<p class="date">\s*([\s\S]*?)\s*<\/p>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<div class="read-more hidden">[\s\S]*?<a href="([^"]+)">[\s\S]*?<\/div>[\s\S]*?<a class="btn med blue" href="([^"]+)"/gi,
  )]
    .map((match) => {
      const title = normalizeWhitespace(match[1])
      const location = `${normalizeWhitespace(match[2])}, India`
      const sourceSlug = normalizeWhitespace(match[5]).replace(/^careers\//i, '')
      const sourceUrl = buildJobDetailUrl(sourceSlug)

      if (!title || !sourceSlug) return null

      return {
        title,
        company: 'Armstrong Fluid Technology',
        department: null,
        location,
        city: normalizeWhitespace(match[2]).split(',')[0]?.trim() || null,
        country: 'India',
        jobId: sourceSlug,
        requisitionId: sourceSlug,
        sourceUrl,
        applyUrl: toAbsoluteUrl(match[6]),
        employmentType: 'Full-time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: parseDate(match[3]),
        closingDate: null,
        jobDescription: normalizeWhitespace(match[4]),
      }
    })
    .filter(Boolean)
}

export const extractListingSummary = (html) => ({
  totalCount: extractListings(html).length,
})

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createArmstrongFluidTechnologyScraper = () => ({
  async run(options = {}) {
    return runNativeArmstrong(options)
  },
})

export const run = async (options = {}) => createArmstrongFluidTechnologyScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Armstrong Fluid Technology scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'armstrongfluidtechnology')
    console.log('DB result:', result)
    process.exit(0)
  }
}
