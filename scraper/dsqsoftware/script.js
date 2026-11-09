import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_DNS_LOOKUP_TIMEOUT_MS,
  resolveHostAddressesWithTimeout,
} from '../../scraper-support/utils/dnsHostResolution.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'dsqsoftware'
export const COMPANY = 'DSQ Software'
export const VERIFIED_AT = '2026-07-15'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://dsqsoftware.com/, https://www.dsqsoftware.com/, https://dsqsoftware.com/careers, https://www.dsqsoftware.com/careers, https://dsqsoftware.com/jobs, https://www.dsqsoftware.com/jobs, https://dsqsoftware.co.in/, https://www.dsqsoftware.co.in/, https://dsqsoftware.co.in/careers, https://www.dsqsoftware.co.in/careers, https://dsqworld.com/, https://www.dsqworld.com/, https://dsqworld.com/careers, and https://www.dsqworld.com/careers were all unreachable because their hostnames did not resolve, while Resolve-DnsName also returned DNS name does not exist for dsqsoftware.com, dsqsoftware.co.in, dsqworld.com, and their www/careers/jobs subdomains. No trustworthy public first-party jobs surface was reachable.'
export const DNS_LOOKUP_TIMEOUT_MS = DEFAULT_DNS_LOOKUP_TIMEOUT_MS

export const CANDIDATE_FIRST_PARTY_URLS = [
  'https://dsqsoftware.com/',
  'https://www.dsqsoftware.com/',
  'https://dsqsoftware.com/careers',
  'https://www.dsqsoftware.com/careers',
  'https://dsqsoftware.com/jobs',
  'https://www.dsqsoftware.com/jobs',
  'https://dsqsoftware.co.in/',
  'https://www.dsqsoftware.co.in/',
  'https://dsqsoftware.co.in/careers',
  'https://www.dsqsoftware.co.in/careers',
  'https://dsqworld.com/',
  'https://www.dsqworld.com/',
  'https://dsqworld.com/careers',
  'https://www.dsqworld.com/careers',
]

export const CANDIDATE_FIRST_PARTY_HOSTS = [
  'dsqsoftware.com',
  'www.dsqsoftware.com',
  'careers.dsqsoftware.com',
  'jobs.dsqsoftware.com',
  'dsqsoftware.co.in',
  'www.dsqsoftware.co.in',
  'careers.dsqsoftware.co.in',
  'jobs.dsqsoftware.co.in',
  'dsqworld.com',
  'www.dsqworld.com',
  'careers.dsqworld.com',
  'jobs.dsqworld.com',
]

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: 'https://dsqsoftware.com/',
  companyDomain: 'dsqsoftware.com',
  countryFilter: 'India',
  atsPlatform: 'official-company-site-unresolved',
  paginationStrategy: 'dns-resolution-check',
  extractionStrategy:
    'verified-dsqsoftware-and-dsqworld-first-party-hosts-unresolved-return-empty-until-official-surface-exists',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
}

export const hasResolvableFirstPartyHost = (addresses) =>
  Array.isArray(addresses) && addresses.length > 0

export const resolveHosts = async (
  hosts = CANDIDATE_FIRST_PARTY_HOSTS,
  {
    resolve4Impl,
    resolve6Impl,
    timeoutMs = DNS_LOOKUP_TIMEOUT_MS,
  } = {},
) => resolveHostAddressesWithTimeout(hosts, {
  resolve4Impl,
  resolve6Impl,
  timeoutMs,
})

export const createDsqSoftwareScraper = () => ({
  async run({ resolveHosts: overrideResolveHosts = resolveHosts } = {}) {
    const addresses = await overrideResolveHosts(CANDIDATE_FIRST_PARTY_HOSTS)

    if (hasResolvableFirstPartyHost(addresses)) {
      throw new Error(
        'DSQ Software verified unresolved first-party surface changed; the first-party hosts now resolve and the official careers surface must be re-verified before trusting []',
      )
    }

    return []
  },
})

export const run = async (options = {}) => createDsqSoftwareScraper().run(options)

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
