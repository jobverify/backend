import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { runCurrentAllcargoInventory } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_PAGE_URL = 'https://www.allcargologistics.com/about-us/careers'
export const DARWINBOX_HANDOFF_URL = 'https://allcargologistics.darwinbox.in/ms/candidatev2/main/careers/home'
export const LEGACY_DARWINBOX_HANDOFF_URL = 'https://gatikwe.darwinbox.in/ms/candidate/careers'
export const LISTING_API_URL = 'https://gatikwe.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'allcargologistics',
  timeoutMs: 15000,
})

const defaultProbeListingApi = async (url) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      companyId: 'main',
      sort_option: 'new',
      limit: 10,
      page: 1,
    }),
  })

  return {
    status: response.status,
    body: await response.text(),
  }
}

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/(?:allcargologistics\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/home|gatikwe\.darwinbox\.in\/ms\/candidate\/careers)/i,
  )

  return match?.[0] ?? null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page).toLowerCase()

  return (
    text.includes('allcargo')
    && text.includes('career')
    && (
      text.includes('explore opportunities')
      || text.includes('find your next move')
      || text.includes('explore job openings')
      || text.includes('join our team')
    )
    && [DARWINBOX_HANDOFF_URL, LEGACY_DARWINBOX_HANDOFF_URL].includes(extractOfficialDarwinboxUrl(page))
  )
}

export const hasBrokenDarwinboxTenantSignal = ({ status, body }) => {
  const normalized = normalizeWhitespace(body).toLowerCase()

  return status >= 400
    && normalized.includes('invalid subdomain')
    && normalized.includes('gatikwe')
}

export const createAllcargoLogisticsScraper = () => ({
  async run(options = {}) {
    if (options.fetchImpl || (!options.fetchText && !options.probeListingApi)) return runCurrentAllcargoInventory(options)
    const { fetchText = defaultFetchText, probeListingApi = defaultProbeListingApi, signal } = options
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Allcargo Logistics careers page no longer exposes the verified Darwinbox handoff')
    }

    const probeResult = await probeListingApi(LISTING_API_URL)
    if (hasBrokenDarwinboxTenantSignal(probeResult)) {
      return attachInventoryEvidence([], { status: 'discovery-only', firstParty: true, listingComplete: false,
        surface: CAREERS_PAGE_URL, pagesFetched: 2, verifiedAt: new Date().toISOString(),
        reason: 'historical-gatikwe-tenant-unavailable-current-inventory-unknown' })
    }

    throw new Error('Allcargo Logistics Darwinbox tenant no longer matches the verified broken Darwinbox tenant state')
  },
})

export const run = async (options = {}) => createAllcargoLogisticsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'allcargologistics')
  }
}
