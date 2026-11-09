import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SOSTRONK_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SOSTRONK_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const CHANGELOG_URL = PROVIDER_METADATA.changelogUrl
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const FIRST_PARTY_TIMEOUT_URLS = PROVIDER_METADATA.firstPartyTimeoutUrls
export const PARKING_URL = 'https://www.sostronk.com/lander'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const hasPublicJobsSignal = (html = '') => /current openings|apply now|careers|jobs/i.test(normalizeWhitespace(html))

export const hasOfficialChangelogSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('SoStronk release notes')
    && normalized.includes('Karan, Co-Founder & CTO')
    && normalized.includes('www.sostronk.com')
}

export const hasVerifiedParkingRedirectShell = (html = '') =>
  /window\.location\.href\s*=\s*["']\/lander["']/i.test(String(html ?? ''))

export const hasVerifiedParkingLander = (html = '') => {
  const page = String(html ?? '')
  return /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(page)
    && /https:\/\/img1\.wsimg\.com\/parking-lander\/static\/js\/main\.[a-z0-9]+\.js/i.test(page)
    && /https:\/\/img1\.wsimg\.com\/parking-lander\/static\/css\/main\.[a-z0-9]+\.css/i.test(page)
    && /<div\s+id=["']root["']><\/div>/i.test(page)
}

export const isExpectedBlockedSurface = ({ errorKind, status } = {}) =>
  status == null && (errorKind === 'timeout' || errorKind === 'tls')

export const isExpectedTimedOutSurface = ({ errorKind, status } = {}) =>
  errorKind === 'timeout' && status == null

export const isUnexpectedReachableSurface = ({ status, html } = {}) =>
  Number(status) >= 200 && Number(status) < 400 && normalizeWhitespace(html).length >= 0

const defaultProbeUrl = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    })

    return {
      url,
      finalUrl: response.url,
      status: response.status,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    const errorCode = String(error?.cause?.code ?? '')
    const message = String(error?.cause?.message ?? error?.message ?? '')
    const normalized = `${errorCode} ${message}`.toLowerCase()
    const errorKind = /timed out|timeout|abort/i.test(normalized)
      ? 'timeout'
      : /enotfound|could not resolve host|getaddrinfo/i.test(normalized)
        ? 'dns'
        : /certificate|ssl|tls|secure tls connection/i.test(normalized) || errorCode === 'ECONNRESET'
          ? 'tls'
          : 'network'

    return {
      url,
      finalUrl: url,
      status: null,
      html: null,
      errorKind,
      message,
    }
  }
}

export const createSostronkScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    let parkingVerified = false

    for (const url of FIRST_PARTY_TIMEOUT_URLS) {
      const result = await probeUrl(url)

      if (url === CHANGELOG_URL) {
        if (Number(result?.status) === 200 && hasOfficialChangelogSignal(result?.html)) {
          continue
        }

        if (parkingVerified && result?.status == null && result?.errorKind === 'dns') {
          continue
        }

        throw new Error('Sostronk verified branded changelog surface changed materially')
      }

      if (isExpectedBlockedSurface(result)) continue

      if (Number(result?.status) === 200 && hasVerifiedParkingRedirectShell(result?.html)) {
        if (!parkingVerified) {
          const parkingPage = await probeUrl(PARKING_URL)
          if (Number(parkingPage?.status) !== 200 || !hasVerifiedParkingLander(parkingPage?.html)) {
            throw new Error('Sostronk exact-name domain parking handoff changed materially')
          }
          parkingVerified = true
        }
        continue
      }

      if (isUnexpectedReachableSurface(result)) {
        if (url.includes('/careers') || url.includes('/jobs') || hasPublicJobsSignal(result.html)) {
          throw new Error('Sostronk public jobs surface appeared on a previously timed-out route')
        }

        throw new Error('Sostronk official first-party route changed materially and must be re-verified')
      }

      throw new Error('Sostronk verified blocked first-party surface changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createSostronkScraper().run(options)

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
