import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCurrentAgentDnaScraper } from './currentPublic.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.agentdna.ai/'
export const CAREERS_URL = 'https://www.agentdna.ai/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const OFFICIAL_TITLE_PATTERN = /<title>\s*AgentDNA\s*-\s*Build Smarter AI Agents\s*<\/title>/i
const BRAND_HERO_PATTERN = /Build AI agents from composable genes/i
const BRAND_TAGLINE_PATTERN = /The modular gene system for AI agents/i
const PUBLIC_JOB_BOARD_PATTERN =
  /\b(open roles|open positions|current openings|job openings|view openings|available positions|hiring now|apply now|apply here|join our team)\b|jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|workdayjobs/i

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const stripHtml = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title>([^<]*)<\/title>/i)
  return normalizeWhitespace(match?.[1] ?? '')
}

const extractPrimaryHeading = (html) => {
  const match = String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  return stripHtml(match?.[1] ?? '')
}

export const hasOfficialAgentDnaSignal = (html) => {
  const page = String(html ?? '')
  const text = stripHtml(page)

  return OFFICIAL_TITLE_PATTERN.test(page)
    && BRAND_HERO_PATTERN.test(text)
    && (
      BRAND_TAGLINE_PATTERN.test(text)
      || /The modular gene system for composable AI agents/i.test(page)
    )
}

export const hasPublicJobBoardSignal = (html) => PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

export const matchesBrandedExperience = (homepageHtml, careersHtml) =>
  hasOfficialAgentDnaSignal(homepageHtml)
  && hasOfficialAgentDnaSignal(careersHtml)
  && extractTitle(homepageHtml) === extractTitle(careersHtml)
  && extractPrimaryHeading(homepageHtml) === extractPrimaryHeading(careersHtml)

export const hasMissingCareersRouteSignal = (html) => {
  const text = stripHtml(html)

  return /404:\s*This page could not be found\./i.test(extractTitle(html))
    && /404/i.test(text)
    && /This page could not be found\./i.test(text)
    && /AgentDNA\s*-\s*Build Smarter AI Agents/i.test(text)
    && !hasPublicJobBoardSignal(html)
}

export const validateJobResults = (jobs) => {
  if (!Array.isArray(jobs)) {
    throw new TypeError('AgentDNA scraper must return an array of jobs')
  }

  for (const job of jobs) {
    if (!job || typeof job !== 'object') {
      throw new TypeError('AgentDNA scraper returned a non-object job entry')
    }

    for (const field of ['title', 'company', 'location', 'source', 'link', 'applyUrl', 'sourceUrl']) {
      if (typeof job[field] !== 'string' || !job[field].trim()) {
        throw new TypeError(`AgentDNA scraper returned a job with an invalid ${field}`)
      }
    }

    if (typeof job.scrapedAt !== 'string' || !job.scrapedAt.trim()) {
      throw new TypeError('AgentDNA scraper returned a job with an invalid scrapedAt')
    }
  }

  return jobs
}

export const createAgentDnaScraper = () => createCurrentAgentDnaScraper()

export const run = async (options = {}) => createAgentDnaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running AgentDNA scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'agentdna')
    console.log('DB result:', result)
    process.exit(0)
  }
}
