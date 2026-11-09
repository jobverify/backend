import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'shreeabiramienggineeringworks'
export const COMPANY = 'SHREE ABIRAMI ENGGINEERING WORKS'
export const SEARCH_QUERY = '"SHREE ABIRAMI ENGGINEERING WORKS"'
export const CANDIDATE_COMPANY_URLS = [
  'https://www.shreeabirami.com/',
  'https://shreeabirami.com/',
  'https://www.shreeabirami.co.in/',
  'https://shreeabirami.co.in/',
  'https://www.shreeabirami.in/',
  'https://shreeabirami.in/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const isNxDomainMessage = (value, hostname) => {
  const normalized = String(value ?? '').toLowerCase()
  return (
    normalized.includes('could not be resolved')
    || normalized.includes('enotfound')
    || normalized.includes('getaddrinfo')
  ) && normalized.includes(String(hostname ?? '').toLowerCase())
}

export const isVerifiedNoResolvableFirstPartyDomain = (result) => {
  if (result?.ok !== false || !result?.url) {
    return false
  }

  const hostname = (() => {
    try {
      return new URL(result.url).hostname
    } catch {
      return null
    }
  })()

  if (!hostname) {
    return false
  }

  return isNxDomainMessage(result.errorMessage, hostname)
}

export const isVerifiedNoFirstPartySearchResult = (page) => {
  if (Number(page?.status) !== 200) {
    return false
  }

  const html = String(page?.text ?? '')
  const normalized = normalizeWhitespace(html)
  if (!/^"SHREE ABIRAMI ENGGINEERING WORKS"\s*-\s*Search\b/i.test(normalized)) {
    return false
  }

  const firstPartyPatterns = CANDIDATE_COMPANY_URLS.map(
    (url) => new RegExp(escapeRegex(url), 'i'),
  )

  return firstPartyPatterns.every((pattern) => !pattern.test(html))
}

const defaultProbeUrl = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual',
    })

    return {
      url,
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      text: await response.text(),
    }
  } catch (error) {
    return {
      url,
      ok: false,
      errorMessage: error instanceof Error
        ? String(error.cause?.message || error.message || error)
        : String(error),
    }
  }
}

const defaultSearchWeb = async (query) => {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    url,
    status: response.status,
    text: await response.text(),
  }
}

export const getRunnerMetadata = () => ({
  name: SOURCE,
  dryRunFile: 'jobs.json',
  provider: {
    source: SOURCE,
    companyName: COMPANY,
    companyCareerPage: null,
    alternateCareerPages: CANDIDATE_COMPANY_URLS,
    adapter: 'script',
    atsPlatform: 'no-trustworthy-first-party-public-jobs-surface',
    countryFilter: 'India',
    parser: 'custom-script',
    paginationStrategy: 'none',
    extractionStrategy: 'verified-nxdomain-candidate-domains-plus-no-first-party-search-surface-return-empty',
    normalizationProfile: 'engineering-default',
    companyDomain: null,
  },
})

export const createShreeAbiramiEnggineeringWorksScraper = () => ({
  async run({
    probeUrl = defaultProbeUrl,
    searchWeb = defaultSearchWeb,
  } = {}) {
    for (const url of CANDIDATE_COMPANY_URLS) {
      const result = await probeUrl(url)
      if (!isVerifiedNoResolvableFirstPartyDomain(result)) {
        throw new Error('SHREE ABIRAMI ENGGINEERING WORKS candidate first-party domain now resolves or changed shape')
      }
    }

    const searchPage = await searchWeb(SEARCH_QUERY)
    if (!isVerifiedNoFirstPartySearchResult(searchPage)) {
      throw new Error('SHREE ABIRAMI ENGGINEERING WORKS first-party search result surfaced or search contract drifted')
    }

    return []
  },
})

export const run = async (options = {}) => createShreeAbiramiEnggineeringWorksScraper().run(options)

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
