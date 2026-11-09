import PROVIDER_METADATA from './catalog.js'
export { PROVIDER_METADATA }
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'jmbaxiheavy'
export const COMPANY = 'JM Baxi Heavy'
export const HOMEPAGE_URL = 'https://www.jmbaxi.com/'
export const CAREERS_URL = 'https://www.jmbaxi.com/career/'
export const JOB_SEARCH_URL = 'https://www.jmbaxi.com/career/job-search.html'
export const JOB_LIST_URL =
  'https://www.jmbaxi.com/career/job-list.html?home_action=home_search&home_department=Engineering'
export const JOB_LIST_POST_URL = 'https://www.jmbaxi.com/career/job-list.html'
export const RESUME_SUBMIT_URL =
  'https://jmbone.darwinbox.in/ms/candidate/careers/others?apply=1'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_PAGE_SIGNALS = [
  '<title>careers | j m baxi</title>',
  'harboring talent, fostering careers',
  'explore, engage, excel',
  'job search',
]

const JOB_LIST_SHELL_SIGNALS = [
  'explore your future with j m baxi group',
  'thanks for checking out our job openings',
  "var home_department = 'engineering'",
  "action: 'joblist'",
  RESUME_SUBMIT_URL,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|â€™|â€˜|’|‘/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePage = (value) => normalizeWhitespace(value).toLowerCase()

const hasAllSignals = (html, signals) => {
  const raw = String(html ?? '').toLowerCase()
  const page = normalizePage(html)
  return signals.every((signal) => raw.includes(signal) || page.includes(signal))
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

const coercePageResponse = (page, url) => {
  if (typeof page === 'string') {
    return {
      status: 200,
      url,
      headers: {},
      html: page,
    }
  }

  return {
    status: Number(page?.status ?? 200),
    url: page?.url || url,
    headers: page?.headers || {},
    html: String(page?.html ?? ''),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = normalizePage(html)

  return page.includes('home | j m baxi')
    && (
      page.includes('welcome to j m baxi group')
      || page.includes('j m baxi group, founded in 1916')
      || page.includes('founded in 1916')
    )
    && (
      page.includes('creating opportunities')
      || page.includes("india's maritime and trade landscape")
    )
}

export const hasCareersPageSignal = (html) => hasAllSignals(html, CAREERS_PAGE_SIGNALS)

export const hasJobSearchPageSignal = (html) => {
  const page = normalizePage(html)
  const raw = String(html ?? '')
  if (page.includes('job search | j m baxi') && page.includes('land your dream job')
    && /<form\b[^>]*action=["']job-list\.html["'][^>]*method=["']post["']/i.test(raw)
    && /<input\b[^>]*name=["']home_action["'][^>]*value=["']home_search["']/i.test(raw)
    && /<select\b[^>]*name=["']home_department["']/i.test(raw)
    && /<select\b[^>]*name=["']home_location_city["']/i.test(raw)) return true

  return page.includes('job search | j m baxi')
    && page.includes('land your dream job')
    && page.includes('select department')
    && (
      page.includes('select department engineering')
      || page.includes('select department operations')
      || page.includes('find authentic jobs')
    )
    && (
      page.includes('select location navi mumbai')
      || page.includes('find authentic jobs')
      || page.includes('j m baxi prides itself')
    )
}

export const hasJobListShellSignal = (html) => {
  const raw = String(html ?? '').toLowerCase()
  const page = normalizePage(html)

  return (
    raw.includes('<title>job search | j m baxi</title>')
    || raw.includes('<title>job list | j m baxi</title>')
    || page.includes('job search | j m baxi')
    || page.includes('job list | j m baxi')
  ) && hasAllSignals(html, JOB_LIST_SHELL_SIGNALS)
}

export const buildJobListRequestBody = ({
  searchByText = '',
  selectedDesignationOpt = [],
  selectedDepartmentOpt = ['Engineering'],
  selectedLocationOpt = [],
  page = 1,
} = {}) => new URLSearchParams({
  action: 'joblist',
  search_by_text: searchByText,
  selectedDesignationOpt: JSON.stringify(selectedDesignationOpt),
  selectedDepartmentOpt: JSON.stringify(selectedDepartmentOpt),
  selectedLocationOpt: JSON.stringify(selectedLocationOpt),
  page: String(page),
}).toString()

export const isVerifiedNoJobsResponse = (payload = {}) =>
  String(payload?.jobshtml ?? '').toLowerCase().includes('no-data-found')
  && Number(payload?.totalPages) === 0
  && (payload?.totalRecords == null || Number(payload.totalRecords) === 0)

export const createJmBaxiHeavyScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const homepage = coercePageResponse(await fetchText(HOMEPAGE_URL), HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('JM Baxi Heavy verified official homepage no longer matches the known public surface')
    }

    const careersPage = coercePageResponse(await fetchText(CAREERS_URL), CAREERS_URL)
    if (careersPage.status !== 200 || !hasCareersPageSignal(careersPage.html)) {
      throw new Error('JM Baxi Heavy verified careers page no longer matches the known public surface')
    }

    const jobSearchPage = coercePageResponse(await fetchText(JOB_SEARCH_URL), JOB_SEARCH_URL)
    if (jobSearchPage.status !== 200 || !hasJobSearchPageSignal(jobSearchPage.html)) {
      throw new Error('JM Baxi Heavy verified job search page no longer matches the known public surface')
    }

    const jobListPage = coercePageResponse(await fetchText(JOB_LIST_URL), JOB_LIST_URL)
    if (jobListPage.status !== 200 || !hasJobListShellSignal(jobListPage.html)) {
      throw new Error('JM Baxi Heavy verified job list shell no longer matches the known public surface')
    }

    const response = await fetchJson(JOB_LIST_POST_URL, {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: JOB_LIST_URL,
      },
      body: buildJobListRequestBody(),
    })

    if (!isVerifiedNoJobsResponse(response)) {
      throw new Error('JM Baxi Heavy public job board now exposes public job postings')
    }

    return attachInventoryEvidence([], {
      status: 'verified-empty', surface: JOB_LIST_POST_URL, firstParty: true, listingComplete: true,
      pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0, verifiedAt: new Date().toISOString(),
      reason: 'verified-first-party-Engineering-search-no-data-found-zero-pages',
    })
  },
})

export const run = async (options = {}) => createJmBaxiHeavyScraper().run(options)

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
