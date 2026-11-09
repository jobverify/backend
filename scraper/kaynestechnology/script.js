import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KAYNES_TECHNOLOGY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KAYNES_TECHNOLOGY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://www.kaynestechnology.co.in/careers.html',
  'https://www.kaynestechnology.co.in/careers',
  'https://www.kaynestechnology.co.in/jobs.html',
  'https://www.kaynestechnology.co.in/recruitment.html',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasVerifiedHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Kaynes Technology(?: India Limited)?\s*<\/title>/i.test(page)
    && normalized.includes('Beware of Recruitment Frauds')
    && normalized.includes('Kaynes Technology India Limited')
}

export const hasPublicJobSignals = (html = '') => {
  const page = String(html ?? '')

  return /\b(Open Positions|Current Openings|Job Openings|Vacancies)\b/i.test(page)
    || /\bApply Now\b/i.test(page)
    || /href=["'][^"']*\/(?:careers?|jobs?)\/[^"']+["']/i.test(page)
}

export const isVerifiedMissingJobRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page.status) === 404
    && normalized === '404 Not Found'
    || (
      Number(page.status) === 404
      && /<title>\s*404 Not Found\s*<\/title>/i.test(html)
      && normalized.includes('404 Not Found')
      && !hasPublicJobSignals(html)
    )
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createKaynesTechnologyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html)) {
      throw new Error('Kaynes Technology verified homepage no longer matches the trusted first-party surface')
    }

    if (hasPublicJobSignals(homepage.html)) {
      throw new Error('Kaynes Technology homepage now exposes a public jobs surface')
    }

    for (const url of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(url)
      if (!isVerifiedMissingJobRoute(routePage)) {
        throw new Error(`Kaynes Technology common careers route changed materially or now exposes public jobs: ${routePage.url || url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createKaynesTechnologyScraper().run(options)

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
