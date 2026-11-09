import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { LUMAX_INDUSTRIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = LUMAX_INDUSTRIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const OFFICIAL_COMPANY_PAGE_URL = PROVIDER_METADATA.officialCompanyPageUrl
export const CURRENT_OPENINGS_URL = PROVIDER_METADATA.jobsBoardUrl
export const WORK_WITH_US_URL = PROVIDER_METADATA.workWithUsUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripHtmlComments = (value) => String(value ?? '').replace(/<!--[\s\S]*?-->/g, ' ')

const containsAll = (page, patterns) => patterns.every((pattern) => pattern.test(page))

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

export const hasOfficialCompanySignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return containsAll(page, [
    /<title>\s*Auto Lights Supplier\s*\|\s*Light Manufacturers In India\s*\|\s*Lumax Industries\s*<\/title>/i,
  ]) && /Lumax Industries Limited/i.test(text)
    && /automotive lighting/i.test(text)
    && /(BSE and NSE|publicly listed)/i.test(text)
}

export const hasOfficialCurrentOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return containsAll(page, [
    /<title>\s*Lumax World\s*\|\s*lumax career\s*&amp;\s*Job Openings\s*<\/title>/i,
  ]) && /current openings/i.test(text)
}

export const hasOfficialWorkWithUsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return containsAll(page, [
    /<title>\s*Lumax World\s*\|\s*Work-with-us\s*<\/title>/i,
    /formvalidate_workwithus_lumax\.php/i,
    /springboard@lumaxmail\.com/i,
  ]) && /work with us/i.test(text)
}

export const hasLivePublicOpeningSignal = (html = '') => {
  const page = stripHtmlComments(String(html ?? ''))
  const text = normalizeWhitespace(page)

  return (
    /\b\d+\s+Vacanc(?:y|ies)\b/i.test(text)
    || /there (?:is|are) currently \d+ vacanc(?:y|ies)/i.test(text)
    || /\bexecutive\/sr executive\b/i.test(text)
    || /\bmanager\s*\/\s*div\.\s*manager\b/i.test(text)
  ) && /(Apply Now|quarter-text|accordion_head1|pdf\/Lumax-JD-|current-opening-col)/i.test(page)
}

export const createLumaxIndustriesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const companyPage = await fetchPage(OFFICIAL_COMPANY_PAGE_URL)
    if (
      companyPage.status !== 200
      || companyPage.url !== OFFICIAL_COMPANY_PAGE_URL
      || !hasOfficialCompanySignal(companyPage.html)
    ) {
      throw new Error('Lumax Industries verified listed-company page no longer matches the trusted first-party surface')
    }

    const currentOpeningsPage = await fetchPage(CURRENT_OPENINGS_URL)
    if (
      currentOpeningsPage.status !== 200
      || currentOpeningsPage.url !== CURRENT_OPENINGS_URL
      || !hasOfficialCurrentOpeningsSignal(currentOpeningsPage.html)
    ) {
      throw new Error('Lumax Industries verified current-openings page no longer matches the trusted first-party surface')
    }

    if (hasLivePublicOpeningSignal(currentOpeningsPage.html)) {
      throw new Error('Lumax Industries current-openings page now exposes live public openings; review required before returning an empty result')
    }

    const workWithUsPage = await fetchPage(WORK_WITH_US_URL)
    if (
      workWithUsPage.status !== 200
      || workWithUsPage.url !== WORK_WITH_US_URL
      || !hasOfficialWorkWithUsSignal(workWithUsPage.html)
    ) {
      throw new Error('Lumax Industries verified work-with-us page no longer matches the trusted first-party surface')
    }

    if (hasLivePublicOpeningSignal(workWithUsPage.html)) {
      throw new Error('Lumax Industries work-with-us page now exposes live public openings; review required before returning an empty result')
    }

    return []
  },
})

export const run = async (options = {}) => createLumaxIndustriesScraper().run(options)

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
