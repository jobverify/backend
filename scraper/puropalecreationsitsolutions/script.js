export const SOURCE = 'puropalecreationsitsolutions'
export const COMPANY = 'Puropale Creations & IT Solutions'
export const HOMEPAGE_URL = 'https://puropale.com/'
export const CAREER_ROUTE_CANDIDATES = [
  HOMEPAGE_URL,
  'https://puropale.com/careers',
  'https://puropale.com/jobs',
  'https://puropale.com/contact',
]

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Puropale',
  adapter: 'script',
  modulePath: '../../scraper/puropalecreationsitsolutions/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: HOMEPAGE_URL,
  atsPlatform: 'official-company-site-unreachable',
  countryFilter: 'India',
  paginationStrategy: 'fail-closed-sentinel',
  extractionStrategy: 'verified-official-domain-unreachable+no-public-jobs-surface+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'puropale.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that the official Puropale domain published on the company LinkedIn page was https://puropale.com/, but live checks to https://puropale.com/, https://puropale.com/careers, https://puropale.com/jobs, and https://puropale.com/contact all failed with DNS-resolution errors and exposed no reachable first-party public jobs surface. This provider therefore remains fail-closed until the official domain resolves and publishes trustworthy openings.',
  dryRunFile: 'puropalecreationsitsolutions/jobs.json',
}

const UNREACHABLE_ERROR_PATTERNS = [
  /getaddrinfo/i,
  /enotfound/i,
  /dns/i,
  /name could not be resolved/i,
  /fetch failed/i,
]

export const isUnreachableSurfaceError = (error) =>
  UNREACHABLE_ERROR_PATTERNS.some((pattern) => pattern.test(String(error?.message ?? error ?? '')))

export const createPuropaleCreationsItSolutionsScraper = () => ({
  async run({
    fetchText = async (url) => {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return response.text()
    },
  } = {}) {
    let sawUnreachableError = false

    for (const url of CAREER_ROUTE_CANDIDATES) {
      try {
        await fetchText(url)
        throw new Error('Puropale Creations & IT Solutions first-party domain became reachable and needs reassessment')
      } catch (error) {
        if (isUnreachableSurfaceError(error)) {
          sawUnreachableError = true
          continue
        }

        throw error
      }
    }

    if (!sawUnreachableError) {
      throw new Error('Puropale Creations & IT Solutions unreachable-domain contract no longer matches the verified surface')
    }

    return []
  },
})

export const run = async (options = {}) => createPuropaleCreationsItSolutionsScraper().run(options)

