import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bacancytechnology'
export const COMPANY = 'Bacancy Technology'
export const JOBS_PAGE_URL = 'https://www.bacancytechnology.com/jobs/careers-apply.php'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeText = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const isVerifiedCloudflareBlock = ({ status, body, html }) => {
  const rawHtml = String(body ?? html ?? '')
  const normalized = normalizeText(rawHtml)

  return status === 403
    && /Attention Required!\s*\|\s*Cloudflare/i.test(rawHtml)
    && /Sorry,\s*you have been blocked/i.test(normalized)
    && /unable to access\s+bacancytechnology\.com/i.test(normalized)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    body: await response.text(),
    url: response.url || url,
  }
}

export const createBacancyTechnologyScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const page = await fetchPage(JOBS_PAGE_URL)

    if (!isVerifiedCloudflareBlock(page)) {
      throw new Error(
        'The verified Cloudflare-blocked Bacancy jobs surface changed; keep this provider fail-closed until it is re-verified.',
      )
    }

    const scrapedAt = (overrideNow || now)()
    void scrapedAt
    return []
  },
})

export const run = async (options = {}) => createBacancyTechnologyScraper(options).run(options)

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
