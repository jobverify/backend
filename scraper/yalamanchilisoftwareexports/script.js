import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = YALAMANCHILI_SOFTWARE_EXPORTS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const FIRST_PARTY_ROOT_URLS = [
  'https://www.yalamanchili.co.in/',
  'https://www.ysppayments.com/',
]
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://www.yalamanchili.co.in/careers',
  'https://www.yalamanchili.co.in/jobs',
  'https://www.yalamanchili.co.in/careers.html',
  'https://www.ysppayments.com/career',
  'https://www.ysppayments.com/careers',
  'https://www.ysppayments.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000

export const isExpectedRedirectedHomepageSurface = (surface = {}) => {
  const finalUrl = String(surface?.finalUrl ?? '')
  const html = String(surface?.html ?? '')
  const visibleText = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return surface?.status === 200
    && finalUrl === 'https://www.ysppayments.com/'
    && /<title[^>]*>\s*YSP\s*\|\s*Yalamanchili Solutions for Payments\s*<\/title>/i.test(html)
    && /Providing enterprise class customizable and scalable end-to-end payment solutions since 1998/i.test(visibleText)
    && !/(career|careers|job|jobs|opening|openings|vacancy|vacancies|join us|work with us)/i.test(visibleText)
}

export const isExpectedDormantSurface = (surface = {}) =>
  (
    surface?.errorKind === 'timeout'
    && !Number.isInteger(surface?.status)
    && surface?.html == null
  )
  || (
    surface?.status === 404
    && (
      !String(surface?.html ?? '').trim()
      || /not found/i.test(String(surface?.html ?? ''))
    )
  )
  || isExpectedRedirectedHomepageSurface(surface)

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
    throw new Error(`Yalamanchili Software Exports ${label} now appears to expose a public jobs surface: ${surface.finalUrl || surface.url}`)
  }

  throw new Error(`Yalamanchili Software Exports verified dormant surface changed materially: ${surface.url}`)
}

export const createYalamanchiliSoftwareExportsScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    const surfaces = [
      ...FIRST_PARTY_ROOT_URLS,
      ...NO_PUBLIC_JOB_ROUTE_URLS,
    ]

    for (const url of surfaces) {
      const label = url === FIRST_PARTY_ROOT_URLS[0] ? 'public jobs surface' : 'public jobs surface'
      const surface = await probeUrl(url)
      assertVerifiedDormantSurface(surface, label)
    }

    return []
  },
})

export const run = async (options = {}) => createYalamanchiliSoftwareExportsScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
