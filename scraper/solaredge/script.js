import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://corporate.solaredge.com/en/careers'
export const OPEN_POSITIONS_URL = 'https://corporate.solaredge.com/en/careers/open-positions'

const COMPANY = 'SolarEdge'
const SOURCE = 'solaredge'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const buildPositionId = (position = {}) =>
  normalizeWhitespace(position.clean_pid)
  || normalizeWhitespace(position.pid)?.replace(/[^a-z0-9]+/gi, '')
  || slugify(position.pname)

export const buildDetailUrl = (jobId) =>
  `${OPEN_POSITIONS_URL}?position=comeet-${encodeURIComponent(jobId)}`

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /data-drupal-selector="drupal-settings-json"/i.test(page)
    && /join-us-search-form/i.test(page)
    && /data-form-action="\/careers\/open-positions"/i.test(page)
    && /SolarEdge Careers/i.test(page)
}

export const extractDrupalSettings = (html) => {
  const match = String(html ?? '').match(
    /<script type="application\/json" data-drupal-selector="drupal-settings-json">([\s\S]*?)<\/script>/i,
  )

  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export const extractIndiaPositions = (settings) => {
  const indiaPositions = settings?.positions?.India
  if (!indiaPositions || typeof indiaPositions !== 'object') return []

  return Object.entries(indiaPositions).flatMap(([department, cities]) =>
    Object.entries(cities || {}).flatMap(([city, positions]) =>
      (Array.isArray(positions) ? positions : []).map((position) => {
        const title = normalizeWhitespace(position?.pname)
        const normalizedCity = normalizeWhitespace(position?.city || city)
        const requisitionId = buildPositionId(position)

        if (!title || !requisitionId) return null

        return {
          title,
          department: normalizeWhitespace(department),
          city: normalizedCity,
          country: 'India',
          jobId: requisitionId,
          requisitionId,
        }
      }),
    ),
  ).filter(Boolean)
}

export const extractJobListings = (html) => {
  if (!hasOfficialCareersSignal(html)) return []

  return extractIndiaPositions(extractDrupalSettings(html)).map((position) => ({
    ...position,
    location: position.city ? `${position.city}, ${position.country}` : position.country,
    sourceUrl: buildDetailUrl(position.jobId),
    applyUrl: buildDetailUrl(position.jobId),
    employmentType: null,
    experienceRequired: null,
    postingDate: null,
    closingDate: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    jobDescription: null,
    remoteStatus: 'On-site',
  }))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSolarEdgeScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('SolarEdge careers page no longer matches the verified official public surface')
    }

    const settings = extractDrupalSettings(html)
    if (!settings?.positions || typeof settings.positions !== 'object') {
      throw new Error('SolarEdge embedded careers payload is missing from the verified public surface')
    }

    return extractJobListings(html).map((job) => ({
      ...job,
      company: COMPANY,
      link: job.applyUrl || job.sourceUrl,
      source: SOURCE,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createSolarEdgeScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running SolarEdge scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
