import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://skill-mine.com/career/'

const SOURCE = 'skillminetechnologyconsulting'
const COMPANY = 'Skillmine Technology Consulting'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
  .replace(/&hellip;/gi, '...')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(String(value))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const buildJobId = ({ title, city }) => [
  SOURCE,
  slugify(title),
  slugify(city),
].filter(Boolean).join('-')

const toIndiaLocation = (city) => {
  const normalized = normalizeWhitespace(city)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const buildJobDescription = (description) => {
  const normalized = stripTags(description)
  if (!normalized) return 'Apply via the Skillmine careers page.'
  return `${normalized} Apply via the Skillmine careers page.`
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return (
    /Skillmine Careers \| Find the Job Opportunities/i.test(page)
    && /Submit your Resume and Join us/i.test(page)
    && /Current Open Positions/i.test(page)
  )
}

export const hasSharedApplicationFormSignal = (html) => {
  const page = String(html ?? '')
  return (
    /id=["']spotlightForm["']/i.test(page)
    && /name=["']action["']\s+value=["']spotlight_apply["']/i.test(page)
    && /openApplyPopup\(/i.test(page)
  )
}

export const extractJobCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Skillmine careers page no longer matches the verified official careers surface')
  }

  if (!hasSharedApplicationFormSignal(html)) {
    throw new Error('Skillmine careers page no longer exposes the verified shared application form')
  }

  const cards = [...String(html ?? '').matchAll(/<div class="job-card">([\s\S]*?)<\/div>/gi)]
    .map((match) => match[1])
    .map((cardHtml) => {
      const title = stripTags(cardHtml.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1])
      const city = stripTags(cardHtml.match(/<strong>\s*Location:\s*<\/strong>\s*([\s\S]*?)<\/p>/i)?.[1])
      const experienceRequired = stripTags(cardHtml.match(/<strong>\s*Experience:\s*<\/strong>\s*([\s\S]*?)<\/p>/i)?.[1])
      const rawDescription = cardHtml.match(/<strong>\s*Job Description:\s*<\/strong>\s*([\s\S]*?)<\/p>/i)?.[1] || null
      const postingDate = stripTags(cardHtml.match(/<strong>\s*Updated At:\s*<\/strong>\s*([\s\S]*?)<\/p>/i)?.[1])
      const requisitionId = title?.match(/^(\d+)/)?.[1] || null

      if (!title || !city) return null

      return {
        title,
        company: COMPANY,
        department: null,
        location: toIndiaLocation(city),
        city,
        country: 'India',
        jobId: buildJobId({ title, city }),
        requisitionId,
        sourceUrl: CAREERS_PAGE_URL,
        applyUrl: CAREERS_PAGE_URL,
        employmentType: null,
        experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate,
        closingDate: null,
        jobDescription: buildJobDescription(rawDescription),
      }
    })
    .filter(Boolean)

  if (cards.length === 0) {
    throw new Error('Skillmine careers page no longer exposes the verified public job cards')
  }

  return cards
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSkillmineTechnologyConsultingScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_PAGE_URL)
    const jobs = extractJobCards(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createSkillmineTechnologyConsultingScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ${COMPANY} scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
