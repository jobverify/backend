import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.aizant.com/careers/we-are-hiring/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&#8211;|&#x2013;/gi, '–')
    .replace(/&#8216;|&#x2018;/gi, "'")
    .replace(/&#8217;|&#x2019;/gi, '’')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toIsoDate = (value) => {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const inferRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  return 'On-site'
}

const extractMetaDate = (html) => {
  const match = String(html ?? '').match(/<meta[^>]+property="article:modified_time"[^>]+content="([^"]+)"/i)
  return toIsoDate(match?.[1])
}

const parsePanelBody = (html) => {
  const text = normalizeWhitespace(html) || ''
  const location = normalizeWhitespace(html.match(/<strong>\s*Location:\s*<\/strong>\s*([^<]+)/i)?.[1])
  const experienceRequired = normalizeWhitespace(html.match(/<strong>\s*Experience:\s*<\/strong>\s*([^<]+)/i)?.[1])
  const jobDescription = normalizeWhitespace(
    text
      .replace(/^Location:\s*.+?\s+Experience:\s*.+?\s+(?=(Qualifications:|About the Role:|Key Responsibilities:))/i, '')
      .replace(/\s*Apply Now\s*$/i, ''),
  )

  return {
    location,
    experienceRequired,
    jobDescription,
  }
}

const buildJobUrl = (panelId) => new URL(`#${panelId}`, CAREER_PAGE_URL).toString()

export const buildSearchUrl = () => CAREER_PAGE_URL

export const extractSearchResults = (html) => {
  const postingDate = extractMetaDate(html)
  const jobs = []
  const pattern = /<div class="fusion-panel[\s\S]*?<span class="fusion-toggle-heading">([\s\S]*?)<\/span>[\s\S]*?<div id="([^"]+)" class="panel-collapse[\s\S]*?<div class="panel-body toggle-content fusion-clearfix">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const title = normalizeWhitespace(match[1])
    const panelId = normalizeWhitespace(match[2])
    const body = parsePanelBody(match[3])
    const location = body.location ? `${body.location}, India` : 'India'

    if (!title || !panelId) continue

    jobs.push({
      title,
      company: 'Aizant Drug Research Solutions Pvt. Ltd.',
      department: null,
      location,
      city: body.location || null,
      country: 'India',
      jobId: panelId,
      requisitionId: panelId,
      sourceUrl: buildJobUrl(panelId),
      applyUrl: buildJobUrl(panelId),
      employmentType: null,
      experienceRequired: body.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription: body.jobDescription,
      remoteStatus: inferRemoteStatus(location),
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'aizant',
  timeoutMs: 15000,
})

export const createAizantScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(buildSearchUrl())
    const jobs = extractSearchResults(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'aizant',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAizantScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Aizant scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'aizant')
    console.log('DB result:', result)
    process.exit(0)
  }
}
