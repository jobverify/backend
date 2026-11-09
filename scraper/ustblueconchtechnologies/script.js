import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ustblueconchtechnologies'
export const COMPANY = 'UST BlueConch Technologies'
export const UST_CAREERS_URL = 'https://www.ust.com/en/careers'
export const BLUECONCH_REFERENCE_URL =
  'https://www.ust.com/en/who-we-are/ust-newsroom/ust-blueconch-wins-excellence-award-for-best-security-practices-in-it-ites-sector'

const PUBLIC_BLUECONCH_JOBS_PATTERN = /blueconch[\s\S]{0,120}(open positions|current openings|apply now|job openings)/i

export const hasCloudflareBlockedUstSignal = (html) => {
  const page = String(html ?? '')
  return /Attention Required!\s*\|\s*Cloudflare/i.test(page)
    && /Please enable cookies/i.test(page)
    && /Sorry,\s*you have been blocked/i.test(page)
    && /cf-wrapper|cf-error-details/i.test(page)
}

export const pageExposesBlueConchSpecificJobs = (html) => PUBLIC_BLUECONCH_JOBS_PATTERN.test(String(html ?? ''))

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return response.text()
}

export const createUstBlueConchTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const referenceHtml = await fetchText(BLUECONCH_REFERENCE_URL)
    const careersHtml = await fetchText(UST_CAREERS_URL)

    if (!hasCloudflareBlockedUstSignal(referenceHtml)) {
      throw new Error('UST BlueConch Technologies first-party reference page no longer matches the verified surface')
    }

    if (!hasCloudflareBlockedUstSignal(careersHtml)) {
      throw new Error('UST BlueConch Technologies parent careers page no longer matches the verified blocked UST surface')
    }

    if (pageExposesBlueConchSpecificJobs(careersHtml)) {
      throw new Error('UST BlueConch Technologies now exposes a BlueConch-specific public jobs surface and needs a structured scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createUstBlueConchTechnologiesScraper().run(options)

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
