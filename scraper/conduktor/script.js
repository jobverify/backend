import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CONDUKTOR_CATALOG } from './catalog.js'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CONDUKTOR_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const OPEN_ROLES_PAGE_URL = PROVIDER_METADATA.openRolesPageUrl
export const NO_OPEN_ROLES_HEADING = 'No Open Roles Right Now'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15000)]),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const visibleText = (html) => {
  const document = readNativeDocument(html)
  return document.text(document.nodes(node => node.tag === 'root')[0])
}

const activeLinks = html => readNativeDocument(html).nodes(node => node.tag === 'a' && node.attrs.href)
  .map(node => node.attrs.href)

const nativeLeverLinks = html => activeLinks(html).flatMap(href => {
  try {
    const url = new URL(href, OPEN_ROLES_PAGE_URL)
    return url.origin === 'https://jobs.lever.co' && !url.username && !url.password
      && url.pathname.split('/').filter(Boolean)[0] === SOURCE ? [url] : []
  } catch { return [] }
})
const hasNativeLeverHandoff = html => nativeLeverLinks(html).length > 0

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  const titles = activeHead(page).titles
  return titles.length === 1 && /^Careers\s*-\s*Join Our Team\s*\|\s*Conduktor$/i.test(titles[0])
    && text.includes('Join a Team of Builders')
    && text.includes('Open Roles')
    && activeLinks(page).some(href => {
      try { return new URL(href, CAREERS_PAGE_URL).href === OPEN_ROLES_PAGE_URL } catch { return false }
    })
}

export const hasOfficialOpenRolesPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  const titles = activeHead(page).titles
  return titles.length === 1 && /^Open Roles\s*\|\s*Conduktor$/i.test(titles[0])
    && text.includes('Open Roles')
    && text.includes('Conduktor')
}

export const hasNoOpenRolesSignal = (html = '') => {
  const text = normalizeWhitespace(visibleText(html)).replace(/[’‘]/g, "'")

  return text.includes(NO_OPEN_ROLES_HEADING)
    && text.includes("We don't have any open positions at the moment")
}

export const hasPublicJobListingSignal = (html = '') => {
  const page = String(html ?? '')
  const text = visibleText(page)

  return hasNativeLeverHandoff(page)
    || /\btechnical support engineer\b/i.test(text)
    || /\bapply\b/i.test(text)
}

const sameUrl = (left, right) => {
  const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/g, '')
  return normalizeUrl(left) === normalizeUrl(right)
}

export const createConduktorScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchJson, signal } = {}) {
    signal?.throwIfAborted()
    const careersPage = await fetchPage(CAREERS_PAGE_URL, { signal })
    signal?.throwIfAborted()

    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_PAGE_URL)
      || !hasOfficialCareersPageSignal(careersPage.html)
    ) {
      throw new Error('Conduktor verified careers page no longer matches the known public surface')
    }

    const openRolesPage = await fetchPage(OPEN_ROLES_PAGE_URL, { signal })
    signal?.throwIfAborted()

    if (
      openRolesPage.status !== 200
      || !sameUrl(openRolesPage.url, OPEN_ROLES_PAGE_URL)
      || !hasOfficialOpenRolesPageSignal(openRolesPage.html)
    ) {
      throw new Error('Conduktor verified open roles page no longer matches the known public surface')
    }

    const noOpenRoles = hasNoOpenRolesSignal(openRolesPage.html)
    const publicJobs = hasPublicJobListingSignal(openRolesPage.html)
    if (noOpenRoles && publicJobs) {
      throw new Error('Conduktor contradictory empty and active recruiting states')
    }
    if (hasNativeLeverHandoff(openRolesPage.html)) {
      const linkedRoleIds = nativeLeverLinks(openRolesPage.html).map(url => url.pathname.split('/').filter(Boolean)[1]).filter(Boolean)
      const loadJson = fetchJson || ((url, options) => fetchJsonWithRetry(url, {
        ...options, label: SOURCE, timeoutMs: 15000,
      }))
      return createPublishingGapAtsScraper({ source: SOURCE, companyName: COMPANY,
        companyCareerPage: CAREERS_PAGE_URL, atsPlatform: 'lever', boardToken: SOURCE,
      }).run({ signal, fetchJson: async (url, options) => {
        const payload = await loadJson(url, options)
        if (Array.isArray(payload) && linkedRoleIds.some(id => !payload.some(role => role?.id === id))) {
          throw new Error('Conduktor native inventory contradicts visible role identities')
        }
        return payload
      } })
    }
    if (publicJobs) {
      throw new Error('Conduktor open roles page now appears to expose public jobs')
    }

    if (!noOpenRoles) {
      throw new Error('Conduktor verified no-open-roles surface no longer matches the known public surface')
    }

    return attachInventoryEvidence([], { status: 'verified-empty', surface: OPEN_ROLES_PAGE_URL,
      firstParty: true, listingComplete: true, pagesFetched: 2, reportedTotal: 0,
      indiaFacetCount: 0, verifiedAt: new Date().toISOString(), reason: 'official-active-no-open-roles-state' })
  },
})

export const run = async (options = {}) => createConduktorScraper().run(options)

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
