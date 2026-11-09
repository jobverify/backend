import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { STACKPATH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = STACKPATH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const FIRST_PARTY_ROOT_URL = 'https://www.stackpath.com/'
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://www.stackpath.com/careers',
  'https://www.stackpath.com/jobs',
  'https://www.stackpath.com/about/careers',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasVerifiedRootShell = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /background-color:\s*#0a0100/i.test(page)
    && page.includes('id="isPasted"')
    && page.includes('font-size: 96px;')
    && !/404 ERROR/i.test(page)
    && !/careers|jobs|open positions|vacancies|apply/i.test(normalized)
}

export const isVerifiedMissingJobRoute = (surface = {}) => {
  const page = String(surface?.html ?? '')
  const normalized = normalizeWhitespace(page)

  return surface?.status === 404
    && /background-color:\s*#0a0100/i.test(page)
    && /404 ERROR/i.test(page)
    && normalized.includes('Sorry the page you are looking is no longer here.')
}

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

    return {
      url,
      finalUrl: url,
      status: null,
      html: null,
      errorKind: error?.name === 'AbortError' ? 'timeout' : 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

export const createStackPathScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    const rootSurface = await probeUrl(FIRST_PARTY_ROOT_URL)
    if (rootSurface.status !== 200 || !hasVerifiedRootShell(rootSurface.html)) {
      if (isUnexpectedReachableSurface(rootSurface)) {
        throw new Error(`StackPath exact-name first-party root changed materially or now exposes a public jobs surface: ${rootSurface.finalUrl || rootSurface.url}`)
      }
      throw new Error(`StackPath verified exact-name first-party root changed materially: ${rootSurface.url}`)
    }

    for (const url of NO_PUBLIC_JOB_ROUTE_URLS) {
      const surface = await probeUrl(url)
      if (isVerifiedMissingJobRoute(surface)) continue

      if (isUnexpectedReachableSurface(surface)) {
        throw new Error(`StackPath common careers route now exposes a public jobs surface: ${surface.finalUrl || surface.url}`)
      }

      throw new Error(`StackPath verified missing careers route changed materially: ${surface.url}`)
    }

    return []
  },
})

export const run = async (options = {}) => createStackPathScraper().run(options)

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
