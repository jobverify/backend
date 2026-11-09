import currentConfig from './currentConfig.json' with {type:'json'}
import currentScope from './current.scope.json' with {type:'json'}
import {runCurrentKeka} from '../acciojob/currentKeka.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GAMEBERRY_LABS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const EXTERNAL_HANDOFF_URL = PROVIDER_METADATA.externalHandoffUrl

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
  /\bwe(?:'re| are)\s+hiring\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
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
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;|\u2019/gi, '\'')
  .replace(/&quot;|&ldquo;|&rdquo;|\u201c|\u201d/gi, '"')
  .replace(/&#8211;|&ndash;|\u2013|\u2014/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const trimTrailingSlash = (value) => String(value ?? '').replace(/\/+$/, '')
const HOMEPAGE_ORIGIN = new URL(HOMEPAGE_URL).origin
const CAREERS_PATH = trimTrailingSlash(new URL(CAREERS_URL).pathname)

const defaultFetchPage = async (url, { redirectMode = 'follow' } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: redirectMode,
  })

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    location: response.headers.get('location'),
    text: redirectMode === 'manual' ? '' : await response.text(),
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractCareersRouteUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (absoluteUrl === CAREERS_URL) {
      return absoluteUrl
    }
  }

  return null
}

const isFirstPartyJobRecordUrl = (value) => {
  try {
    const url = new URL(value)
    const pathname = trimTrailingSlash(url.pathname)

    return url.origin === HOMEPAGE_ORIGIN
      && pathname.startsWith(`${CAREERS_PATH}/`)
  } catch {
    return false
  }
}

export const extractFirstPartyJobRecordUrls = (html) => {
  const urls = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (!absoluteUrl || seen.has(absoluteUrl) || !isFirstPartyJobRecordUrl(absoluteUrl)) continue

    seen.add(absoluteUrl)
    urls.push(absoluteUrl)
  }

  return urls
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*Gameberry Labs\s*\|\s*Makers of Ludo STAR &amp; Parchisi STAR\s*<\/title>/i.test(rawHtml)
    && normalized.includes('we build games that players love to grow old with')
    && normalized.includes('build your dream career with us')
    && normalized.includes('join our passion for gaming as we build the future of indian mobile gaming studios - together')
    && normalized.includes('we are an agile team of go-getters filled with people who want to build great games')
    && normalized.includes('bellandur village')
    && normalized.includes('gameberry labs')
}

export const isExpectedCareersRedirect = (page = {}) =>
  Number(page?.status) >= 300
  && Number(page?.status) < 400
  && String(page?.url || '') === CAREERS_URL
  && String(page?.location || '') === EXTERNAL_HANDOFF_URL

export const createGameberryLabsScraper = (defaults={}) => ({
  run: (options={}) => runCurrentKeka(currentConfig,currentScope,{...defaults,...options}),
})

export const run = async (options = {}) => createGameberryLabsScraper().run(options)

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
