import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import POSTHOG_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_SIGNAL_PATTERN =
  /\b(india|bengaluru|bangalore|mumbai|pune|hyderabad|gurugram|gurgaon|noida|delhi|chennai|asia\/kolkata)\b/i

const INDIA_OFFSET_PATTERN = /\bgmt\s*\+?\s*5\s*:\s*30\b/i

export const SOURCE = POSTHOG_CATALOG.source
export const COMPANY = POSTHOG_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = POSTHOG_CATALOG.officialBrandName
export const VERIFIED_ON = POSTHOG_CATALOG.verifiedOn
export const PROVIDER_METADATA = POSTHOG_CATALOG
export const CAREERS_PAGE_URL = POSTHOG_CATALOG.companyCareerPage
export const DISCOVERY_PAGE_DATA_URL = POSTHOG_CATALOG.discoveryCareerPageDataUrl

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8217;|&#x27;/gi, "'")
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

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const toAbsoluteCareerUrl = (value) => {
  try {
    return new URL(value, 'https://posthog.com').toString()
  } catch {
    return null
  }
}

const dedupe = (values = []) => [...new Set(values.filter(Boolean))]

const parseCustomFieldValues = (value) => {
  if (value == null) return []

  if (Array.isArray(value)) {
    return value.map(normalizeWhitespace).filter(Boolean)
  }

  const normalized = normalizeWhitespace(value)
  if (!normalized) return []

  try {
    const parsed = JSON.parse(String(value))
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeWhitespace).filter(Boolean)
    }
  } catch {
    return [normalized]
  }

  return [normalized]
}

const extractTimezoneValues = (customFields = []) =>
  dedupe(
    customFields
      .filter((field) => /timezone/i.test(normalizeWhitespace(field?.title) || ''))
      .flatMap((field) => parseCustomFieldValues(field?.value)),
  )

const hasIndiaSignal = (posting = {}) =>
  [posting.title, posting.slug, posting.department, ...(posting.timezones || [])]
    .filter(Boolean)
    .some((value) =>
      INDIA_SIGNAL_PATTERN.test(String(value))
      || INDIA_OFFSET_PATTERN.test(String(value)),
    )

export const hasVerifiedCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /content="Careers - PostHog"/i.test(rawHtml)
    && /increase the number of successful products in the world/i.test(rawHtml)
    && normalized.includes("Who's hiring?")
    && /Our small teams are looking to add \d+ team members/i.test(normalized)
    && normalized.includes('Select a role')
    && /href="\/careers\/[^"#?]+"/i.test(rawHtml)
}

export const extractVerifiedRoleSlug = (html = '') => {
  const roleSlugs = [...String(html ?? '').matchAll(/href="(\/careers\/[^"#?]+)"/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter((slug) => slug && slug !== '/careers')

  return roleSlugs[0] || null
}

export const buildPageDataUrl = (roleSlug) => {
  const normalizedSlug = normalizeWhitespace(roleSlug)
  if (!normalizedSlug || !normalizedSlug.startsWith('/careers/')) return null

  try {
    return new URL(`/page-data${normalizedSlug}/page-data.json`, 'https://posthog.com').toString()
  } catch {
    return null
  }
}

export const extractAllJobPostings = (payload = {}) =>
  (Array.isArray(payload?.result?.data?.allJobPostings?.nodes)
    ? payload.result.data.allJobPostings.nodes
    : [])
    .map((node) => {
      const title = normalizeWhitespace(node?.fields?.title)
      const slug = normalizeWhitespace(node?.fields?.slug)
      const sourceUrl = toAbsoluteCareerUrl(slug)

      if (!title || !slug || !sourceUrl) return null

      return {
        title,
        slug,
        sourceUrl,
        department: normalizeWhitespace(node?.departmentName),
        timezones: extractTimezoneValues(node?.parent?.customFields),
      }
    })
    .filter(Boolean)

export const createPostHogScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      throw new Error('Verified PostHog careers page changed materially')
    }

    const verifiedRoleSlug = extractVerifiedRoleSlug(careersHtml)
    const pageDataUrl = buildPageDataUrl(verifiedRoleSlug)
    if (!verifiedRoleSlug || !pageDataUrl) {
      throw new Error('Verified PostHog careers page changed materially')
    }

    const payload = await fetchJson(pageDataUrl)
    const rawPostings = payload?.result?.data?.allJobPostings?.nodes
    const postings = extractAllJobPostings(payload)
    if (
      !Array.isArray(rawPostings)
      || postings.length === 0
      || postings.length !== rawPostings.length
      || !postings.some((posting) => posting.slug === verifiedRoleSlug)
      || new Set(postings.map((posting) => posting.slug)).size !== postings.length
      || postings.some((posting) => posting.timezones.length === 0)
    ) {
      throw new Error('Verified PostHog page-data contract changed materially')
    }

    if (postings.some(hasIndiaSignal)) {
      throw new Error('Verified PostHog India slice changed materially')
    }

    return attachInventoryEvidence([], {
      status: 'complete-inventory',
      surface: CAREERS_PAGE_URL,
      firstParty: true,
      listingComplete: true,
      pagesFetched: 1,
      reportedTotal: postings.length,
      indiaFacetCount: 0,
      verifiedAt: now(),
      reason: 'current-first-party-gatsby-inventory-has-no-india-timezone',
    })
  },
})

export const run = async (options = {}) => createPostHogScraper(options).run(options)

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
