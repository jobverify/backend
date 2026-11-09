export const SOURCE = 'cibersitesindia'
export const COMPANY = 'CIBERsites India'
export const HOMEPAGE_URL = 'https://www.ciber.com/'
export const CAREERS_URL = 'https://www.ciber.com/careers'
export const EXACT_NAME_HOST_URL = 'https://www.cibersites.com/'
export const EXACT_NAME_INDIA_HOST_URL = 'https://www.cibersitesindia.com/'
export const REDIRECT_TARGET_URL = 'https://www.htcinc.com/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'CIBERsites India',
  adapter: 'script',
  modulePath: '../../scraper/cibersitesindia/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'exact-name-domain-redirects-to-acquirer-homepage',
  countryFilter: 'India',
  paginationStrategy: 'exact-name-homepage-and-careers-redirect-validation',
  extractionStrategy: 'verified-ciber-domain-redirect-to-htc+no-exact-name-public-careers+fail-closed-sentinel',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ciber.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.ciber.com/ and https://www.ciber.com/careers both redirected to https://www.htcinc.com/, while exact-name CIBERsites hosts such as https://www.cibersites.com/ and https://www.cibersitesindia.com/ were not publicly reachable. There is no trustworthy exact-name public careers surface for CIBERsites India on the verified date, so this provider remains fail-closed.',
  dryRunFile: 'cibersitesindia/jobs.json',
}

const normalizeFinalUrl = (value) => {
  try {
    const normalized = new URL(String(value ?? ''))
    normalized.hash = ''
    return normalized.toString()
  } catch {
    return null
  }
}

const defaultFetchPage = async (url) => {
  try {
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
  } catch (error) {
    return {
      status: null,
      url: null,
      html: '',
      error,
    }
  }
}

export const isExpectedHtcRedirect = (response = {}) =>
  Number(response?.status) === 200 && normalizeFinalUrl(response?.url) === REDIRECT_TARGET_URL

export const isExpectedUnreachableSurface = (response = {}) =>
  Boolean(response?.error) || !Number.isFinite(Number(response?.status))

export const run = async ({ fetchPage = defaultFetchPage } = {}) => {
  const homepage = await fetchPage(HOMEPAGE_URL)
  if (!isExpectedHtcRedirect(homepage)) {
    throw new Error('CIBERsites India verified exact-name homepage redirect changed materially')
  }

  const careersPage = await fetchPage(CAREERS_URL)
  if (!isExpectedHtcRedirect(careersPage)) {
    throw new Error('CIBERsites India verified exact-name careers redirect changed materially')
  }

  const exactNameHost = await fetchPage(EXACT_NAME_HOST_URL)
  if (!isExpectedUnreachableSurface(exactNameHost)) {
    throw new Error('CIBERsites India exact-name public host became reachable; replace the fail-closed sentinel with a verified scraper')
  }

  const exactNameIndiaHost = await fetchPage(EXACT_NAME_INDIA_HOST_URL)
  if (!isExpectedUnreachableSurface(exactNameIndiaHost)) {
    throw new Error('CIBERsites India exact-name India host became reachable; replace the fail-closed sentinel with a verified scraper')
  }

  return []
}

