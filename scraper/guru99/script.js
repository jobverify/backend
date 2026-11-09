import path from 'node:path'
import { fileURLToPath } from 'node:url'

import GURU99_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = GURU99_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const ABOUT_URL = PROVIDER_METADATA.companyCareerPage
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const TERMS_URL = PROVIDER_METADATA.termsUrl
export const CAREER_CONTENT_URL = PROVIDER_METADATA.careerContentSiteUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
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

export const hasPublicJobsBoardSignal = (html = '') => [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bapply now\b/i,
  /boards-api\.greenhouse\.io/i,
  /\.myworkdayjobs\.com/i,
  /\.darwinbox\.in/i,
  /lever\.co/i,
].some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialAboutSignal = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html)

  return page?.status === 200
    && page?.url === ABOUT_URL
    && normalized.includes('Guru99 was founded in the year 2008 by technology enthusiast and expert Krishna Rungta as an educational content platform for software-focused learners.')
    && normalized.includes('Guru99 empowers individuals by keeping them conversant and highly informed about software.')
    && normalized.includes('Contribute a Tutorial')
    && normalized.includes('We are looking for great instructors like you to create awesome courses for our community.')
}

export const hasOfficialContactSignal = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html)

  return page?.status === 200
    && page?.url === CONTACT_URL
    && normalized.includes('Guru99')
    && normalized.includes('Titanium City Center')
    && normalized.includes('Ahmedabad, Gujarat, India')
    && (
      normalized.includes('Happy to Help')
      || (normalized.includes('Advertising') && normalized.includes('Editorial'))
    )
}

export const hasOfficialTermsSignal = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html)

  return page?.status === 200
    && page?.url === TERMS_URL
    && normalized.includes('Guru99 Tech Pvt Ltd')
    && normalized.includes('U72900GJ2013PTC074450')
    && normalized.includes('leading Edu-tech Company')
}

export const hasCareerContentSignal = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html)

  return page?.status === 200
    && page?.url === CAREER_CONTENT_URL
    && normalized.includes('Career Guru99 helps you get your Dream Job')
    && normalized.includes('We make tons of efforts to take boredom out of learning and make it fun')
    && normalized.includes('Interview Question Library')
    && normalized.includes('Search you Favorite Interview Question')
    && !hasPublicJobsBoardSignal(page?.html)
}

export const createGuru99Scraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const aboutPage = await fetchPage(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutPage)) {
      throw new Error('The verified Guru99 about page no longer matches the known first-party company surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (!hasOfficialContactSignal(contactPage)) {
      throw new Error('The verified Guru99 contact page no longer matches the known first-party company surface')
    }

    const termsPage = await fetchPage(TERMS_URL)
    if (!hasOfficialTermsSignal(termsPage)) {
      throw new Error('The verified Guru99 terms page no longer matches the known first-party company surface')
    }

    const careerContentPage = await fetchPage(CAREER_CONTENT_URL)
    if (!hasCareerContentSignal(careerContentPage)) {
      throw new Error('The verified Guru99 content-only state no longer matches the known first-party microsite')
    }

    return []
  },
})

export const run = async (options = {}) => createGuru99Scraper().run(options)

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
