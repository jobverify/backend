import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'thomascookindia'
export const CAREERS_URL = 'https://www.thomascook.in/export/career/index'

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const stripHtmlComments = (html) => String(html || '').replace(/<!--[\s\S]*?-->/g, ' ')

export const hasVerifiedFormOnlySurface = (page = {}) => {
  const url = String(page.url || '')
  const html = stripHtmlComments(page.html).toLowerCase()

  if (Number(page.status) !== 200 || !/^https:\/\/(www\.)?thomascook\.in\//i.test(url)) {
    return false
  }

  const hasCareerMarkers = html.includes('work with us')
    && html.includes('submit your cv')
    && html.includes('id="contact-form"')
  const hasPublicListingSignal = /\b(job listings?|job openings?|current openings?|vacancies|jobposting|apply now)\b/i.test(html)

  return hasCareerMarkers && !hasPublicListingSignal
}

export const createThomasCookIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const page = await fetchPage(CAREERS_URL)
    if (!hasVerifiedFormOnlySurface(page)) {
      throw new Error('Thomas Cook India official careers surface changed from the verified form-only state')
    }

    return []
  },
})

export const run = async (options = {}) => createThomasCookIndiaScraper().run(options)

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
