import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runCurrentSecPod } from './currentNative20261120.js'

import { SECPOD_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractCurrentJobOpeningsSection = (html = '') => {
  const match = String(html ?? '').match(
    /<section[^>]*>\s*<h2[^>]*>\s*Current Job Openings\s*<\/h2>([\s\S]*?)<\/section>/i,
  )

  return match?.[1] ?? ''
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page).toLowerCase()

  return /<title[^>]*>\s*SecPod Careers \| Join the Preventive Cybersecurity Team \| SecPod\s*<\/title>/i.test(page)
    && text.includes('shape the future of preventive cybersecurity with secpod')
    && text.includes('technology & innovation')
    && text.includes('teams at secpod')
    && text.includes('current job openings')
}

export const hasPublicJobsSignal = (html = '') => {
  const openingsSection = extractCurrentJobOpeningsSection(html)

  return /<article\b/i.test(openingsSection)
    || /class=["'][^"']*job[-\s]?card/i.test(openingsSection)
    || /Apply now/i.test(openingsSection)
    || /href=["'][^"']+["']/i.test(openingsSection)
}

export const createSecPodScraper = () => ({
  async run(options = {}) {
    return runCurrentSecPod(options, careersHtml => {
      if (hasPublicJobsSignal(careersHtml)) {
        throw new Error('SecPod surface now appears to expose public jobs')
      }

      if (!hasOfficialCareersSignal(careersHtml)) {
        throw new Error('SecPod verified official careers page no longer matches the trusted first-party surface')
      }

      return []
    })
  },
})

export const run = async (options = {}) => createSecPodScraper().run(options)

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
