import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'maxeyetechnologies'
export const COMPANY = 'MaxEye Technologies'
export const HOMEPAGE_URL = 'https://maxeye.com/'
export const CONTACT_URL = 'https://maxeye.com/contact/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const hasContactRoute = (html) =>
  /href=["'](?:https:\/\/maxeye\.com)?\/contact\/["']/i.test(String(html ?? ''))

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = normalizeWhitespace(html)
  return /Professional and Reliable Active Stylus (?:Solution )?Provider/i.test(page)
    && hasContactRoute(html)
    && /Maxeye/i.test(page)
}

export const hasHiringContactSignal = (html = '') => {
  const page = normalizeWhitespace(html)
  return /Join Us/i.test(page) && /hr@maxeye\.com/i.test(page)
}

export const hasPublicJobsSignal = (html = '') => {
  const page = normalizeWhitespace(html)
  return /\b(open positions|apply now|job openings|careers\/|jobs\/)\b/i.test(page)
}

export const extractOpenings = () => []

export const createMaxEyeTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('MaxEye Technologies verified official homepage no longer matches the current public surface')
    }

    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('MaxEye Technologies homepage now appears to expose a public jobs surface; scraper needs an update')
    }

    const contactHtml = await fetchText(CONTACT_URL)

    if (!hasHiringContactSignal(contactHtml)) {
      throw new Error('MaxEye Technologies verified hiring contact no longer matches the current public surface')
    }

    if (hasPublicJobsSignal(contactHtml)) {
      throw new Error('MaxEye Technologies contact page now appears to expose a public jobs surface; scraper needs an update')
    }

    return extractOpenings(contactHtml)
  },
})

export const run = async (options = {}) => createMaxEyeTechnologiesScraper().run(options)

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
