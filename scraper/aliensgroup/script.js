import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.aliensgroup.in/'
export const CAREERS_PAGE_URL = 'https://www.aliensgroup.in/careers'
export const CAREER_PAGE_URL = 'https://www.aliensgroup.in/career'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN = /<title>\s*Aliens Group\s*<\/title>/i
const HOMEPAGE_CAREERS_PATTERN = /\b(career|careers|job|jobs|opening|openings|join us|join our team)\b/i
const MISSING_ROUTE_PATTERN = /\b404\b|\bpage not found\b|\bdoes not exist\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => HOMEPAGE_TITLE_PATTERN.test(String(html ?? ''))

export const hasHomepageCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return HOMEPAGE_CAREERS_PATTERN.test(normalized)
}

export const hasMissingCareersRouteSignal = ({ status, html }) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return status === 404 && MISSING_ROUTE_PATTERN.test(normalized)
}

export const createAliensGroupScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Aliens Group homepage no longer matches the verified official public surface')
    }

    if (hasHomepageCareersSignal(homepage.html)) {
      throw new Error('Aliens Group homepage now shows a public careers signal')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    const careerPage = await fetchPage(CAREER_PAGE_URL)

    if (
      !hasMissingCareersRouteSignal(careersPage)
      || !hasMissingCareersRouteSignal(careerPage)
    ) {
      throw new Error('Aliens Group public careers surface changed')
    }

    return []
  },
})

export const run = async () => createAliensGroupScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'aliensgroup')
  }
}
