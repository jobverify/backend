import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AMERICAN_INFO_SOURCE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AMERICAN_INFO_SOURCE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const FIRST_PARTY_ROOT_URLS = [
  'https://americaninfosource.com/',
]
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://americaninfosource.com/careers',
  'https://americaninfosource.com/jobs',
  'https://americaninfosource.com/employment',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000

export const isExpectedDormantSurface = (surface = {}) =>
  (
    surface?.errorKind === 'timeout'
    && !Number.isInteger(surface?.status)
    && surface?.html == null
  )
  || (
    surface?.status === 404
    && /not found/i.test(String(surface?.html ?? ''))
  )

export const isUnexpectedReachableSurface = (surface = {}) =>
  Number.isInteger(surface?.status) && surface.status > 0 && surface.status < 400

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
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    if (error?.name === 'AbortError') {
      return { url, finalUrl: url, status: null, html: null, errorKind: 'timeout' }
    }

    return {
      url,
      finalUrl: url,
      status: null,
      html: null,
      errorKind: 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

const assertVerifiedDormantSurface = (surface, label) => {
  if (isExpectedDormantSurface(surface)) return

  if (isUnexpectedReachableSurface(surface)) {
    throw new Error(`American InfoSource ${label} now appears to expose a public jobs surface: ${surface.finalUrl || surface.url}`)
  }

  throw new Error(`American InfoSource verified dormant surface changed materially: ${surface.url}`)
}

export const createAmericanInfoSourceScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    const surfaces = [
      ...FIRST_PARTY_ROOT_URLS,
      ...NO_PUBLIC_JOB_ROUTE_URLS,
    ]

    for (const url of surfaces) {
      const surface = await probeUrl(url)
      assertVerifiedDormantSurface(surface, 'public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createAmericanInfoSourceScraper().run(options)

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
