import { assertWorkdayPageAvailable } from '../../scraper-support/myworkday/pageAvailability.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { runWorkdayScraper } from '../../scraper-support/myworkday/engine.js'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { hasDeclaredPolarisAccount } from './nativeAccount.js'

import POLARIS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SCRAPER_DIR = currentDir
export const PROVIDER_METADATA = POLARIS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_CATEGORIES_URL = PROVIDER_METADATA.officialJobCategoriesUrl
export const WORKDAY_BOARD_URL = PROVIDER_METADATA.workdayBoardUrl
export const INDIA_LOCATION_COUNTRY = PROVIDER_METADATA.verifiedIndiaLocationCountryId
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const WORKDAY_AUTHORITATIVE_EMPTY = Symbol.for('jobverify.workday.authoritative-empty')

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const head = activeHead(html), document = readNativeDocument(html)
  const text = document.text(document.nodes(node => node.tag === 'root')[0])
  return head.titles.length === 1 && /^Polaris Careers - Powersports Jobs & Internships$/i.test(head.titles[0])
    && document.nodes(node => node.tag === 'h1' && document.text(node) === 'Find your Next Job at Polaris').length > 0
    && text.includes('Job Categories')
    && text.includes('Locations')
    && text.includes('Search Jobs Now')
  }

export const hasCloudflareBlockSignal = (html = '') => {
  const page = String(html ?? '')
  return /Attention Required!\s*\|\s*Cloudflare/i.test(page)
    && /Sorry, you have been blocked/i.test(page)
    && /unable to access\s+polaris\.com/i.test(page)
  }

export const hasAcceptedCareersShellSignal = (html = '') =>
  hasOfficialCareersSignal(html) && !hasCloudflareBlockSignal(html)

export const isExpectedFirstPartyBlockError = (error) => {
  const message = String(error?.message ?? '')
  return /HTTP 403 for https:\/\/www\.polaris\.com\/en-us\/careers\/?/i.test(message)
}

export const hasOfficialWorkdayBoardSignal = (html = '') => {
  const document = readNativeDocument(html)
  const links = document.nodes(node => node.tag === 'link' && node.attrs.rel?.toLowerCase() === 'canonical')
  const titles = activeHead(html).metas.filter(attrs => attrs.property?.toLowerCase() === 'og:title')
  return links.length === 1 && links[0].attrs.href === WORKDAY_BOARD_URL
    && titles.length === 1 && titles[0].content === 'Polaris Jobs'
    && hasDeclaredPolarisAccount(document)
  }

export const buildScraperOptions = () => ({
  company: COMPANY_NAME,
  baseUrl: WORKDAY_BOARD_URL,
  locationCountry: INDIA_LOCATION_COUNTRY,
  source: SOURCE,
  scraperDir: SCRAPER_DIR,
})

const defaultFetchText = async (url, { signal } = {}) => {
  const requestSignal = composeAbortSignals(signal, createTimeoutSignal(15000))
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'omit',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
    signal: requestSignal,
  })

  if (response.status !== 200 || response.url !== url) {
    try { Promise.resolve(response.body?.cancel()).catch(() => {}) } catch {}
    if (response.status !== 200) {
      throw Object.assign(new Error(`HTTP ${response.status} for ${url}`), {
        status: response.status, requestUrl: url, abortRetries: true,
      })
    }
    throw Object.assign(new Error(`Polaris public response identity changed for ${url}`), {
      requestUrl: url, abortRetries: true,
    })
  }
  return response.text()
}

export const createPolarisScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    workdayRunner = runWorkdayScraper,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const fetchVerifiedText = async (url) => {
      signal?.throwIfAborted()
      const html = await (signal === undefined ? fetchText(url) : fetchText(url, { signal }))
      signal?.throwIfAborted()
      return html
    }
    const careersHtml = await fetchVerifiedText(CAREERS_URL)

    if (!hasAcceptedCareersShellSignal(careersHtml)) {
      throw new Error('Polaris verified first-party careers shell changed materially')
    }

    const workdayBoardHtml = await fetchVerifiedText(WORKDAY_BOARD_URL)
    assertWorkdayPageAvailable({ status: 200, html: workdayBoardHtml, url: WORKDAY_BOARD_URL }, { source: SOURCE })
    if (!hasOfficialWorkdayBoardSignal(workdayBoardHtml)) {
      throw new Error('Polaris verified public Workday board changed materially')
    }

    const jobs = await workdayRunner({
      ...buildScraperOptions(),
      ...(signal === undefined ? {} : { signal }),
    })
    signal?.throwIfAborted()
    const normalizedJobs = Array.isArray(jobs)
      ? mapJobsWithInventoryEvidence(jobs, (job) => (job?.scrapedAt ? job : { ...job, scrapedAt: now() }))
      : []
    if (jobs?.[WORKDAY_AUTHORITATIVE_EMPTY] === true) {
      Object.defineProperty(normalizedJobs, WORKDAY_AUTHORITATIVE_EMPTY, {
        value: true,
      })
    }
    return normalizedJobs
  },
})

export const run = async (options = {}) => createPolarisScraper(options).run(options)

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
