import {runCurrentD2c} from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'd2c'
export const COMPANY = 'D2C'
export const VERIFIED_AT = '2026-07-14'
export const HOMEPAGE_URL = 'https://d2c.in/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://d2c.in/careers',
  'https://d2c.in/careers/',
  'https://d2c.in/career',
  'https://d2c.in/jobs',
  'https://d2c.in/jobs/',
  'https://d2c.in/join-us',
  'https://d2c.in/work-with-us',
  'https://d2c.in/openings',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bwe(?:'|’)re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions\b/i,
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjobs at\b/i,
  /\bwork with us\b/i,
  /\blever\.co\b/i,
  /\bgreenhouse\.io\b/i,
  /\bashbyhq\.com\b/i,
  /\bworkdayjobs\.com\b/i,
  /\bmyworkdayjobs\.com\b/i,
  /\bsmartrecruiters\.com\b/i,
  /\bjobvite\.com\b/i,
  /\bbreezy\.hr\b/i,
]

const CAREER_ROUTE_LINK_PATTERN =
  /href=["'][^"']*\/(?:careers?|jobs?|join-us|work-with-us|openings)(?:[/"'?#]|$)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Mirav Labs\s*[—-]\s*Production AI for Modern Enterprise\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Mirav Labs deploys production-grade AI/i.test(page)
    && text.includes('mirav labs')
    && text.includes('mirav aegis')
    && text.includes('network ai')
    && text.includes('voice ai')
    && text.includes('deepak@d2c.in')
    && text.includes('book a demo call')
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasCareerRouteLinkSignal = (html = '') =>
  CAREER_ROUTE_LINK_PATTERN.test(String(html ?? ''))

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page?.html ?? '')

  return Number(page?.status) === 404
    && /<title>\s*404 Not Found\s*<\/title>/i.test(html)
    && /The requested URL was not found on this server\./i.test(html)
    && /Apache\/[\d.]+\s+\(Ubuntu\)\s+Server at d2c\.in Port 443/i.test(html)
    && !hasPublicJobsSignal(html)
}

export const createD2CScraper = () => ({run:runCurrentD2c})

export const run = async (options = {}) => createD2CScraper().run(options)

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
