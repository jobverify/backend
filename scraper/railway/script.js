import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import RAILWAY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_SIGNAL_PATTERN =
  /\b(india|bengaluru|bangalore|mumbai|pune|hyderabad|gurugram|gurgaon|noida|delhi|chennai)\b/i

export const SOURCE = RAILWAY_CATALOG.source
export const COMPANY = RAILWAY_CATALOG.companyName
export const COMPANY_DOMAIN = RAILWAY_CATALOG.companyDomain
export const CAREERS_URL = RAILWAY_CATALOG.companyCareerPage
export const VERIFIED_AT = RAILWAY_CATALOG.verifiedOn
export const PROVIDER_METADATA = RAILWAY_CATALOG

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<\/(p|div|li|ul|ol|h[1-6]|section|article|a|footer|main|nav|span)>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const toAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const extractInlineLabels = (html = '') => [...String(html ?? '').matchAll(
  /<(?:span|p|div|li|strong)[^>]*>([\s\S]*?)<\/(?:span|p|div|li|strong)>/gi,
)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const isFirstPartyRoleUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.hostname === COMPANY_DOMAIN
      && /^\/careers\/[^/]+\/?$/i.test(url.pathname)
      && url.pathname.replace(/\/+$/, '').toLowerCase() !== '/careers'
  } catch {
    return false
  }
}

const hasSameDomainCareersRoleLink = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"'#?]*\/careers\/[^"'#?]+)["'][^>]*>/gi)) {
    const url = toAbsoluteUrl(match[1])
    if (isFirstPartyRoleUrl(url)) return true
  }

  return false
}

const extractNextLocationLabel = (html = '') => {
  const match = String(html ?? '').match(/<(?:span|p|div|li|strong)[^>]*>([\s\S]*?)<\/(?:span|p|div|li|strong)>/i)
  return normalizeWhitespace(match?.[1] ?? '') || null
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Careers\s*\|\s*Railway\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Redefine the future of infrastructure')
    && normalized.includes('See open positions')
    && normalized.includes('Remote (anywhere)')
    && hasSameDomainCareersRoleLink(rawHtml)
}

export const extractRoleSummaries = (html = '') => {
  const roles = []
  const page = String(html ?? '')

  for (const match of page.matchAll(/<a[^>]+href=["']([^"'#?]*\/careers\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = toAbsoluteUrl(match[1])
    const labels = extractInlineLabels(match[2])
    const title = labels[0] || normalizeWhitespace(match[2])
    if (!url || !title || !isFirstPartyRoleUrl(url)) continue

    const afterLinkHtml = page.slice(match.index ?? 0, Math.min(page.length, (match.index ?? 0) + 400))
    const location = labels.length > 1
      ? labels.at(-1)
      : extractNextLocationLabel(afterLinkHtml)
    roles.push({ title, location, url })
  }

  return roles
}

const hasIndiaSignal = (value) => INDIA_SIGNAL_PATTERN.test(String(value ?? ''))

export const createRailwayScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Verified Railway careers page changed materially')
    }

    const roles = extractRoleSummaries(careersHtml)
    if (roles.length === 0) {
      throw new Error('Verified Railway careers page changed materially')
    }

    if (roles.some((role) => !isFirstPartyRoleUrl(role.url))) {
      throw new Error('Verified Railway same-domain role-link contract changed materially')
    }
    if (new Set(roles.map((role) => role.url)).size !== roles.length) {
      throw new Error('Verified Railway careers page contains duplicate role links')
    }

    if (roles.some((role) => hasIndiaSignal(role.location) || hasIndiaSignal(role.title))) {
      throw new Error('Verified Railway India slice changed materially')
    }

    return attachInventoryEvidence([], {
      status: 'complete-inventory',
      surface: CAREERS_URL,
      firstParty: true,
      listingComplete: true,
      pagesFetched: 1,
      reportedTotal: roles.length,
      indiaFacetCount: 0,
      verifiedAt: now(),
      reason: 'current-first-party-roles-have-no-india-specific-location',
    })
  },
})

export const run = async (options = {}) => createRailwayScraper().run(options)

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
