import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'chakraventures'
export const COMPANY = 'Chakra Ventures'
export const VERIFIED_AT = '2026-08-13'
export const HOMEPAGE_URL = 'https://chakraventures.com/'
export const CAREERS_URL = 'https://chakraventures.com/careers'
export const JOBS_URL = 'https://chakraventures.com/jobs'
export const LANDER_URL = 'https://chakraventures.com/lander'
export const FIRST_PARTY_TIMEOUT_URLS = [HOMEPAGE_URL, CAREERS_URL, JOBS_URL, LANDER_URL]
const REQUEST_TIMEOUT_MS = 10000
const USER_AGENT = 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)'
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i

const PUBLIC_JOB_LISTINGS_PATTERN =
  /\b(open roles|open positions|current openings|job openings|available positions|apply now|join our team)\b|jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workdayjobs|smartrecruiters|job-boards\.greenhouse\.io/i

const isTimeoutError = (error) => {
  if (error?.name === 'AbortError') return true

  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(causeCode)
    || TIMEOUT_ERROR_PATTERN.test(causeMessage)
    || TIMEOUT_ERROR_PATTERN.test(message)
}

const isReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

export const isExpectedTimedOutSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const hasRedirectToLanderSignal = (html) =>
  /window\.location\.href\s*=\s*["']\/lander["']/i.test(String(html ?? ''))

export const hasParkedLanderSignal = (html) => {
  const page = String(html ?? '')

  return /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(page)
    && /_trfd\.push\(\{ap:\s*["']parking["']\}\)/i.test(page)
    && /img1\.wsimg\.com\/parking-lander/i.test(page)
}

export const hasPublicJobListingsSignal = (html) =>
  PUBLIC_JOB_LISTINGS_PATTERN.test(String(html ?? ''))

const defaultProbeUrl = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    if (isTimeoutError(error)) {
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'timeout',
      }
    }

    throw error
  }
}

export const createChakraVenturesScraper = () => ({
  async run({ probeUrl, fetchText } = {}) {
    const loadSurface = probeUrl ?? (
      fetchText
        ? async (url) => ({
          url,
          finalUrl: url,
          status: 200,
          html: await fetchText(url),
          errorKind: null,
        })
        : defaultProbeUrl
    )

    const homepage = await loadSurface(HOMEPAGE_URL)
    const careers = await loadSurface(CAREERS_URL)
    const jobs = await loadSurface(JOBS_URL)

    if (
      (isReachableSurface(homepage) && hasPublicJobListingsSignal(homepage.html))
      || (isReachableSurface(careers) && hasPublicJobListingsSignal(careers.html))
      || (isReachableSurface(jobs) && hasPublicJobListingsSignal(jobs.html))
    ) {
      throw new Error('Chakra Ventures first-party routes now appear to expose public jobs')
    }

    if (
      (!isExpectedTimedOutSurface(homepage) && !hasRedirectToLanderSignal(homepage.html))
      || (!isExpectedTimedOutSurface(careers) && !hasRedirectToLanderSignal(careers.html))
      || (!isExpectedTimedOutSurface(jobs) && !hasRedirectToLanderSignal(jobs.html))
    ) {
      throw new Error('Chakra Ventures verified parked first-party surface changed')
    }

    const lander = await loadSurface(LANDER_URL)

    if (isReachableSurface(lander) && hasPublicJobListingsSignal(lander.html)) {
      throw new Error('Chakra Ventures parked lander now appears to expose public jobs')
    }

    if (!isExpectedTimedOutSurface(lander) && !hasParkedLanderSignal(lander.html)) {
      throw new Error('Chakra Ventures parked lander no longer matches the verified first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createChakraVenturesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Chakra Ventures scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
