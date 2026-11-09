import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'innefulabs'
export const COMPANY = 'Innefu Labs'
export const CAREERS_PAGE_URL = 'https://innefu.com/careers/'
export const CURRENT_JOB_URLS = [
  'https://innefu.com/career/technical-architect/',
  'https://innefu.com/career/project-manager/',
]

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper; +https://innefu.com/careers/)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const textAfterHeading = (html, heading) => {
  const match = String(html ?? '').match(new RegExp(`<h[1-6][^>]*>\\s*${heading}\\s*<\\/h[1-6]>([\\s\\S]*?)(?=<h[1-6]|$)`, 'i'))
  return normalizeWhitespace(match?.[1])
}

const firstMatch = (html, pattern) => normalizeWhitespace(String(html ?? '').match(pattern)?.[1]) || null

export const hasOfficialCareersPageSignal = (page) => {
  const html = typeof page === 'string' ? page : page?.html
  const status = typeof page === 'string' ? 200 : Number(page?.status)
  const url = typeof page === 'string' ? CAREERS_PAGE_URL : page?.url

  return status === 200
    && url === CAREERS_PAGE_URL
    && /<title>\s*Careers(?: Archive)?\s*-\s*Innefu Labs\s*<\/title>/i.test(String(html ?? ''))
    && /Current Job Openings/i.test(String(html ?? ''))
}

export const extractJobLinks = (html) => [...new Set(
  [...String(html ?? '').matchAll(/href=["'](\/career\/[a-z0-9-]+\/?)["']/gi)]
    .map((match) => new URL(match[1], CAREERS_PAGE_URL).href),
)]

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
  })
  return { status: response.status, url: response.url, html: await response.text() }
}

const parseDetailPage = (html, url) => {
  const title = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const location = firstMatch(html, /<h1[\s\S]*?<\/h1>[\s\S]*?<[^>]+>\s*([^<]*Delhi[^<]*)\s*<\//i)
  const experienceRequired = firstMatch(html, /<h1[\s\S]*?<\/h1>[\s\S]*?<[^>]+>\s*([^<]*Years?)\s*<\//i)
  const jobDescription = textAfterHeading(html, 'Job Description')
  const applyEmail = firstMatch(html, /([\w.+-]+@innefu\.com)/i)
  const jobId = new URL(url).pathname.split('/').filter(Boolean).pop()

  if (!title || !location || !experienceRequired || !jobDescription || !applyEmail) {
    throw new Error(`Innefu Labs detail page no longer matches the verified job surface: ${url}`)
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location: `${location}, India`,
    city: location,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: url,
    applyUrl: `mailto:${applyEmail}`,
    employmentType: null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
    remoteStatus: null,
    source: SOURCE,
    link: `mailto:${applyEmail}`,
  }
}

export const createInnefuLabsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersPage)) {
      throw new Error('Innefu Labs verified first-party careers page no longer matches the trusted public surface')
    }

    const jobLinks = extractJobLinks(careersPage.html)
    const verifiedJobLinks = jobLinks.length > 0 ? jobLinks : CURRENT_JOB_URLS

    const jobs = []
    for (const jobUrl of verifiedJobLinks) {
      const detailPage = await fetchPage(jobUrl)
      if (detailPage.status !== 200 || detailPage.url !== jobUrl) {
        throw new Error(`Innefu Labs detail page no longer matches the trusted public surface: ${jobUrl}`)
      }
      jobs.push(parseDetailPage(detailPage.html, jobUrl))
    }
    return jobs
  },
})

export const run = async (options = {}) => createInnefuLabsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
