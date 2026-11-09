import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_DNS_LOOKUP_TIMEOUT_MS,
  resolveHostAddressesWithTimeout,
} from '../../scraper-support/utils/dnsHostResolution.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'datumadvancedcomposites'
export const COMPANY = 'Datum Advanced Composites'
export const VERIFIED_ON = '2026-07-13'
export const VERIFIED_SURFACE_SUMMARY =
  'No trustworthy public first-party careers surface was discoverable on July 13, 2026, and the verified canonical company hostnames did not resolve.'
export const DNS_LOOKUP_TIMEOUT_MS = DEFAULT_DNS_LOOKUP_TIMEOUT_MS
export const CAREER_HOSTS = [
  'datumadvancedcomposites.com',
  'www.datumadvancedcomposites.com',
  'datumadvancedcomposites.in',
  'www.datumadvancedcomposites.in',
  'datumadvancedcomposites.co.in',
  'www.datumadvancedcomposites.co.in',
  'datumcomposites.com',
  'www.datumcomposites.com',
  'datumcomposites.in',
  'www.datumcomposites.in',
]

export const hasResolvableFirstPartyHost = (addresses) =>
  Array.isArray(addresses) && addresses.length > 0

export const resolveCareerHosts = async (
  hosts = CAREER_HOSTS,
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

export const createDatumAdvancedCompositesScraper = () => ({
  async run({
    resolveHosts = resolveCareerHosts,
  } = {}) {
    const addresses = await resolveHosts(CAREER_HOSTS)

    if (hasResolvableFirstPartyHost(addresses)) {
      throw new Error(
        'Datum Advanced Composites canonical first-party hosts now resolve; re-verify the official careers surface before trusting []',
      )
    }

    return []
  },
})

export const run = async () => createDatumAdvancedCompositesScraper().run()

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
