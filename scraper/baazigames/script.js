import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BAAZI_GAMES_CATALOG } from './catalog.js'
import { runBaaziLinkedInSubset } from './employerLinkedIn.js'
import { normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BAAZI_GAMES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const CAREERS_URL = PROVIDER_METADATA.careersRouteUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeText = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.any([...(signal ? [signal] : []), createTimeoutSignal(15000)]),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('baazigames')
    && normalized.includes('founded in 2014')
    && normalized.includes('talent.acquisition@moonshinetechnology.com')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('contact us')
    && normalized.includes('talent.acquisition@moonshinetechnology.com')
}

export const isBlockedCareersRoute = (html) => normalizeText(html).includes('accessdenied access denied')

export const hasPublicJobsSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('open roles')
    || normalized.includes('current openings')
    || /href=["'][^"']*\/jobs\/[^"']+/i.test(String(html ?? ''))
}

const isBlockedCareersResponse = (page = {}) =>
  (Number(page.status) === 403 || Number(page.status) === 200)
  && isBlockedCareersRoute(page.html)

export const createBaaziGamesScraper = () => ({
  async run({ fetchText, fetchPage = defaultFetchPage, signal, now } = {}) {
    signal?.throwIfAborted()
    const resolvePage = fetchText
      ? async (url) => ({ status: 200, url, html: await fetchText(url) })
      : fetchPage

    const homepage = await resolvePage(HOMEPAGE_URL, { signal })
    signal?.throwIfAborted()
    if (homepage.url !== HOMEPAGE_URL) throw new Error('Baazi Games primary homepage redirected outside its verified authority')
    if (homepage.status !== 200) {
      throw Object.assign(new Error(`Baazi Games public homepage returned HTTP ${homepage.status} at ${homepage.url}`), { abortRetries: true })
    }
    const primaryVisible = String(homepage.html ?? '').replace(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, '')
    if (/<title>\s*BaaziGames \| No Games Available at the Moment\s*<\/title>/i.test(primaryVisible) && normalizeText(primaryVisible).includes('no games are available at the moment')) {
      return runBaaziLinkedInSubset({ fetchPage: resolvePage, signal, now })
    }
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Baazi Games verified homepage no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Baazi Games homepage now exposes a public jobs surface')
    }

    const contact = await resolvePage(CONTACT_URL)
    if (contact.status !== 200 || !hasOfficialContactSignal(contact.html)) {
      throw new Error('Baazi Games verified contact page no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(contact.html)) {
      throw new Error('Baazi Games contact page now exposes a public jobs surface')
    }

    const careers = await resolvePage(CAREERS_URL)
    if ([401, 403, 429].includes(Number(careers.status)) || isBlockedCareersResponse(careers)) {
      throw Object.assign(new Error(`Baazi Games public careers inventory is unavailable: AccessDenied (HTTP ${careers.status})`), {
        code: 'access_denied', status: careers.status, failureKind: 'incomplete_listing', abortRetries: true,
        primaryInventoryUnavailable: 'Baazi Games current public careers inventory is unavailable; native route denied access, global and India totals unknown',
        inventoryEvidence: normalizeInventoryEvidence({
          status: 'coverage-gap', surface: CAREERS_URL, firstParty: true, listingComplete: false,
          pagesFetched: 1, reportedTotal: null, indiaFacetCount: null,
          verifiedAt: typeof now === 'function' ? now() : new Date().toISOString(),
          reason: 'public-careers-access-denied; inventory-counts-unknown',
        }),
      })
    }
    if (hasPublicJobsSignal(careers.html)) {
      throw new Error('Baazi Games careers route now exposes a public jobs surface')
    }

    throw new Error('Baazi Games careers route changed materially and needs review')
  },
})

export const run = async (options = {}) => createBaaziGamesScraper().run(options)

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
