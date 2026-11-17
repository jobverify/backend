import {runCurrentPetrus} from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'petrustechnologiespvtltd'
export const COMPANY = 'Petrus Technologies Pvt Ltd'
export const HOMEPAGE_URL = 'https://www.petrustechnologies.com/'
export const ABOUT_COMPONENT_URL = 'https://www.petrustechnologies.com/components/about-us.html'
export const CONTACT_COMPONENT_URL = 'https://www.petrustechnologies.com/components/contact-us.html'
export const PUBLIC_JOB_ROUTE_URLS = [
  'https://www.petrustechnologies.com/careers',
  'https://www.petrustechnologies.com/careers/',
  'https://www.petrustechnologies.com/career',
  'https://www.petrustechnologies.com/career/',
  'https://www.petrustechnologies.com/jobs',
  'https://www.petrustechnologies.com/jobs/',
]

const BUNDLE_REQUIRED_SIGNALS = [
  "'about-us':",
  "'contact-us':",
  'components/home.html',
  'components/about-us.html',
  'components/contact-us.html',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareer(?:s)?\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bsearch jobs\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /freshteam/i,
  /zohorecruit/i,
]

const BUNDLE_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareers?\b\s*:/i,
  /['"`]careers?['"`]\s*:/i,
  /\bjobs\b\s*:/i,
  /['"`]jobs['"`]\s*:/i,
  /['"`]\/careers?(?:\/|['"`])/i,
  /['"`]\/jobs(?:\/|['"`])/i,
  ...PUBLIC_JOBS_SIGNAL_PATTERNS,
]

const normalizeText = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;|\u2019/gi, "'")
    .replace(/&ndash;|&mdash;|\u2013|\u2014/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const hasOfficialShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Petrus Website Homepage\s*<\/title>/i.test(page)
    && /<base[^>]+href=["']\/["']/i.test(page)
    && /<script[^>]+src=["']js\/components\.js["']/i.test(page)
}

export const extractComponentScriptPath = (html = '') =>
  String(html ?? '').match(/<script[^>]+src=["']([^"']*js\/components\.js)["']/i)?.[1] ?? null

export const hasVerifiedBundleSignal = (bundleText = '') =>
  BUNDLE_REQUIRED_SIGNALS.every((signal) => String(bundleText ?? '').includes(signal))

export const hasBundlePublicJobsSignal = (bundleText = '') =>
  BUNDLE_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundleText ?? '')))

export const hasAboutComponentSignal = (html = '') => {
  const normalized = normalizeText(html)

  return normalized.includes('About Us - Petrus Technologies')
    && normalized.includes('About Petrus Technologies')
    && normalized.includes('Life at Petrus')
    && normalized.includes('technology-driven engineering and smart manufacturing solutions')
    && normalized.includes('Industry 4.0')
    && /outlook\.office\.com\/bookwithme\/user\/[^"'\s>]*@petrustechnologies\.com/i.test(String(html ?? ''))
  }

export const hasContactComponentSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return normalized.includes('Contact Us - Petrus Technologies')
    && normalized.includes('Connect With Petrus Technologies')
    && normalized.includes('Sivasakthi Colony')
    && normalized.includes('Ganapathy')
    && normalized.includes('Coimbatore - 641 006')
    && normalized.includes('info@petrustechnologies.com')
    && normalized.includes('sales@petrustechnologies.com')
    && /linkedin\.com\/company\/petrus-technologies/i.test(page)
  }

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedPublicJobShell = (page = {}) =>
  Number(page?.status) === 200
  && hasOfficialShellSignal(page?.html)
  && extractComponentScriptPath(page?.html) !== null
  && !hasPublicJobsSignal(page?.html)

// The current product application contains all public page components in one module.
export const extractCurrentClientPath = (html = '') =>
  String(html).match(/<script[^>]+type=["']module["'][^>]+src=["'](\/assets\/index-[a-zA-Z0-9_-]+\.js)["']/i)?.[1] ?? null

export const hasCurrentProductShellSignal = (html = '') => {
  const page = String(html)
  return /<title>\s*Petrus\s*\|\s*Transform Manufacturing with Industrial Intelligence\s*<\/title>/i.test(page)
    && /href=["']\/assets\/images\/petrus-logo\.png["']/i.test(page)
    && /<div\s+id=["']root["']\s*>\s*<\/div>/i.test(page)
    && Boolean(extractCurrentClientPath(page))
}

export const hasVerifiedCurrentClientSignal = (client = '') => {
  const text = String(client)
  return text.includes('Petrus Technologies is a full-stack digital transformation partner helping manufacturers')
    && text.includes('Petrus Technologies Pvt. Ltd. All rights reserved.')
    && text.includes('mailto:info@petrustechnologies.com')
    && text.includes('mailto:sales@petrustechnologies.com')
    && text.includes('Sivasakthi Colony')
    && text.includes('Ganapathy, Coimbatore')
    && text.includes('Tamil Nadu, India.')
    && ['/', '/about-us', '/company/about-us', '/contact-us', '/company/contact-us', '/resources', '/blog', '*']
      .every(path => text.includes('path:"' + path + '"'))
    && text.includes('createRoot(')
    && !hasBundlePublicJobsSignal(text)
    && !/JobPosting|\bupload resume\b|\bwe are hiring\b/i.test(text)
}

export const createPetrusTechnologiesPvtLtdScraper = () => ({run:runCurrentPetrus})

export const run = async (options = {}) => createPetrusTechnologiesPvtLtdScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  const evidence = readInventoryEvidence(jobs)
  if (evidence?.listingComplete === false) {
    if (isDryRun) {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(path.join(currentDir, 'inventory-evidence.json'), JSON.stringify(evidence, null, 2))
    }
    console.error(evidence.reason)
    process.exitCode = 1
  } else if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
