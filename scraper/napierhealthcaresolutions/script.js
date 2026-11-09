import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const findErrorInChain = (error, predicate) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    if (predicate(current)) return current
    current = current?.cause
  }

  return null
}

const hasHttpStatus = (error, status) =>
  Boolean(findErrorInChain(error, (candidate) => Number(candidate?.status) === status))

const createUpstreamUnavailableError = (message, cause) => Object.assign(
  new Error(message, { cause }),
  {
    code: 'NAPIER_CAREERS_UNAVAILABLE',
    failureType: 'upstream_unavailable',
    failureKind: 'upstream_unavailable',
    softFailure: true,
    upstreamOutage: true,
    abortRetries: true,
  },
)

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /careers/i.test(page)
    && /Napier/i.test(page)
    && /VIEW ALL OPENINGS/i.test(text)
    && /current openings/i.test(text)
    && /LinkedIn/i.test(text)
}

export const extractSameDomainJobLinks = (html = '') => [...new Set(
  [...String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1]))
    .filter(Boolean)
    .filter((url) => /napierhealthcare\.com/i.test(url))
    .filter((url) => /(jobs?|openings?|positions?|vacanc|apply)/i.test(url))
    .filter((url) => url !== CAREERS_URL),
)].filter((url) => !url.startsWith(`${CAREERS_URL}#`))
 

export const run = async ({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) => {
  let careersHtml
  try {
    careersHtml = await fetchText(CAREERS_URL)
  } catch (error) {
    if (hasHttpStatus(error, 404)) {
      const unavailableError = createUpstreamUnavailableError(
        'Napier Healthcare Solutions careers route is currently unavailable upstream',
        error,
      )
      return attachInventoryEvidence([], {
        status: 'discovery-only',
        surface: CAREERS_URL,
        firstParty: true,
        listingComplete: false,
        pagesFetched: 0,
        reportedTotal: null,
        indiaFacetCount: null,
        verifiedAt: now(),
        reason: unavailableError.message,
      })
    }
    throw error
  }

  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('Napier verified careers page no longer matches the trusted first-party surface')
  }

  const publicJobLinks = extractSameDomainJobLinks(careersHtml)
  if (publicJobLinks.length > 0) {
    throw new Error('Napier public jobs surface changed materially; replace the fail-closed sentinel with a real scraper')
  }

  return []
}

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
