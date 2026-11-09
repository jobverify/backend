import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'literactfintech'
export const COMPANY = 'Literact Fintech'
export const VERIFIED_ON = '2026-08-03'
export const VERIFIED_SURFACE_SUMMARY =
  'No trustworthy first-party careers surface was discoverable on August 3, 2026: every canonical literactfintech URL returned the expected unresolved-host error, and literact.com redirected to a parked Sparkname for-sale page.'
export const CANONICAL_HOSTS = [
  'literactfintech.com',
  'www.literactfintech.com',
  'literactfintech.in',
  'www.literactfintech.in',
]
export const CANONICAL_URLS = CANONICAL_HOSTS.map((host) => `https://${host}/`)
export const PARKED_DOMAIN_URL = 'https://literact.com/'
export const PARKED_FINAL_URL = 'https://www.sparkname.com/name/Literact.com'

const SPARKNAME_PATTERN = /\bsparkname\b/i
const FOR_SALE_TITLE_PATTERN = /<title>\s*literact\.com is for sale\s*<\/title>/i
const PUBLIC_JOB_TEXT_PATTERN =
  /\b(career opportunities|open roles|open positions|job openings|vacancies|apply now|join our team)\b/i
const PUBLIC_JOB_LINK_PATTERN =
  /boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|workdayjobs|smartrecruiters/i

const REQUEST_TIMEOUT_MS = 15_000

const normalizeVisibleText = (html = '') => String(html ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const isVerifiedParkedPage = ({ finalUrl, html }) => {
  const page = String(html ?? '')

  return String(finalUrl ?? '') === PARKED_FINAL_URL
    && SPARKNAME_PATTERN.test(page)
    && FOR_SALE_TITLE_PATTERN.test(page)
}

export const hasPublicJobSignal = (html) => {
  const page = String(html ?? '')
  const visibleText = normalizeVisibleText(page)

  return PUBLIC_JOB_TEXT_PATTERN.test(visibleText)
    || PUBLIC_JOB_LINK_PATTERN.test(page)
}

export const isExpectedUnresolvedHostError = (error) => {
  const code = error?.cause?.code ?? error?.code

  return code === 'ENOTFOUND' || code === 'EAI_NONAME'
}

export const fetchPage = async (url) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    finalUrl: response.url,
    html: await response.text(),
  }
}

export const createLiteractFintechScraper = () => ({
  async run({
    fetchPage: fetchPageImpl = fetchPage,
  } = {}) {
    for (const url of CANONICAL_URLS) {
      try {
        await fetchPageImpl(url)
      } catch (error) {
        if (isExpectedUnresolvedHostError(error)) {
          continue
        }

        throw new Error(
          `Literact Fintech canonical URL could not be verified as unresolved: ${url}`,
          { cause: error },
        )
      }

      throw new Error(
        `Literact Fintech canonical URL responded; re-verify the official careers surface before trusting []: ${url}`,
      )
    }

    const parkedPage = await fetchPageImpl(PARKED_DOMAIN_URL)

    if (!isVerifiedParkedPage(parkedPage)) {
      if (hasPublicJobSignal(parkedPage.html)) {
        throw new Error('Literact Fintech parked domain now appears to expose public jobs')
      }

      throw new Error('Literact Fintech parked domain surface changed from the verified Sparkname for-sale page')
    }

    return []
  },
})

export const run = async (options = {}) => createLiteractFintechScraper().run(options)

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
