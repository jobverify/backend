import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PATANJALI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bopen jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /successfactors/i,
  /taleo/i,
]

export const PROVIDER_METADATA = PATANJALI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_FORM_URL = PROVIDER_METADATA.officialApplicationFormUrl
export const CONTACT_PAGE_URL = PROVIDER_METADATA.officialCareerContactPage
export const CAUTION_NOTICE_URL = PROVIDER_METADATA.cautionNoticeUrl
export const CAREER_EMAIL = PROVIDER_METADATA.officialCareerEmail

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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)

    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractEmbeddedApplicationFormUrl = (html = '') =>
  String(html ?? '').match(/<iframe[^>]+src=["'](https:\/\/patanjaliayurved\.org\/career\.php)["']/i)?.[1] ?? null

export const extractCareerEmail = (html = '') =>
  normalizeWhitespace(html).match(/\bcareer@patanjaliayurved\.org\b/i)?.[0]?.toLowerCase() ?? null

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*career\s*(?:&#8211;|–|-)\s*Patanjali Ayurved\s*<\/title>/i.test(page)
    && matchesExpectedUrl(extractEmbeddedApplicationFormUrl(page), APPLICATION_FORM_URL)
}

export const hasOfficialApplicationFormSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Job Application Form\s*<\/title>/i.test(page)
    && normalized.includes('Job Application Form')
    && normalized.includes('Category for')
    && normalized.includes('Select Category')
    && normalized.includes('Upload Your Resume')
}

export const hasOfficialContactPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Contact Us\s*(?:&#8211;|–|-)\s*Patanjali Ayurved\s*<\/title>/i.test(page)
    && normalized.includes('For Career')
    && extractCareerEmail(page) === CAREER_EMAIL
    && /href=["']https:\/\/patanjaliayurved\.org\/career\.html["']/i.test(page)
}

export const hasOfficialCautionNoticeSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Caution Notice\s*(?:&#8211;|–|-)\s*Patanjali Ayurved\s*<\/title>/i.test(page)
    && normalized.includes('fake appointment letter')
    && normalized.includes('promise jobs')
    && normalized.includes("don't charge money")
}

export const createPatanjaliScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (pageExposesPublicJobListings(careersPage.html)) {
      throw new Error('Patanjali careers page now appears to expose public jobs')
    }

    if (
      Number(careersPage.status) !== 200
      || !matchesExpectedUrl(careersPage.url, CAREERS_PAGE_URL)
      || !hasOfficialCareersPageSignal(careersPage.html)
    ) {
      throw new Error('Patanjali verified careers page changed materially')
    }

    const embeddedFormUrl = extractEmbeddedApplicationFormUrl(careersPage.html)
    if (!matchesExpectedUrl(embeddedFormUrl, APPLICATION_FORM_URL)) {
      throw new Error('Patanjali verified careers page iframe handoff changed materially')
    }

    const applicationFormPage = await fetchPage(APPLICATION_FORM_URL)
    if (pageExposesPublicJobListings(applicationFormPage.html)) {
      throw new Error('Patanjali application form now appears to expose public jobs')
    }

    if (
      Number(applicationFormPage.status) !== 200
      || !matchesExpectedUrl(applicationFormPage.url, APPLICATION_FORM_URL)
      || !hasOfficialApplicationFormSignal(applicationFormPage.html)
    ) {
      throw new Error('Patanjali verified application form changed materially')
    }

    const contactPage = await fetchPage(CONTACT_PAGE_URL)
    if (
      Number(contactPage.status) !== 200
      || !matchesExpectedUrl(contactPage.url, CONTACT_PAGE_URL)
      || !hasOfficialContactPageSignal(contactPage.html)
    ) {
      throw new Error('Patanjali verified contact page changed materially')
    }

    const cautionPage = await fetchPage(CAUTION_NOTICE_URL)
    if (
      Number(cautionPage.status) !== 200
      || !matchesExpectedUrl(cautionPage.url, CAUTION_NOTICE_URL)
      || !hasOfficialCautionNoticeSignal(cautionPage.html)
    ) {
      throw new Error('Patanjali verified caution notice changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createPatanjaliScraper().run(options)

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
