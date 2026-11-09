import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractAshbyJobs } from '../uipath/script.js'
import {
  fetchJsonWithRetry,
} from '../../scraper-support/utils/fetch.js'
import ALPHONSO_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ALPHONSO_CATALOG.source
export const COMPANY = ALPHONSO_CATALOG.companyName
export const HOMEPAGE_URL = ALPHONSO_CATALOG.officialHomepageUrl
export const CAREERS_ROUTE_URL = ALPHONSO_CATALOG.companyCareerPage
export const PARENT_CAREERS_URL = ALPHONSO_CATALOG.parentCareersPage
export const ASHBY_PUBLIC_BOARD_URL = ALPHONSO_CATALOG.ashbyPublicBoardUrl
export const ASHBY_JOB_BOARD_URL = ALPHONSO_CATALOG.ashbyJobBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

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

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Alphonso\s*&#8211;\s*The TV Data Company\s*<\/title>/i.test(page)
    && normalized.includes('leaders in technology for connected tv advertising')
    && normalized.includes('for more information, information, see lg ad solutions')
    && normalized.includes('info@alphonso.tv')
    && normalized.includes('alphonso inc.')
}

export const hasParentCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return /<title>\s*Careers\s*\|\s*LG Ad Solutions\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/lgads\.tv\/careers\/["']/i.test(page)
    && normalized.includes('come join us!')
    && normalized.includes('careers@lgads.tv')
    && normalized.includes('lg ad solutions, incorporated as alphonso inc.')
}

export const extractVerifiedAshbyJobBoardUrl = (html) => {
  const match = String(html ?? '').match(/https:\/\/jobs\.ashbyhq\.com\/([^/"']+)\/embed/i)
  if (!match) return null

  return match[1] === 'lgads'
    ? ASHBY_JOB_BOARD_URL
    : `https://api.ashbyhq.com/posting-api/job-board/${match[1]}`
}

export const createAlphonsoScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Alphonso verified official homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_ROUTE_URL)
    if (!sameUrl(careersPage.url, PARENT_CAREERS_URL)) {
      throw new Error('Alphonso verified parent careers redirect no longer matches the known LG Ad Solutions handoff')
    }

    if (careersPage.status !== 200 || !hasParentCareersSignal(careersPage.html)) {
      throw new Error('Alphonso verified parent careers surface no longer matches the known public surface')
    }

    const verifiedJobBoardUrl = extractVerifiedAshbyJobBoardUrl(careersPage.html)
    if (verifiedJobBoardUrl && verifiedJobBoardUrl !== ASHBY_JOB_BOARD_URL) {
      throw new Error('Alphonso verified Ashby job-board handoff changed')
    }

    const payload = await fetchJson(ASHBY_JOB_BOARD_URL)
    if (!Array.isArray(payload?.jobs)) {
      throw new Error('Alphonso public Ashby job-board payload no longer exposes the verified jobs array')
    }

    return extractAshbyJobs(payload).map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAlphonsoScraper(options).run(options)

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
