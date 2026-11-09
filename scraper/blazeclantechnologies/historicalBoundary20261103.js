import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

import { BLAZECLAN_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BLAZECLAN_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const BROKEN_BOARD_URL = PROVIDER_METADATA.brokenBoardUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DEFAULT_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const doc = readVisibleNativeDocument(String(html), { strict: true })
  const normalized = doc.text(doc.nodes(node => node.tag === 'root')[0])
  return normalized.includes('Join us to grow your career by doing what you love to do and treading the path where you want to go.')
    && doc.nodes(node => node.tag === 'a' && node.attrs.href === BROKEN_BOARD_URL
      && (node.attrs.class || '').split(/\s+/).includes('cta-btn') && doc.text(node) === 'Current Openings').length > 0
}

export const isBrokenZohoBoardPage = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('blazeclan.zohorecruit.in does not exist.')
    && normalized.includes('Powered by')
    && /zoho/i.test(normalized)
}

const defaultRetryFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: DEFAULT_HEADERS,
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

export const isBlazeclanApexTlsAltnameError = (error) => {
  const messages = []
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)
    messages.push(String(current.code ?? ''), String(current.message ?? ''))
    current = current.cause
  }

  const diagnostic = messages.join(' ')
  return /ERR_TLS_CERT_ALTNAME_INVALID|certificate's altnames|Hostname\/IP does not match/i.test(diagnostic)
    && /Host:\s*blazeclan\.com\b/i.test(diagnostic)
    && /\*\.blazeclan\.com/i.test(diagnostic)
}

const defaultFetchText = defaultRetryFetchText

export const createBlazeclanTechnologiesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, signal } = {}) {
    signal?.throwIfAborted()
    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL, { signal })
      signal?.throwIfAborted()
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      if (isBlazeclanApexTlsAltnameError(error)) {
        return attachInventoryEvidence([], {
          status: 'discovery-only',
          surface: CAREERS_URL,
          firstParty: false,
          listingComplete: false,
          pagesFetched: 0,
          reportedTotal: null,
          indiaFacetCount: null,
          verifiedAt: now(),
          reason: 'Blazeclan official careers page is currently blocked by a TLS certificate host mismatch; no complete job snapshot can be established.',
        })
      }

      throw error
    }
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Blazeclan Technologies verified work-with-us page no longer matches the trusted first-party contract')
    }

    const boardHtml = await fetchText(BROKEN_BOARD_URL, { signal })
    signal?.throwIfAborted()
    if (!isBrokenZohoBoardPage(boardHtml)) {
      throw new Error('Blazeclan Technologies current openings handoff no longer matches the verified dead-board state')
    }

    return attachInventoryEvidence([], {
      status: 'discovery-only',
      surface: CAREERS_URL,
      firstParty: true,
      listingComplete: false,
      pagesFetched: 2,
      reportedTotal: null,
      indiaFacetCount: null,
      verifiedAt: now(),
      reason: 'Blazeclan official Zoho handoff is unavailable: the tenant does not exist; no complete job snapshot can be established',
    })
  },
})

export const run = async (options = {}) => createBlazeclanTechnologiesScraper(options).run(options)

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
