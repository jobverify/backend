import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

import { MAMMOTH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = MAMMOTH_CATALOG.source
export const COMPANY = MAMMOTH_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = MAMMOTH_CATALOG.officialBrandName
export const VERIFIED_ON = MAMMOTH_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = MAMMOTH_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = MAMMOTH_CATALOG
export const HOMEPAGE_URL = MAMMOTH_CATALOG.companyCareerPage
export const ABOUT_URL = MAMMOTH_CATALOG.officialAboutUrl
export const CAREERS_ROUTE_URLS = [
  'https://mammoth.io/careers',
  'https://mammoth.io/jobs',
  'https://mammoth.io/join-us',
  'https://mammoth.io/team',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)? hiring\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'mammoth.io' || hostname === 'www.mammoth.io'
  } catch {
    return false
  }
}

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:www\.)?mammoth\.io)?\/(?:career|careers|jobs?|join-us|openings|team)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:career|careers|jobs?|join-us|openings|team)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  if (
    /<title>\s*Mammoth Analytics:\s*Data Prep,\s*Automation\s*&amp;\s*Dashboards\s*<\/title>/i.test(rawHtml)
    && normalized.includes('the data platform that means business')
  ) {
    return normalized.includes('pipelines')
      && normalized.includes('automations')
      && normalized.includes('dashboards')
  }

  if (rawHtml.includes('<title>Mammoth Analytics \u2014 Data Prep, Automation &amp; Dashboards</title>')) {
    return normalized.includes('mammoth analytics')
      && rawHtml.toLowerCase().includes('no credit card to start')
  }

  return /<title>\s*Mammoth Analytics\s*(?:&mdash;|&#8212;|—)\s*Data Prep,\s*Automation\s*&amp;\s*Dashboards\s*<\/title>/i.test(rawHtml)
    && normalized.includes('your whole data journey. one platform.')
    && normalized.includes('connect, prepare, automate, govern, share')
    && normalized.includes('no shuttling files between tools. no handoffs. no waiting on a ticket.')
    && normalized.includes('no credit card to start')
}

export const hasOfficialAboutSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  if (
    /<title>[^<]*About[^<]*Mammoth[^<]*<\/title>/i.test(rawHtml)
    && normalized.includes('mammoth builds data preparation and automation for business teams.')
    && normalized.includes('four opinions the product is built on.')
    && normalized.includes('the handoffs are the problem.')
  ) return true

  if (rawHtml.includes('About') && rawHtml.includes('Mammoth') && rawHtml.includes('https://mammoth.io/about/')) {
    return rawHtml.toLowerCase().includes('data preparation and automation for business teams, built in london.')
      && normalized.includes('four opinions the product is built on.')
      && rawHtml.toLowerCase().includes('the handoffs between tools are the real problem.')
  }

  return /<title>\s*About\s*·\s*Mammoth\s*<\/title>/i.test(rawHtml)
    && normalized.includes('made in london since 2017. mammoth builds data preparation and automation for business teams.')
    && normalized.includes('four opinions the product is built on.')
    && normalized.includes('the handoffs are the problem')
}

export const isVerifiedMissingFirstPartyRoute = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeText(rawHtml)

  return page.status === 404
    && isOfficialDomainUrl(page.url || '')
    && /<title>[^<]*Mammoth Analytics[^<]*Data Prep,\s*Automation\s*&amp;\s*Dashboards[^<]*<\/title>/i.test(rawHtml)
    && normalized.includes('404')
    && normalized.includes("that page doesn't exist.")
    && normalized.includes("here's where most people are heading.")
    && !hasPublicJobsSignal(rawHtml)
    && !hasFirstPartyCareerLikeLink(rawHtml)
}

export const createMammothScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Mammoth homepage no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Mammoth homepage now appears to expose public jobs')
    }
    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Mammoth homepage now exposes a first-party careers or jobs link')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialAboutSignal(aboutPage.html)) {
      throw new Error('Mammoth about page no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(aboutPage.html) || hasFirstPartyCareerLikeLink(aboutPage.html)) {
      throw new Error('Mammoth about page now appears to expose a careers or jobs surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedMissingFirstPartyRoute(careersRoute)) {
        throw new Error(`Mammoth careers route changed materially or now exposes public jobs: ${careersRouteUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMammothScraper().run(options)

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
