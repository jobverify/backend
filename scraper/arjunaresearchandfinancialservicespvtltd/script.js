import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveHostAddressesWithTimeout } from '../../scraper-support/utils/dnsHostResolution.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'arjunaresearchandfinancialservicespvtltd'
export const COMPANY = 'Arjuna Research and Financial Services Pvt Ltd'
export const VERIFIED_ON = '2026-07-13'
export const VERIFIED_SURFACE_SUMMARY =
  'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical company hostnames did not resolve.'
export const DNS_LOOKUP_TIMEOUT_MS = 5000
export const CAREER_HOSTS = [
  'arjunaresearch.com',
  'www.arjunaresearch.com',
  'arjunaresearch.in',
  'www.arjunaresearch.in',
  'arjunaresearchandfinancialservices.com',
  'www.arjunaresearchandfinancialservices.com',
  'arjunaresearchandfinancialservices.in',
  'www.arjunaresearchandfinancialservices.in',
]

export const hasResolvableFirstPartyHost = (addresses) =>
  Array.isArray(addresses) && addresses.length > 0

export const resolveCanonicalHosts = async (
  hosts = CAREER_HOSTS,
  {
    resolveIpv4,
    resolveIpv6,
    lookupTimeoutMs = DNS_LOOKUP_TIMEOUT_MS,
  } = {},
) => resolveHostAddressesWithTimeout(hosts, {
  resolve4Impl: resolveIpv4,
  resolve6Impl: resolveIpv6,
  timeoutMs: lookupTimeoutMs,
})

export const createArjunaResearchAndFinancialServicesScraper = () => ({
  async run({
    resolveHosts = resolveCanonicalHosts,
    lookupTimeoutMs = DNS_LOOKUP_TIMEOUT_MS,
  } = {}) {
    const addresses = await resolveHosts(CAREER_HOSTS, { lookupTimeoutMs })

    if (hasResolvableFirstPartyHost(addresses)) {
      throw new Error(
        'Arjuna Research and Financial Services Pvt Ltd canonical first-party hosts now resolve; re-verify the official careers surface before trusting []',
      )
    }

    return []
  },
})

export const run = async () => createArjunaResearchAndFinancialServicesScraper().run()

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
