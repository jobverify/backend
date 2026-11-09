import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'renaultgroup'
export const COMPANY = 'Renault Group'
export const HOMEPAGE_URL = 'https://www.renaultgroup.com/en/'
export const CAREERS_URL = 'https://www.renaultgroup.com/en/careers/'
export const WORKDAY_BOARD_URL = 'https://alliancewd.wd3.myworkdayjobs.com/renault-group-careers'
export const WORKDAY_JOBS_API_URL =
  'https://alliancewd.wd3.myworkdayjobs.com/wday/cxs/alliancewd/renault-group-careers/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
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

const defaultRunWorkday = (options) => runWorkdayScraper(options)

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('renault group')
    && normalized.includes('careers')
    && /href=["'](?:https:\/\/www\.renaultgroup\.com)?\/en\/careers\/?["']/i.test(html)
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return (normalized.includes('a career at the centre of the automotive revolution')
      || normalized.includes('a career at the center of the automotive industry transformation'))
    && normalized.includes('joining renault group means being part of a pioneering automotive company')
    && normalized.includes('find your next job')
    && normalized.includes('view our offers')
    && normalized.includes('reknow university')
    && /href=["'](?:https:\/\/www\.renaultgroup\.com\/en\/careers\/our-international-vacancies\/?|https:\/\/alliancewd\.wd3\.myworkdayjobs\.com\/(?:en-US\/)?renault-group-careers\/?)["']/i.test(html)
}

export const hasOfficialWorkdayBoardSignal = (html) => {
  const page = String(html ?? '')

  const hasInlineWorkdayConfig = /tenant:\s*"alliancewd"/i.test(page)
    && /siteId:\s*"renault-group-careers"/i.test(page)
    && /requestLocale:\s*"en-US"/i.test(page)
    && /appName:\s*"cxs"/i.test(page)
  const hasCurrentWorkdayMetadata = /property="og:url" content="https:\/\/alliancewd\.wd3\.myworkdayjobs\.com\/(?:en-US\/)?renault-group-careers/i.test(page)

  return /<link rel="canonical" href="https:\/\/alliancewd\.wd3\.myworkdayjobs\.com\/(?:en-US\/)?renault-group-careers/i.test(page)
    && /property="og:title" content="Careers \| Renault Group"/i.test(page)
    && (hasInlineWorkdayConfig || hasCurrentWorkdayMetadata)
}

export const createRenaultGroupScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    runWorkday = defaultRunWorkday,
    signal,
    ...workdayOptions
  } = {}) {
    signal?.throwIfAborted()
    const homepage = await fetchPage(HOMEPAGE_URL, { signal })
    signal?.throwIfAborted()
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Renault Group verified official homepage no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL, { signal })
    signal?.throwIfAborted()
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Renault Group verified careers page no longer matches the trusted first-party surface')
    }

    // Renault's current international vacancies feed publishes this same Workday tenant.
    // Verify its live public board and reject an explicit conflicting careers handoff.
    const directHandoff = careersPage.html.match(/href=["'](https:\/\/[^"']+myworkdayjobs\.com\/[^"']+)["']/i)?.[1]
    if (directHandoff && !/^https:\/\/alliancewd\.wd3\.myworkdayjobs\.com\/(?:en-US\/)?renault-group-careers(?:[/?#]|$)/.test(directHandoff)) {
      throw new Error('Renault Group careers handoff changed to an unverified Workday board')
    }
    const workdayBoard = await fetchPage(WORKDAY_BOARD_URL, { signal })
    assertWorkdayPageAvailable(workdayBoard, { source: SOURCE, url: WORKDAY_BOARD_URL })
    signal?.throwIfAborted()
    if (workdayBoard.status !== 200 || !hasOfficialWorkdayBoardSignal(workdayBoard.html)) {
      throw new Error('Renault Group verified Workday board no longer matches the trusted public jobs surface')
    }

    const jobs = await runWorkday({
      ...workdayOptions,
      signal,
      company: COMPANY,
      source: SOURCE,
      baseUrl: WORKDAY_BOARD_URL,
      scraperDir: currentDir,
    })

    const decorated = jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      scrapedAt: now(),
    }))
    const inventory = readInventoryEvidence(jobs)
    if (!inventory || inventory.surface !== WORKDAY_JOBS_API_URL
      || jobs.some(job => job?.source !== SOURCE || job?.company !== COMPANY)) return decorated
    // These are returned role observations, not the reported parent-board total.
    attachSourceObservationEvidence(decorated, {
      source: SOURCE, recordKind: 'vacancy-rows',
      observedRecordCount: jobs.length, observedVacancyCount: jobs.length,
      sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
    })
    return attachInventoryEvidence(decorated, {
      ...inventory,
      status: ['unverified', 'discovery-only', 'coverage-gap'].includes(inventory.status) ? inventory.status : 'coverage-gap',
      listingComplete: false, reportedTotal: null, indiaFacetCount: null,
      reason: 'Exact Renault Group company and India inventory scope remain unverified.'
        + (inventory.reason ? ' Board diagnostic: ' + inventory.reason : ''),
    })
  },
})

export const run = async (options = {}) => createRenaultGroupScraper(options).run(options)

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
