import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readCurrentEmptyInventory, waitForSource } from './currentEmpty.js'

import { AUTO_PI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = AUTO_PI_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const SOURCE = PROVIDER_METADATA.source
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_EMAIL = PROVIDER_METADATA.applicationEmail
export const APPLICATION_URL = PROVIDER_METADATA.applicationUrl
export const VERIFIED_ROLE_URLS = PROVIDER_METADATA.verifiedRoleUrls
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const ROLE_CARD_PATTERN =
  /<h4[^>]*>(.*?)<\/h4>[\s\S]*?<span[^>]*>\s*(?:<svg[\s\S]*?<\/svg>)?\s*([^<]+?)\s*<\/span>[\s\S]*?<span[^>]*>\s*(?:<svg[\s\S]*?<\/svg>)?\s*([^<]+?)\s*<\/span>[\s\S]*?<p[^>]*>(.*?)<\/p>[\s\S]*?<a class="stretched-link" href="([^"]+)"><\/a>/gi

const decodeHtmlEntities = (value) =>
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(String(value), baseUrl).toString()
  } catch {
    return null
  }
}

const extractMetaValue = (html, label) => {
  const escapedLabel = String(label ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(
    `<dt[^>]*>\\s*${escapedLabel}\\s*<\\/dt>[\\s\\S]*?<dd[^>]*>(.*?)<\\/dd>`,
    'i',
  )
  return normalizeWhitespace(String(html ?? '').match(pattern)?.[1])
}

const extractRoleId = (sourceUrl) => {
  try {
    const url = new URL(String(sourceUrl ?? ''))
    const segments = url.pathname.split('/').filter(Boolean)
    return segments.at(-1) || null
  } catch {
    return null
  }
}

const extractLocationParts = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) {
    return {
      city: null,
      state: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  const country = parts.at(-1) || null

  if (!country) {
    return { city: null, state: null, country: null }
  }

  if (!/india/i.test(country)) {
    return {
      city: parts[0] ? normalizeCity(parts[0]) : null,
      state: null,
      country,
    }
  }

  const cityValue = parts[0] && !/^remote$/i.test(parts[0]) ? normalizeCity(parts[0]) : null
  const stateValue = parts.length >= 3 ? parts.at(-2) : null

  return {
    city: cityValue,
    state: stateValue || null,
    country: 'India',
  }
}

const defaultFetchText = async (url, { fetchImpl = fetch, signal } = {}) => {
  const response = await waitForSource(fetchImpl(url, { method: 'GET', redirect: 'manual', signal,
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } }), signal)
  if (response?.status !== 200 || response.url !== url) {
    await waitForSource(Promise.resolve().then(() => response?.body?.cancel?.()), signal).catch(() => {})
    throw new Error('AutoPi public response unavailable or redirected (HTTP' + response?.status + ')')
  }
  return waitForSource(Promise.resolve().then(() => response.text()), signal)
}

const hasVerifiedEmptyRoleInventory = (html) => {
  const page = String(html ?? '')
  return /No open positions right now/i.test(normalizeWhitespace(page) || '')
    && !/class=["'][^"']*\bstretched-link\b/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Join Our Team\s*\|\s*AutoPi Careers\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Roles we\'re hiring for')
    && /open positions/i.test(normalized)
    && (/class="stretched-link"/i.test(rawHtml) || hasVerifiedEmptyRoleInventory(rawHtml))
}

export const extractRoleCards = (html) => {
  const rawHtml = String(html ?? '')
  const roles = []

  for (const match of rawHtml.matchAll(ROLE_CARD_PATTERN)) {
    const title = normalizeWhitespace(match[1])
    const location = normalizeWhitespace(match[2])
    const employmentType = normalizeWhitespace(match[3])
    const summary = normalizeWhitespace(match[4])
    const sourceUrl = toAbsoluteUrl(match[5])

    if (!title || !location || !employmentType || !summary || !sourceUrl) {
      throw new Error('AutoPi verified official careers surface changed materially')
    }

    roles.push({
      title,
      location,
      employmentType,
      summary,
      sourceUrl,
    })
  }

  if (roles.length === 0 && !hasVerifiedEmptyRoleInventory(rawHtml)) {
    throw new Error('AutoPi verified official careers surface changed materially')
  }

  return roles
}

export const isIndiaLocation = (value) => /\bindia\b/i.test(normalizeWhitespace(value) || '')

export const hasOfficialRoleDetailSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /\|\s*AutoPi\.io\s*<\/title>/i.test(rawHtml)
    && /apply now/i.test(normalized)
    && /Send your CV and resume to us directly/i.test(normalized)
    && /jobs@autopi\.io/i.test(rawHtml)
    && /Location/i.test(normalized)
    && /Job type/i.test(normalized)
}

export const extractApplicationEmail = (html) => {
  const emailMatches = [...String(html ?? '').matchAll(/href="mailto:\s*([^"?"]+)"/gi)]
    .map((match) => normalizeWhitespace(match[1])?.toLowerCase())
    .filter(Boolean)

  const jobsEmail = emailMatches.find((value) => value === APPLICATION_EMAIL)
  if (jobsEmail) return jobsEmail

  return emailMatches[0] || null
}

const extractJobFromDetailPage = (detailHtml, roleCard, scrapedAt) => {
  if (!hasOfficialRoleDetailSignal(detailHtml)) {
    throw new Error('AutoPi verified role detail surface changed materially')
  }

  const applicationEmail = extractApplicationEmail(detailHtml)
  const location = extractMetaValue(detailHtml, 'Location') || roleCard.location
  const employmentType = extractMetaValue(detailHtml, 'Job type') || roleCard.employmentType
  const jobId = extractRoleId(roleCard.sourceUrl)
  const locationParts = extractLocationParts(location)

  if (!applicationEmail || !location || !employmentType || !jobId || !locationParts.country) {
    throw new Error('AutoPi verified role detail surface changed materially')
  }

  return {
    title: roleCard.title,
    company: COMPANY_NAME,
    department: null,
    location,
    city: locationParts.city,
    state: locationParts.state,
    country: locationParts.country,
    jobId,
    requisitionId: jobId,
    sourceUrl: roleCard.sourceUrl,
    applyUrl: `mailto:${applicationEmail}`,
    employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: roleCard.summary,
    source: SOURCE,
    link: `mailto:${applicationEmail}`,
    scrapedAt,
  }
}

export const createAutoPiScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchImpl = fetch,
    signal: callerSignal,
    onAudit,
    now = () => new Date().toISOString(),
  } = {}) {
    const signal = AbortSignal.any([AbortSignal.timeout(45000), ...(callerSignal ? [callerSignal] : [])])
    signal.throwIfAborted()
    const page = async url => {
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)])
      const html = await waitForSource(Promise.resolve().then(() => fetchText(url, { fetchImpl, signal: requestSignal })), requestSignal)
      requestSignal.throwIfAborted()
      if (typeof html !== 'string' || html.length > 2000000) throw new Error('AutoPi public response exceeds native page budget')
      return html
    }
    const careersHtml = await page(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('AutoPi verified official careers surface changed materially')
    }

    const openingEmpty = readCurrentEmptyInventory(careersHtml)
    if (openingEmpty) {
      const closingEmpty = readCurrentEmptyInventory(await page(CAREERS_URL))
      if (!closingEmpty || JSON.stringify(openingEmpty) !== JSON.stringify(closingEmpty)) {
        throw new Error('AutoPi native zero changed during closing inventory reconciliation')
      }
      const inventoryEvidence = { status: 'verified-empty', surface: CAREERS_URL, firstParty: true,
        listingComplete: true, pagesFetched: 2, reportedTotal: 0, indiaFacetCount: 0,
        verifiedAt: new Date(now()).toISOString(), reason: 'Current declared public board explicitly reports0open and no open positions; opening and closing native empty states reconcile' }
      if (onAudit) await waitForSource(Promise.resolve().then(() => onAudit({ source: SOURCE, opening: openingEmpty,
        closing: closingEmpty, closingInventoryMatches: true, inventoryEvidence, productionWrites: false,
        companyWideRecruitingScopeComplete: false, lifecycleComplete: false })), signal)
      signal.throwIfAborted()
      return attachInventoryEvidence([], inventoryEvidence)
    }

    const roleCards = extractRoleCards(careersHtml)
    const indiaRoles = roleCards.filter((role) => isIndiaLocation(role.location))
    if (indiaRoles.length === 0) return []

    const selectedRoles = maxJobs ? indiaRoles.slice(0, maxJobs) : indiaRoles
    const scrapedAt = now()
    const detailHtmlByUrl = {}

    await Promise.all(selectedRoles.map(async (role) => {
      detailHtmlByUrl[role.sourceUrl] = await page(role.sourceUrl)
    }))

    return selectedRoles.map((role) =>
      extractJobFromDetailPage(detailHtmlByUrl[role.sourceUrl], role, scrapedAt))
  },
})

export const run = async (options = {}) => createAutoPiScraper(options).run(options)

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
