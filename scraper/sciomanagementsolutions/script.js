import {runCurrentScio} from './currentNative20261117.js'

import path from 'node:path'

import { fileURLToPath } from 'node:url'

import SCIOMS_CATALOG from './catalog.js'


const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SCIOMS_CATALOG
export const SOURCE = SCIOMS_CATALOG.source
export const COMPANY = SCIOMS_CATALOG.companyName
export const VERIFIED_ON = SCIOMS_CATALOG.verifiedOn
export const CAREERS_URL = SCIOMS_CATALOG.companyCareerPage
export const APPLY_URL = SCIOMS_CATALOG.applyUrl








const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const collectSignals = (html, patterns) => {
  const normalized = normalizeWhitespace(html)
  return patterns.every((pattern) => pattern.test(normalized))
}

const hasVerifiedTitleSignal = (html = '') =>
  /SCIO Management Solutions[^A-Za-z0-9]+Intelligent,\s*Automated RCM Services/i
    .test(normalizeWhitespace(html))

const hasCanonicalHomepageSignal = (html = '') =>
  /<link[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.scioms\.com\/index\.php["']/i
    .test(String(html ?? ''))

const PLACEHOLDER_POSITION_PATTERNS = [
  /^--\s*select position\s*--$/i,
  /^select position$/i,
]

const ACTUAL_PUBLIC_JOB_PATTERNS = [
  /\bjob\s*id\b/i,
  /\brequisition\b/i,
  /\bjob openings?\b/i,
  /\bopen positions?\b/i,
  /\/job(s)?\//i,
]











export const extractPositionOptions = (html = '') =>
  [...String(html ?? '').matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
    .filter((option) => !PLACEHOLDER_POSITION_PATTERNS.some((pattern) => pattern.test(option)))

export const hasVerifiedPlaceholderShellSignal = (html = '') =>
  hasVerifiedTitleSignal(html)
  && hasCanonicalHomepageSignal(html)
  && collectSignals(html, [
    /\bRequest a Consultation\b/i,
    /\bSubmit\b/i,
    /\bClose\b/i,
  ])

export const hasVerifiedCareersSignal = (html = '') => hasVerifiedPlaceholderShellSignal(html)

export const hasVerifiedApplyFormSignal = (html = '') => hasVerifiedPlaceholderShellSignal(html)

export const hasPublicJobListingsSignal = (html = '') =>
  extractPositionOptions(html).length > 0
  || ACTUAL_PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createScioManagementSolutionsScraper = () => ({
  async run(options={}) { return runCurrentScio(options) },
})

export const run = async (options = {}) => createScioManagementSolutionsScraper().run(options)

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
