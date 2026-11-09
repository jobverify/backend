import path from 'node:path'
import { resolve4, resolve6 } from 'node:dns/promises'
import { fileURLToPath } from 'node:url'

import ECM_DATA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ECM_DATA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

export const CLOUDFLARE_522_URLS = [
  'https://ecmdata.com/',
  'https://www.ecmdata.com/',
  'https://ecmdata.com/careers',
  'https://www.ecmdata.com/careers',
  'https://ecmdata.com/jobs',
  'https://www.ecmdata.com/jobs',
  'https://ecmdata.com/robots.txt',
  'https://www.ecmdata.com/robots.txt',
]

export const UNRESOLVED_VARIANT_HOSTS = [
  'ecmdata.in',
  'www.ecmdata.in',
  'ecmdata.co.in',
  'www.ecmdata.co.in',
  'ecmdataindia.com',
  'www.ecmdataindia.com',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 30000
const DNS_TIMEOUT_MS = 2500

const isTimeoutError = (error) => {
  if (error?.name === 'AbortError') return true

  const message = String(error?.message ?? error ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')

  return /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i.test(message)
    || /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i.test(causeMessage)
    || /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(causeCode)
}

const defaultProbeUrl = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      headers: {
        server: response.headers.get('server'),
      },
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    if (isTimeoutError(error)) {
      return {
        url,
        finalUrl: url,
        status: null,
        headers: {},
        html: null,
        errorKind: 'timeout',
      }
    }

    const cause = String(error?.cause?.message ?? error?.message ?? error)
    if (/ENOTFOUND|getaddrinfo|DNS name does not exist/i.test(cause)) {
      return {
        url,
        finalUrl: url,
        status: null,
        headers: {},
        html: null,
        errorKind: 'dns',
      }
    }

    return {
      url,
      finalUrl: url,
      status: null,
      headers: {},
      html: null,
      errorKind: 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

export const isExpectedCloudflare522Surface = (surface = {}) =>
  Number(surface?.status) === 522
  && /cloudflare/i.test(String(surface?.headers?.server ?? surface?.server ?? ''))

export const isExpectedUnavailableExactNameSurface = (surface = {}) =>
  isExpectedCloudflare522Surface(surface)
  || surface?.errorKind === 'timeout'

export const hasResolvableVariantHost = (addresses) =>
  Array.isArray(addresses) && addresses.length > 0

export const resolveHosts = async (hosts = UNRESOLVED_VARIANT_HOSTS) => {
  const withTimeout = async (promiseFactory, timeoutMs = DNS_TIMEOUT_MS) => {
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve([]), timeoutMs)
    })

    try {
      const result = await Promise.race([
        promiseFactory(),
        timeoutPromise,
      ])
      return Array.isArray(result) ? result : []
    } catch {
      return []
    }
  }

  const addresses = new Set()

  const hostLookups = await Promise.all(
    hosts.map(async (host) => [
      ...(await withTimeout(() => resolve4(host))),
      ...(await withTimeout(() => resolve6(host))),
    ]),
  )

  for (const hostAddresses of hostLookups) {
    for (const address of hostAddresses) {
      addresses.add(address)
    }
  }

  return [...addresses]
}

const assertVerifiedCloudflare522Surface = (surface, label) => {
  if (isExpectedUnavailableExactNameSurface(surface)) return

  if (Number.isInteger(surface?.status) && surface.status > 0) {
    throw new Error(
      `${COMPANY} ${label} now appears reachable or exposes a public jobs surface: ${surface.finalUrl || surface.url}`,
    )
  }

  throw new Error(
    `${COMPANY} verified exact-name first-party surface changed materially: ${surface?.url ?? 'unknown-url'}`,
  )
}

export const createEcmDataScraper = () => ({
  async run({
    probeUrl = defaultProbeUrl,
    resolveHosts: overrideResolveHosts = resolveHosts,
  } = {}) {
    const surfaces = await Promise.all(
      CLOUDFLARE_522_URLS.map((url) => probeUrl(url)),
    )

    for (const surface of surfaces) {
      assertVerifiedCloudflare522Surface(surface, 'verified exact-name first-party surface')
    }

    const resolvedVariantAddresses = await overrideResolveHosts(UNRESOLVED_VARIANT_HOSTS)
    if (hasResolvableVariantHost(resolvedVariantAddresses)) {
      throw new Error(
        'ECM Data India exact-name variant hosts now resolve and the official surface must be re-verified before trusting []',
      )
    }

    return []
  },
})

export const run = async (options = {}) => createEcmDataScraper().run(options)

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
