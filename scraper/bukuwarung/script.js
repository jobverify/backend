import path from 'node:path'
import {createBoundDarwinboxScraper} from '../birlanu/currentNative.js'
import { fileURLToPath } from 'node:url'

import { BOOKUWARUNG_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BOOKUWARUNG_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const LEGACY_HOMEPAGE_URL = PROVIDER_METADATA.legacyHomepageUrl
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OFFICIAL_DARWINBOX_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const DARWINBOX_JOBS_URL = PROVIDER_METADATA.darwinboxJobsUrl
export const DARWINBOX_SHELL_ROUTE_URLS = PROVIDER_METADATA.darwinboxShellRouteUrls
export const DARWINBOX_LISTING_API_URL = PROVIDER_METADATA.darwinboxListingApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob listings?\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\/careers\/jobDetails\//i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''

    if (url.pathname !== '/') {
      url.pathname = url.pathname.replace(/\/+$/, '')
    }

    return url.toString()
  } catch {
    return String(value ?? '').trim()
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultProbeListingApi = async (url) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      companyId: 'main',
      sort_option: 'new',
      limit: 10,
      page: 1,
    }),
  })

  return {
    status: response.status,
    body: await response.text(),
  }
}

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/bukuwarung\.darwinbox\.com\/ms\/candidate\/careers/i)
  return match ? normalizeUrl(match[0]) : null
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes("Let's Work Smart, Have Fun and Make History Together with BukuWarung")
    && normalized.includes('Start your journey with BukuWarung')
    && normalized.includes('See Open Positions')
    && normalized.includes('Building Digital Infrastructure for financial services and productivity tools')
    && normalized.includes('digital infrastructure for 60 million MSMEs in Indonesia')
    && normalized.includes('BukuWarung Recruitment Process')
    && normalized.includes('Interested candidates can apply directly here')
    && normalized.includes('Join our rocketship!')
    && extractOfficialDarwinboxUrl(page) === OFFICIAL_DARWINBOX_HANDOFF_URL
}

export const hasBlankDarwinboxShellSignal = (html = '') => {
  const page = String(html ?? '')
  const bodyText = normalizeWhitespace(page.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '')
  const hasNoPublicJobSignals = !PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(page))

  const legacyBlankShell = /<!doctype html>/i.test(page)
    && /<title>\s*Bukuwarung\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']Bukuwarung\s*["']/i.test(page)
    && bodyText === 'Bukuwarung -'
    && hasNoPublicJobSignals

  const currentEmptyShell = /<!doctype html>/i.test(page)
    && /<body\b/i.test(page)
    && bodyText === ''
    && hasNoPublicJobSignals

  return legacyBlankShell || currentEmptyShell
}

export const hasJobsRedirectToBlankDarwinboxHome = (page = {}) => (
  Number(page?.status) === 200
  && normalizeUrl(page?.url) === 'https://bukuwarung.darwinbox.com/ms/candidatev2/main/careers/home'
  && hasBlankDarwinboxShellSignal(page?.html)
)

export const hasBlockedDarwinboxListingApiSignal = ({ status, body } = {}) => {
  const normalized = normalizeWhitespace(body).toLowerCase()

  return Number(status) === 403
    && normalized.includes('attention required!')
    && normalized.includes('sorry, you have been blocked')
    && normalized.includes('you are unable to access darwinbox.com')
    && normalized.includes('cloudflare ray id')
}

export const createBukuwarungScraper = (defaults={}) => createBoundDarwinboxScraper({source:SOURCE,companyName:COMPANY,employerNames:['BukuWarung','PT Buku Usaha Digital'],officialUrl:OFFICIAL_CAREERS_URL,handoffUrl:OFFICIAL_DARWINBOX_HANDOFF_URL,handoffLabel:'See Open Positions',origin:'https://bukuwarung.darwinbox.com',companySignal:'Start your journey with BukuWarung',title:/Work Smart.*BukuWarung/i},defaults)

export const run = async (options = {}) => createBukuwarungScraper().run(options)

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
