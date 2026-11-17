import {runCurrentNative} from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'


const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'vividobots'
export const COMPANY = 'Vividobots'
export const HOMEPAGE_URL = 'https://www.vividobots.com/'
export const CAREERS_URL = 'https://www.vividobots.com/careers'
export const JOB_APPLICATION_URL = 'https://www.vividobots.com/job-application'
export const AROOPA_FORM_ID = '690c91a7a673722dcf6999cc'

const HOMEPAGE_SIGNALS = [
  /<title>\s*Vividobots:\s*High-Rise Robotic Cleaning\s*<\/title>/i,
  /\bVIVIDOBOTS\b/i,
  /href=["'](?:https:\/\/www\.vividobots\.com)?\/careers["']/i,
  /\+91\s*6379770204/i,
]

const CAREERS_SIGNALS = [
  /<title>\s*Join Us:\s*Robotic Solutions Careers\s*\|\s*Smart Automation Jobs\s*<\/title>/i,
  /<h3>\s*Join Us\s*<\/h3>/i,
  /Some opportunities for you to explore/i,
  /Candidate Portal/i,
  /Register Here/i,
]

const JOB_APPLICATION_SIGNALS = [
  /<title>\s*Join Our Team\s*-\s*Career Opportunities\s*&amp;\s*Job Openings\s*<\/title>/i,
  /<h3>\s*Join Our Team\s*<\/h3>/i,
  /data-aroopa-form-id=["']690c91a7a673722dcf6999cc["']/i,
  /data-aroopa-tenant=["']vividobots["']/i,
  /cdn\.aroopaapps\.com\/assets\/js\/form\.embed\.js/i,
]

const PUBLIC_ATS_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /icims\.com/i,
  /freshteam/i,
]

const PUBLIC_BODY_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview jobs\b/i,
  /\bexplore jobs\b/i,
]

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim()

const extractBodyText = (html) => {
  const match = String(html ?? '').match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  return stripTags(match?.[1] || html)
}

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) =>
  HOMEPAGE_SIGNALS.every((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialCareersSignal = (html) =>
  CAREERS_SIGNALS.every((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialJobApplicationSignal = (html) =>
  JOB_APPLICATION_SIGNALS.every((pattern) => pattern.test(String(html ?? '')))

export const extractRegisterUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!/Register Here/i.test(match[2])) continue

    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (absoluteUrl) return absoluteUrl
  }

  return null
}

export const pageExposesPublicJobListings = (html) => {
  const rawHtml = String(html ?? '')
  const bodyText = extractBodyText(rawHtml)

  return PUBLIC_ATS_PATTERNS.some((pattern) => pattern.test(rawHtml))
    || PUBLIC_BODY_PATTERNS.some((pattern) => pattern.test(bodyText))
  // Intentionally ignore head/meta copy because the current verified job-application page
  // markets "job openings" there without exposing public listings in the visible body.
}

export const createVividobotsScraper = () => ({run:runCurrentNative})

export const run = async (options = {}) => createVividobotsScraper().run(options)

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
