import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_DNS_LOOKUP_TIMEOUT_MS,
  resolveHostAddressesWithTimeout,
} from '../../scraper-support/utils/dnsHostResolution.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ssjedustationedtechpvtltd'
export const COMPANY = 'SSJ EduStation Edtech Pvt ltd'
export const VERIFIED_ON = '2026-07-13'
export const VERIFIED_SURFACE_SUMMARY =
  'No trustworthy first-party public careers surface was discoverable on July 13, 2026, and the canonical SSJ EduStation hostnames did not resolve.'
export const DNS_LOOKUP_TIMEOUT_MS = DEFAULT_DNS_LOOKUP_TIMEOUT_MS
export const CAREER_HOSTS = [
  'ssjedustation.com',
  'www.ssjedustation.com',
  'ssjedustation.in',
  'www.ssjedustation.in',
  'ssjedustation.co.in',
  'www.ssjedustation.co.in',
  'ssjedustationedtech.com',
  'www.ssjedustationedtech.com',
  'ssjedustationedtech.in',
  'www.ssjedustationedtech.in',
  'ssjedustationedtech.co.in',
  'www.ssjedustationedtech.co.in',
]

export const hasResolvableFirstPartyHost = (addresses) =>
  Array.isArray(addresses) && addresses.length > 0

export const resolveCanonicalHosts = async (
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

export const createSsjEduStationEdtechScraper = () => ({
  async run({
    resolveHosts = resolveCanonicalHosts,
  } = {}) {
    const addresses = await resolveHosts(CAREER_HOSTS)

    if (hasResolvableFirstPartyHost(addresses)) {
      throw new Error(
        'SSJ EduStation Edtech Pvt ltd canonical first-party hosts now resolve; re-verify the official careers surface before trusting []',
      )
    }

    return []
  },
})

export const run = async () => createSsjEduStationEdtechScraper().run()

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
