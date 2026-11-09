import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sahayconsultancy'
export const COMPANY = 'Sahay Consultancy'
export const DOMAIN_CANDIDATES = [
  'https://www.sahayconsultancy.com/',
  'https://sahayconsultancy.com/',
  'https://www.sahayconsultancy.in/',
  'https://sahayconsultancy.in/',
  'https://www.sahayconsultancy.co.in/',
  'https://sahayconsultancy.co.in/',
]
export const CAREERS_ROUTE_PATHS = [
  'careers',
  'career',
  'jobs',
  'join-us',
  'work-with-us',
  'openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(timeoutMs),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const buildCareerRouteUrls = (rootUrl) =>
  CAREERS_ROUTE_PATHS.map((pathSegment) => new URL(pathSegment, rootUrl).toString().replace(/\/$/, ''))

export const isUnresolvableHostError = (error) => {
  const message = typeof error === 'string'
    ? error
    : [
        error?.message,
        error?.cause?.message,
        error?.code,
        error?.cause?.code,
      ].filter(Boolean).join(' ')

  return /remote name could not be resolved/i.test(message)
    || /getaddrinfo\s+enotfound/i.test(message)
    || /enotfound/i.test(message)
    || /dns/i.test(message)
}

const isExplicitMissingPage = (page) => Number(page?.status) === 404 || Number(page?.status) === 410

export const createSahayConsultancyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const rootUrl of DOMAIN_CANDIDATES) {
      try {
        const rootPage = await fetchPage(rootUrl)

        if (!isExplicitMissingPage(rootPage)) {
          throw new Error(`Sahay Consultancy exact-match first-party domain now resolves: ${rootUrl}`)
        }

        for (const careersUrl of buildCareerRouteUrls(rootUrl)) {
          const careersPage = await fetchPage(careersUrl)

          if (!isExplicitMissingPage(careersPage)) {
            throw new Error(`Sahay Consultancy careers route now resolves: ${careersUrl}`)
          }
        }
      } catch (error) {
        if (isUnresolvableHostError(error)) {
          continue
        }

        throw error
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSahayConsultancyScraper().run(options)

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
