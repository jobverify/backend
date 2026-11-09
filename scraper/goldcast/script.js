import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GOLDCAST_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GOLDCAST_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const COMPANY_DOMAIN = PROVIDER_METADATA.companyDomain
export const ATS_PLATFORM = PROVIDER_METADATA.atsPlatform
export const COUNTRY_FILTER = PROVIDER_METADATA.countryFilter
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob openings?\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bjob description\b/i,
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return response.text()
}

export const hasVerifiedGoldcastHomepageSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Goldcast \| The AI-first Video Content Platform for B2B Videos, Webinars, and Events\s*<\/title>/i.test(page)
    && normalized.includes("You're invisible without video")
    && normalized.includes("Goldcast's agentic workflows put it at the heart of your GTM strategy")
    && /<a[^>]+href=["']\/company\/careers["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
    && normalized.includes('Stay In Touch')
    && normalized.includes('Copyright Goldcast, Inc. All rights reserved.')
}

export const hasVerifiedGoldcastCareersSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Join The Gold Standard of B2B Event Tech \| Goldcast Careers\s*<\/title>/i.test(page)
    && normalized.includes('Careers @ Goldcast')
    && normalized.includes('Great team backed by exceptional investors/advisors')
    && normalized.includes('Opportunity to be part of rocket ship as an early team')
    && normalized.includes('Autonomy')
    && normalized.includes('Stay In Touch')
    && normalized.includes('Copyright Goldcast, Inc. All rights reserved.')
}

export const hasPublicGoldcastJobSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(normalized))
}

export const createGoldcastScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (hasPublicGoldcastJobSignals(homepageHtml)) {
      throw new Error('Goldcast homepage now appears to expose a public jobs surface')
    }
    if (!hasVerifiedGoldcastHomepageSignals(homepageHtml)) {
      throw new Error('Goldcast verified homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (hasPublicGoldcastJobSignals(careersHtml)) {
      throw new Error('Goldcast careers page now appears to expose a public jobs surface')
    }
    if (!hasVerifiedGoldcastCareersSignals(careersHtml)) {
      throw new Error('Goldcast verified careers page no longer matches the known first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createGoldcastScraper().run(options)

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
