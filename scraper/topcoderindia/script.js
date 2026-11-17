import {runCurrentNative} from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { TOPCODER_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const GIG_PROGRAM_URL = PROVIDER_METADATA.gigProgramUrl
export const GIG_RESOURCES_URL = PROVIDER_METADATA.gigResourcesUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(value)?.toLowerCase() || ''

export const hasOfficialHomepageSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('fueling innovation, delivery, and the future of work')
    && text.includes('scalable human + ai talent')
    && text.includes('crowd-driven innovation')
}

export const hasGigWorkLandingSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('welcome to gig work at topcoder')
    && text.includes('freelance gigs are the way to go')
    && text.includes('location does not matter')
    && text.includes('usa and india')
    && text.includes('general intake of gig work form')
}

export const hasGigProgramSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('looking for a full time gig or guaranteed income? find it at topcoder.')
    && text.includes('gig work is a full time, freelance position working directly with our customers.')
    && text.includes('being a topcoder member is the first thing you need to do')
    && text.includes('more are being posted daily')
}

export const hasGigTransferSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('gig work update')
    && text.includes('transfer of gig work')
    && text.includes('transferred to wipro')
    && text.includes('talent.topcoder@wipro.com')
    && text.includes('gigs will still be available')
}

export const pageExposesExactNameEmployerJobs = (html = '') => {
  const text = normalizeText(html)

  return text.includes('topcoder india')
    && (
      text.includes('apply now')
      || text.includes('company: topcoder india')
      || /"@type"\s*:\s*"JobPosting"/i.test(String(html ?? ''))
    )
}

export const createTopcoderIndiaScraper = () => ({run:runCurrentNative})

export const run = async (options = {}) => createTopcoderIndiaScraper().run(options)

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
