import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

import { LATTICE_SEMICONDUCTOR_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const OFFICIAL_CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_WORKDAY_BOARD_URL = PROVIDER_METADATA.workdayBoardUrl
export const WORKDAY_JOBS_API_URL = PROVIDER_METADATA.workdayJobsApiUrl
export const INDIA_COUNTRY_FACET_ID = 'c4f78be1a8f14da0ab49ce1162348a5e'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const sameUrlIgnoringSearch = (left, right) => {
  try {
    const leftUrl = new URL(String(left ?? ''))
    const rightUrl = new URL(String(right ?? ''))
    leftUrl.search = ''
    leftUrl.hash = ''
    rightUrl.search = ''
    rightUrl.hash = ''
    return leftUrl.toString().replace(/\/$/, '') === rightUrl.toString().replace(/\/$/, '')
  } catch {
    return false
  }
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

export const extractOfficialWorkdayBoardUrl = (html = '', baseUrl = OFFICIAL_CAREERS_PAGE_URL) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>/gi)) {
    const href = String(match[2] ?? '').replace(/&amp;/gi, '&')
    if (!/latticesemi\.wd5\.myworkdayjobs\.com\/latticesemiconductorscareers/i.test(href)) {
      continue
    }

    try {
      return new URL(href, baseUrl).toString()
    } catch {
      return href
    }
  }

  return null
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Lattice Semiconductor \| Careers \| Join the FPGA Leader\s*<\/title>/i.test(page)
    && text.includes('Search Job Openings')
    && sameUrlIgnoringSearch(extractOfficialWorkdayBoardUrl(page), OFFICIAL_WORKDAY_BOARD_URL)
}

export const hasOfficialWorkdayBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /<link rel="canonical" href="https:\/\/latticesemi\.wd5\.myworkdayjobs\.com\/(?:en-US\/)?latticesemiconductorscareers/i.test(page)
    && /property="og:title" content="Join the FPGA Leader"/i.test(page)
    && /tenant:\s*"latticesemi"/i.test(page)
    && /siteId:\s*"latticesemiconductorscareers"/i.test(page)
    && /requestLocale:\s*"en-US"/i.test(page)
    && /appName:\s*"cxs"/i.test(page)
}

export const createLatticeSemiconductorIndiaScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    runWorkday = runWorkdayScraper,
  } = {}) {
    const careersPage = await fetchPage(OFFICIAL_CAREERS_PAGE_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Lattice Semiconductor India verified first-party careers page no longer matches the trusted public surface')
    }

    if (!sameUrlIgnoringSearch(extractOfficialWorkdayBoardUrl(careersPage.html), OFFICIAL_WORKDAY_BOARD_URL)) {
      throw new Error('Lattice Semiconductor India verified first-party careers page no longer exposes the pinned Workday handoff')
    }

    const workdayBoard = await fetchPage(OFFICIAL_WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable(workdayBoard, { source: SOURCE, url: OFFICIAL_WORKDAY_BOARD_URL })
    if (workdayBoard.status !== 200 || !hasOfficialWorkdayBoardSignal(workdayBoard.html)) {
      throw new Error('Lattice Semiconductor India verified Workday board no longer matches the trusted public jobs surface')
    }

    const jobs = await runWorkday({
      company: COMPANY_NAME,
      baseUrl: OFFICIAL_WORKDAY_BOARD_URL,
      locationCountry: INDIA_COUNTRY_FACET_ID,
      source: SOURCE,
      scraperDir: currentDir,
    })

    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      company: job.company || COMPANY_NAME,
      source: job.source || SOURCE,
      sourceUrl: job.sourceUrl || job.link || null,
      applyUrl: job.applyUrl || job.link || null,
    }))
  },
})

export const run = async (options = {}) => createLatticeSemiconductorIndiaScraper().run(options)

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
