import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'westside'
export const COMPANY = 'Westside'
export const FIRST_PARTY_ROOT_URL = 'https://www.westside.com/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LINK_PATTERN =
  /<a\b[^>]+href=["'][^"']*(?:careers?|jobs?|join-us|work-with-us|vacancies?|openings?)[^"']*["']/i

const PUBLIC_JOBS_PLATFORM_PATTERN =
  /(jobs\.lever\.co|boards\.greenhouse\.io|job-boards\.greenhouse\.io|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|linkedin\.com\/jobs\/|zohorecruit|darwinbox|successfactors)/i

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasVerifiedOfficialSurface = (html = '') => {
  const page = String(html ?? '')
  return /<title>[^<]*\bWestside\b[^<]*<\/title>/i.test(page)
    && /\bWestside\b/i.test(page)
    && !CAREER_LINK_PATTERN.test(page)
    && !PUBLIC_JOBS_PLATFORM_PATTERN.test(page)
}

export const createWestsideScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(FIRST_PARTY_ROOT_URL)

    if (!hasVerifiedOfficialSurface(homepageHtml)) {
      throw new Error(
        `Westside verified first-party surface changed materially: ${FIRST_PARTY_ROOT_URL}`,
      )
    }

    return []
  },
})

export const run = async (options = {}) => createWestsideScraper().run(options)

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
