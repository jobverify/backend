import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'appknox'
export const COMPANY = 'Appknox'
export const COMPANY_DOMAIN = 'appknox.com'
export const VERIFIED_ON = '2026-07-25'
export const CAREERS_PAGE_URL = 'https://www.appknox.com/careers'
export const CUTSHORT_COMPANY_URL = 'https://cutshort.io/company/appknox-%28xysec-labs-pte-ltd%29-j2I4OU56'

const normalizeText = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasTrustedCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Careers\s*\|\s*Appknox\s*<\/title>/i.test(page)
    && /Work Together!/i.test(normalizeText(page))
    && /View Open Positions/i.test(normalizeText(page))
    && /href=["']https:\/\/cutshort\.io\/company\/appknox-\(xysec-labs-pte-ltd\)-j2I4OU56["']/i.test(page)
    && /Apply Now/i.test(normalizeText(page))
}

const extractCards = (html) => {
  const jobs = []
  const page = String(html)
  const departmentStarts = [...page.matchAll(/<div\b[^>]*class=["'][^"']*\bdepartments\b[^"']*["'][^>]*>/gi)]
  const sections = departmentStarts.map((match, index) => page.slice(
    match.index,
    departmentStarts[index + 1]?.index,
  ))

  for (const section of sections) {
    const department = normalizeText(section.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1])
    if (!department || !/^(Sales|Security)$/i.test(department)) continue

    const openingStarts = [...section.matchAll(/<div\b[^>]*class=["'][^"']*\bopenning-details\b[^"']*["'][^>]*>/gi)]
    for (let index = 0; index < openingStarts.length; index += 1) {
      const card = section.slice(openingStarts[index].index, openingStarts[index + 1]?.index)
      const title = normalizeText(card.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
      const items = [...card.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => normalizeText(item[1]))
      const location = items.find((value) => /Bengaluru/i.test(value))
      const experienceRequired = items.find((value) => /Years/i.test(value))
      const employmentType = items.find((value) => /^(Full Time|Part Time|Contract)$/i.test(value))
      const link = card.match(/<a\b[^>]+href=["'](https:\/\/cutshort\.io\/job\/[^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1]
      if (!title || !location || !experienceRequired || !employmentType || !link) continue

      jobs.push({
        title,
        department,
        location,
        city: 'Bengaluru',
        employmentType,
        experienceRequired,
        link,
        applyUrl: link,
        source: SOURCE,
      })
    }
  }

  return jobs
}

export const extractJobs = (html = '') => extractCards(html)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
  })
  return response.text()
}

export const createAppknoxScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasTrustedCareersSignal(careersHtml)) {
      throw new Error('Appknox verified careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractJobs(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Appknox verified careers page no longer exposes public opening cards')
    }

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      country: 'India',
      companyCareerPage: CAREERS_PAGE_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-first-party-careers-plus-cutshort',
      jobId: `${SOURCE}-${job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      requisitionId: `${SOURCE}-${job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      sourceUrl: CAREERS_PAGE_URL,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createAppknoxScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
