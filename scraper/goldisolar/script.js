import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://goldisolar.com/career/'
const DEFAULT_LOCATION = 'Surat, Gujarat, India'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const buildSearchUrl = () => CAREER_PAGE_URL

const extractIntroText = (html) => {
  const match = String(html ?? '').match(
    /<article class="medium-mce"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i,
  )
  return stripTags(match?.[1]) || null
}

export const pageIndicatesApplyForm = (html) => (
  /<h4>\s*Apply Here\s*<\/h4>/i.test(String(html ?? ''))
  && /<form[^>]+action="\/career\/#wpcf7/i.test(String(html ?? ''))
)

const extractRows = (html) => {
  const tableMatch = String(html ?? '').match(/<table id="tablepress-1"[\s\S]*?<tbody[\s\S]*?>([\s\S]*?)<\/tbody>/i)
  if (!tableMatch) return []

  return [...tableMatch[1].matchAll(/<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
}

const parseDepartmentRow = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^([A-Za-z /&-]+?)\s*\[(.+)\]$/)
  if (!match) {
    return {
      department: normalized,
      qualification: null,
    }
  }

  return {
    department: normalizeWhitespace(match[1]),
    qualification: normalizeWhitespace(match[2]),
  }
}

const extractCity = (location) => normalizeWhitespace(location)?.split(',')[0]?.trim() || null

export const extractSearchResults = (html) => {
  const intro = extractIntroText(html)

  return extractRows(html)
    .map(parseDepartmentRow)
    .filter((row) => row?.department)
    .map((row) => {
      const jobId = `goldi-solar-${slugify(row.department)}`

      return {
        title: row.department,
        company: 'Goldi Solar',
        department: row.department,
        location: DEFAULT_LOCATION,
        city: extractCity(DEFAULT_LOCATION),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: CAREER_PAGE_URL,
        applyUrl: CAREER_PAGE_URL,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: row.qualification,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: normalizeWhitespace(
          `${intro || 'Apply via the Goldi Solar careers page.'} Eligibility criteria for ${row.department}: ${row.qualification || 'See careers page for details.'}. Apply via the Goldi Solar careers page.`,
        ),
      }
    })
    .sort((left, right) => left.title.localeCompare(right.title))
}

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

export const createGoldiSolarScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(buildSearchUrl())

    if (/Password Protect WordPress plugin/i.test(html)
      && /<input\b[^>]*type=["']password["']/i.test(html)) {
      throw Object.assign(new Error('Goldi Solar public careers inventory is unavailable: the first-party page is password-protected'), {
        code: 'GOLDISOLAR_INVENTORY_UNAVAILABLE',
        softFailure: true,
        failureKind: 'upstream_inventory_unavailable',
        abortRetries: true,
      })
    }

    if (!pageIndicatesApplyForm(html)) {
      throw new Error('Goldi Solar careers page no longer exposes the expected application form signal')
    }

    const jobs = extractSearchResults(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'goldisolar',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createGoldiSolarScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Goldi Solar scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'goldisolar')
    console.log('DB result:', result)
    process.exit(0)
  }
}
