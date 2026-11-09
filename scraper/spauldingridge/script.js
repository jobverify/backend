import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'spauldingridge'
export const CAREERS_URL = 'https://spauldingridge.com/about-us/careers'
export const OPEN_POSITIONS_URL = 'https://spauldingridge.com/about-us/open-positions'
export const VERIFIED_ON = '2026-07-27'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    body: await response.text(),
  }
}

export const hasCloudflareBlockSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Attention Required!\s*\|\s*Cloudflare\s*<\/title>/i.test(page)
    && text.includes('Please enable cookies.')
    && text.includes('Sorry, you have been blocked')
    && text.includes('Cloudflare Ray ID')
    && text.includes('Performance & security by Cloudflare')
}

export const isVerifiedCloudflareBlockedPage = (page = {}) =>
  Number(page.status) === 403
  && hasCloudflareBlockSignal(page.body)
  && normalizeWhitespace(page.body).includes('You are unable to access spauldingridge.com')

export const createSpauldingRidgeScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (!isVerifiedCloudflareBlockedPage(careersPage)) {
      throw new Error('Spaulding Ridge careers route no longer matches the verified Cloudflare-blocked first-party state')
    }

    const openPositionsPage = await fetchPage(OPEN_POSITIONS_URL)
    if (!isVerifiedCloudflareBlockedPage(openPositionsPage)) {
      throw new Error('Spaulding Ridge open positions route no longer matches the verified Cloudflare-blocked first-party state')
    }

    return []
  },
})

export const run = async (options = {}) => createSpauldingRidgeScraper().run(options)

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
