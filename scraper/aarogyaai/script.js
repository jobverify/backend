import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withUnverifiedPublicSurface } from '../../scraper-support/utils/unverifiedPublicSurface.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aarogyaai'
export const COMPANY = 'AarogyaAI'
export const COMPANY_DOMAIN = 'aarogyaai.com'
export const VERIFIED_AT = null
export const FIRST_PARTY_ROOT_URLS = [
  'https://aarogyaai.com/',
  'https://aarogyaai.in/',
]
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://aarogyaai.com/careers',
  'https://aarogyaai.com/jobs',
  'https://aarogyaai.in/careers',
  'https://aarogyaai.in/jobs',
]
export const SCRAPER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: FIRST_PARTY_ROOT_URLS[0],
  companyDomain: COMPANY_DOMAIN,
  countryFilter: 'India',
  atsPlatform: 'official-company-site-no-public-careers',
  paginationStrategy: 'bounded-configured-root-discovery',
  extractionStrategy:
    'configured-public-root-diagnostic-never-infer-zero-from-timeout',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
}

// Legacy response-shape predicates are diagnostics, never vacancy evidence.
export const isExpectedUnreachableSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

export const isUnexpectedReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0

export const createAarogyaAIScraper = () => ({
  async run(options = {}) {
    return withUnverifiedPublicSurface({source:SOURCE, urls:[FIRST_PARTY_ROOT_URLS[0]], options,
      injected:options.probeUrl ?? options.fetchPage}, async ({read, fail}) => {
      await read(FIRST_PARTY_ROOT_URLS[0])
      throw fail('Configured official first-party root is reachable; public jobs surface and vacancy inventory remain unqualified', {status:200})
    })
  },
})

export const run = async (options = {}) => createAarogyaAIScraper().run(options)

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
