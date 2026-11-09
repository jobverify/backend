import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import SIGNZY_CATALOG from './catalog.js'
import {run as runCurrentNative} from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SIGNZY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const BROKEN_JOBS_CTA_URL = PROVIDER_METADATA.verifiedBrokenJobsCtaUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const TRUSTWORTHY_JOB_HOST_PATTERN =
  /(?:jobs\.lever\.co|api\.lever\.co|boards-api\.greenhouse\.io|job-boards\.greenhouse\.io|boards\.greenhouse\.io|darwinbox\.(?:in|com)|myworkdayjobs\.com|workdayjobs\.com|smartrecruiters\.com|ashbyhq\.com|workable\.com|jobvite\.com|icims\.com|greenhouse\.io)/i
const FIRST_PARTY_JOB_PATH_PATTERN = /\/(?:jobs|careers)\/(?!page(?:[-/.]|$))[a-z0-9][a-z0-9-]*(?:\/)?$/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()
  const title = (extractTitle(page) || '').toLowerCase()

  return title === 'signzy'
    && text.includes('careers')
    && text.includes('we are hiring')
    && text.includes('life at signzy')
    && text.includes('signzy technologies private limited')
}

export const hasBrokenJobsCtaSignal = (html = '') => {
  const page = String(html ?? '')
  return /View All Positions/i.test(page)
    && /href=["']\/carrers["']/i.test(page)
}

export const hasNoTrustworthyPublicJobsSignal = (html = '') => {
  const page = String(html ?? '')
  const pageWithoutBundles = page.replace(/<script[\s\S]*?<\/script>/gi, ' ')

  if (/View Job/i.test(pageWithoutBundles)) return false
  if (/class=["'][^"']*\bjob-card\b/i.test(pageWithoutBundles)) return false

  for (const match of pageWithoutBundles.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = normalizeWhitespace(match[1])
    const text = normalizeWhitespace(match[2]) || ''
    if (!href) continue

    if (TRUSTWORTHY_JOB_HOST_PATTERN.test(href)) return false
    if (FIRST_PARTY_JOB_PATH_PATTERN.test(href) && /job|role|position|engineer|manager|analyst|developer/i.test(text)) {
      return false
    }
  }

  return true
}

export const createSignzyScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Signzy careers page changed materially')
    }

    if (!hasBrokenJobsCtaSignal(careersHtml)) {
      throw new Error('The verified broken jobs CTA changed materially')
    }

    if (!hasNoTrustworthyPublicJobsSignal(careersHtml)) {
      throw new Error('The verified Signzy careers page now exposes trustworthy public jobs and needs a real scraper')
    }

    return []
  },
})

export const run = async (options = {}) => runCurrentNative(options)

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
