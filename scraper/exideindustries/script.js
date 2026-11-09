import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { EXIDE_INDUSTRIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = EXIDE_INDUSTRIES_CATALOG.source
export const COMPANY = EXIDE_INDUSTRIES_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = EXIDE_INDUSTRIES_CATALOG.officialBrandName
export const VERIFIED_ON = EXIDE_INDUSTRIES_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = EXIDE_INDUSTRIES_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = EXIDE_INDUSTRIES_CATALOG
export const HOMEPAGE_URL = EXIDE_INDUSTRIES_CATALOG.homepageUrl
export const CAREERS_LANDING_URL = EXIDE_INDUSTRIES_CATALOG.officialCareerLandingUrl
export const CURRENT_VACANCY_URL = EXIDE_INDUSTRIES_CATALOG.currentVacancyUrl
export const DROP_CV_URL = EXIDE_INDUSTRIES_CATALOG.dropCvUrl
export const EXTERNAL_JOBS_HOST = EXIDE_INDUSTRIES_CATALOG.externalJobsHost

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Exide - India's largest selling batteries\s*<\/title>/i.test(rawHtml)
    && /href=["']https:\/\/careers\.exideindustries\.com\/["']/i.test(rawHtml)
    && normalized.includes('Automotive Batteries')
    && normalized.includes('Inverter Batteries')
}

export const hasOfficialCareersLandingSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*:: EXIDE CAREERS ::\s*<\/title>/i.test(rawHtml)
    && /href=["'][^"']*\/current-vacancy\.aspx["']/i.test(rawHtml)
    && normalized.includes('Vacancies @ Exide')
    && normalized.includes('Professionals')
    && normalized.includes('Interns')
    && normalized.includes('Discover the promise of Exide')
}

export const hasExternalNaukriHandoffSignal = (html) =>
  /href=["']https?:\/\/(?:www\.)?naukri\.com\/[^"']+["']/i.test(String(html ?? ''))

export const hasNoPublicJobsCurrentVacancySignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*:: EXIDE CAREERS - Current Vacancy ::\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Current Vacancy')
    && normalized.includes('We could not find you any jobs.')
    && normalized.includes('No jobs are posted right now.')
    && normalized.includes('Drop your CV here')
    && /href=["'][^"']*\/drop-cv\.aspx["']/i.test(rawHtml)
    && hasExternalNaukriHandoffSignal(rawHtml)
}

export const hasDropCvSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*:: EXIDE CAREERS - Current Vacancy ::\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Drop your CV')
    && normalized.includes('upload CV in Word/PDF format')
    && normalized.includes('Maximum file size is 2 MB')
    && normalized.includes('Enter image verification code')
}

export const createExideIndustriesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Exide Industries verified official homepage no longer matches the known public surface')
    }

    const careersLanding = await fetchPage(CAREERS_LANDING_URL)
    if (careersLanding.status !== 200 || !hasOfficialCareersLandingSignal(careersLanding.html)) {
      throw new Error('Exide Industries verified careers landing page no longer matches the known careers shell')
    }

    const currentVacancy = await fetchPage(CURRENT_VACANCY_URL)
    if (currentVacancy.status !== 200 || !hasNoPublicJobsCurrentVacancySignal(currentVacancy.html)) {
      throw new Error('Exide Industries verified current vacancy no-public-jobs handoff no longer matches the known public surface')
    }

    const dropCv = await fetchPage(DROP_CV_URL)
    if (dropCv.status !== 200 || !hasDropCvSignal(dropCv.html)) {
      throw new Error('Exide Industries verified drop cv form no longer matches the known public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createExideIndustriesScraper().run(options)

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
