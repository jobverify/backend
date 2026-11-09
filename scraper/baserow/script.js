import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import BASEROW_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = BASEROW_CATALOG.source
export const COMPANY = BASEROW_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = BASEROW_CATALOG.officialBrandName
export const VERIFIED_ON = BASEROW_CATALOG.verifiedOn
export const PROVIDER_METADATA = BASEROW_CATALOG
export const CAREERS_PAGE_URL = BASEROW_CATALOG.companyCareerPage

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/[–—]/g, '-')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

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
    return new URL(value, CAREERS_PAGE_URL).toString()
  } catch {
    return null
  }
}

const isFirstPartyJobDetailUrl = (url) => {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'baserow.io'
      && /^\/jobs\/[^/]+\/?$/i.test(parsed.pathname)
      && parsed.pathname.replace(/\/+$/, '').toLowerCase() !== '/jobs'
  } catch {
    return false
  }
}

const extractLocationCandidates = (html = '') =>
  [...String(html).matchAll(/<(?:p|span|div|li|strong)[^>]*>([\s\S]*?)<\/(?:p|span|div|li|strong)>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
    .filter((text) =>
      /(remote|india|europe|americas)/i.test(text)
      && !/^apply$/i.test(text)
      && !/^jobs$/i.test(text),
    )

const extractHeadingCandidates = (html = '') =>
  [...String(html).matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
    .filter((text) => !/^jobs$/i.test(text))

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<title>\s*baserow\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/baserow\.io\/jobs["']/i.test(page)
    && normalized.includes("join us as we build the world's best open source no-code platform")
    && normalized.includes('work on open source')
    && normalized.includes('fast-growing startup')
    && normalized.includes('remote-only')
    && normalized.includes('best idea wins')
    && page.includes('job-listing__jobs')
    && /href=["'][^"']*\/jobs\/[^"'/][^"']*["']/i.test(page)
}

export const extractRoleSummaries = (html = '') => {
  const rolesByUrl = new Map()
  const page = String(html ?? '')

  for (const match of page.matchAll(/<a[^>]*href=["']([^"']*\/jobs\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = toAbsoluteUrl(match[1])
    if (!url || !isFirstPartyJobDetailUrl(url)) continue

    const anchorText = normalizeWhitespace(match[2])
    const matchIndex = match.index || 0
    const windowStart = Math.max(0, matchIndex - 500)
    const windowEnd = Math.min(page.length, matchIndex + 1500)
    const windowHtml = page.slice(windowStart, windowEnd)
    const afterLinkHtml = page.slice(matchIndex, Math.min(page.length, matchIndex + 800))
    const titleFromHeading = extractHeadingCandidates(windowHtml).find((text) => /baserow/i.test(text))
    const title = titleFromHeading || (!/^apply$/i.test(anchorText || '') ? anchorText : null)
    const location = extractLocationCandidates(afterLinkHtml).find((text) =>
      text !== title && !/^remote-only$/i.test(text),
    ) || null

    if (!title) continue

    const existing = rolesByUrl.get(url)
    if (!existing || /^apply$/i.test(existing.title)) {
      rolesByUrl.set(url, { title, location, url })
    }
  }

  return [...rolesByUrl.values()]
}

const allRolesStayOnFirstPartyDomain = (roles = []) => roles.every((role) => isFirstPartyJobDetailUrl(role.url))

const hasIndiaLocation = (value) => /\bindia\b/i.test(String(value ?? ''))

export const hasVerifiedDetailPageSignal = (role, html = '') => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  const normalizedTitle = normalizeWhitespace(role?.title)?.toLowerCase() || ''

  return Boolean(normalizedTitle)
    && normalized.includes(normalizedTitle)
    && normalized.includes('jobs@baserow.io')
}

export const createBaserowScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Verified Baserow jobs page changed materially')
    }

    const roles = extractRoleSummaries(careersHtml)
    if (roles.length === 0) {
      throw new Error('Verified Baserow role listing changed materially')
    }

    if (!allRolesStayOnFirstPartyDomain(roles)) {
      throw new Error('Verified Baserow same-domain role-link contract changed materially')
    }

    if (roles.some((role) => hasIndiaLocation(role.location))) {
      throw new Error('Verified Baserow India slice changed materially')
    }

    const primaryRole = roles[0]
    const detailHtml = await fetchText(primaryRole.url)

    if (!hasVerifiedDetailPageSignal(primaryRole, detailHtml)) {
      throw new Error('Verified Baserow job detail page changed materially')
    }

    if (hasIndiaLocation(detailHtml)) {
      throw new Error('Verified Baserow India slice changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createBaserowScraper().run(options)

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
