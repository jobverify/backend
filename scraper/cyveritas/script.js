import path from 'node:path'
import { resolve4, resolve6 } from 'node:dns/promises'
import { fileURLToPath } from 'node:url'

import CYVERITAS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CYVERITAS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl

export const CANDIDATE_FIRST_PARTY_URLS = [
  'https://cyveritas.com/',
  'https://cyveritas.com/careers',
  'https://www.cyveritas.com/',
  'https://www.cyveritas.com/careers',
]

export const CANDIDATE_FIRST_PARTY_HOSTS = [
  'cyveritas.com',
  'www.cyveritas.com',
]

const UNRESOLVED_HOST_PATTERNS = [
  /\bENOTFOUND\b/i,
  /\bEAI_AGAIN\b/i,
  /\bETIMEOUT\b/i,
  /\bECONNREFUSED\b/i,
  /\bDNS name does not exist\b/i,
  /\bCould not resolve host\b/i,
  /\bName or service not known\b/i,
  /\bNXDOMAIN\b/i,
]

const normalizeResolutionError = (error) => [
  error?.message,
  error?.cause?.message,
  error?.code,
  error?.cause?.code,
].filter(Boolean).join(' ')

export const isExpectedUnresolvedHostError = (error) => {
  const message = normalizeResolutionError(error)
  return UNRESOLVED_HOST_PATTERNS.some((pattern) => pattern.test(message))
}

export const hasResolvableFirstPartyHost = (addresses) =>
  Array.isArray(addresses) && addresses.length > 0

export const resolveHostAddresses = async (
  host,
  {
    resolve4Impl = resolve4,
    resolve6Impl = resolve6,
  } = {},
) => {
  const addresses = new Set()
  const unexpectedErrors = []

  for (const resolver of [resolve4Impl, resolve6Impl]) {
    try {
      for (const address of await resolver(host)) {
        addresses.add(address)
      }
    } catch (error) {
      if (!isExpectedUnresolvedHostError(error)) {
        unexpectedErrors.push(error)
      }
    }
  }

  if (addresses.size > 0) {
    return [...addresses]
  }

  if (unexpectedErrors.length > 0) {
    throw unexpectedErrors[0]
  }

  return []
}

export const resolveHosts = async (
  hosts = CANDIDATE_FIRST_PARTY_HOSTS,
  resolverOptions = {},
) => {
  const addresses = new Set()

  for (const host of hosts) {
    for (const address of await resolveHostAddresses(host, resolverOptions)) {
      addresses.add(address)
    }
  }

  return [...addresses]
}

export const createCyveritasScraper = () => ({
  async run({ resolveHosts: overrideResolveHosts = resolveHosts } = {}) {
    const addresses = await overrideResolveHosts(CANDIDATE_FIRST_PARTY_HOSTS)

    if (hasResolvableFirstPartyHost(addresses)) {
      throw new Error(
        'Cyveritas verified unresolved first-party surface changed; the exact-name hosts now resolve and the official careers surface must be re-verified before trusting []',
      )
    }

    return []
  },
})

export const run = async (options = {}) => createCyveritasScraper().run(options)

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
