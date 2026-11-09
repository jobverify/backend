import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MAD_STREET_DEN_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MAD_STREET_DEN_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBLIST_API_URL = PROVIDER_METADATA.jobListApiUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const DARWINBOX_PUBLIC_BOARD_URL = PROVIDER_METADATA.darwinboxPublicBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }
    return url.toString()
  } catch {
    return String(value ?? '')
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

const defaultFetchDarwinboxBoardPage = async (url = DARWINBOX_PUBLIC_BOARD_URL) => defaultFetchPage(url)

export const extractOfficialDarwinboxHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/msd\.darwinbox\.in\/ms\/candidate\/careers\/others\?apply=1/i,
  )
  return match?.[0] ?? null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Career\s*-\s*Mad Street Den/i.test(page)
    && text.includes('Careers at Mad Street Den')
    && text.includes('Current Openings')
    && text.includes("If the position that you're looking for is currently unavailable")
    && extractOfficialDarwinboxHandoffUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

export const isVerifiedJobListApiFailure = (response = {}) => {
  if (Number(response?.status) !== 401) return false

  try {
    const payload = JSON.parse(String(response?.html ?? ''))
    return Number(payload?.status) === 0
      && normalizeWhitespace(payload?.message) === 'Invalid Url'
  } catch {
    return /Invalid Url/i.test(String(response?.html ?? ''))
  }
}

export const hasVerifiedDarwinboxEmptyBoardSignal = (text = '') => {
  const normalized = normalizeWhitespace(text)

  return normalized.includes('Search for jobs')
    && normalized.includes('Current Openings')
    && normalized.includes('No jobs found')
    && normalized.includes('Please try using a different set of filter combinations')
    && normalized.includes('Apply here')
    && normalized.includes('Powered by: darwinbox')
}

export const hasVerifiedDarwinboxShellSignal = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalizedText = normalizeWhitespace(rawHtml)
  const normalizedUrl = normalizeComparableUrl(page?.url ?? DARWINBOX_PUBLIC_BOARD_URL)

  if (Number(page?.status) !== 200) {
    return false
  }

  if (
    normalizedUrl !== normalizeComparableUrl(DARWINBOX_PUBLIC_BOARD_URL)
    && normalizedUrl !== 'https://msd.darwinbox.in/ms/candidate/careers'
  ) {
    return false
  }

  const hasLegacyCandidateShell = /<base href="\/ms\/candidate(?:v2)?\/">/i.test(rawHtml)
    && (
      /\/ms\/db-components\/formbuilder\//i.test(rawHtml)
      || /\/ms\/dboxuilibrary\//i.test(rawHtml)
      || /\/ms\/formbuilder\//i.test(rawHtml)
      || /db-components\.esm\.js/i.test(rawHtml)
      || /db-form\.js/i.test(rawHtml)
    )

  const hasBrandedStubShell = /<title>\s*Mad Street Den\s*<\/title>/i.test(rawHtml)
    && /meta property="og:title"\s+content="Mad Street Den\s*"/i.test(rawHtml)
    && /meta property="og:image:alt"\s+content="Mad Street Den"/i.test(rawHtml)
    && /darwinbox-data/i.test(rawHtml)
    && /Mad Street Den\s*-\s*/i.test(normalizedText)

  return (hasLegacyCandidateShell || hasBrandedStubShell)
    && !hasVerifiedDarwinboxEmptyBoardSignal(normalizedText)
}

export const textExposesPublicJobs = (text = '') => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return false
  if (hasVerifiedDarwinboxEmptyBoardSignal(normalized)) return false

  return /\bApply now\b/i.test(normalized)
    || /\bJob Details\b/i.test(normalized)
    || (normalized.includes('Current Openings') && !normalized.includes('No jobs found'))
  }

export const createMadStreetDenScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchDarwinboxBoardPage = defaultFetchDarwinboxBoardPage,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (
      careersPage.status !== 200
      || normalizeComparableUrl(careersPage.url) !== normalizeComparableUrl(CAREERS_URL)
      || !hasOfficialCareersSignal(careersPage.html)
    ) {
      throw new Error('Mad Street Den careers page no longer matches the verified first-party surface')
    }

    const jobListApiResponse = await fetchPage(JOBLIST_API_URL)
    if (!isVerifiedJobListApiFailure(jobListApiResponse)) {
      throw new Error('Mad Street Den joblist API no longer matches the verified invalid-url contract')
    }

    const darwinboxBoardPage = await fetchDarwinboxBoardPage(DARWINBOX_PUBLIC_BOARD_URL)
    const darwinboxBoardText = normalizeWhitespace(darwinboxBoardPage.html)
    const hasVerifiedShell = hasVerifiedDarwinboxShellSignal(darwinboxBoardPage)

    if (!hasVerifiedShell && textExposesPublicJobs(darwinboxBoardText)) {
      throw new Error('Mad Street Den Darwinbox board now exposes public jobs')
    }

    if (!hasVerifiedShell && !hasVerifiedDarwinboxEmptyBoardSignal(darwinboxBoardText)) {
      throw new Error('Mad Street Den Darwinbox board no longer matches the verified empty-state surface')
    }

    return []
  },
})

export const run = async (options = {}) => createMadStreetDenScraper().run(options)

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
