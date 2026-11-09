import path from 'node:path'
import { fileURLToPath } from 'node:url'

import MOONFROG_LABS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = MOONFROG_LABS_CATALOG
export const SOURCE = MOONFROG_LABS_CATALOG.source
export const COMPANY = MOONFROG_LABS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = MOONFROG_LABS_CATALOG.officialBrandName
export const VERIFIED_ON = MOONFROG_LABS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = MOONFROG_LABS_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = MOONFROG_LABS_CATALOG.homepageUrl
export const CAREERS_URL = MOONFROG_LABS_CATALOG.companyCareerPage
export const RECRUITMENT_PRIVACY_POLICY_URL = MOONFROG_LABS_CATALOG.recruitmentPrivacyPolicyUrl
export const APPLICATION_EMAIL = MOONFROG_LABS_CATALOG.applicationEmail
export const APPLICATION_URL = MOONFROG_LABS_CATALOG.applicationUrl
export const NO_PUBLIC_CAREER_ROUTE_URLS = [
  'https://moonfroglabs.com/jobs/',
  'https://moonfroglabs.com/open-positions/',
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || null

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

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

export const pageExposesPublicJobListings = (html = '') => [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bapply now\b/i,
  /\bview jobs\b/i,
  /\bjob vacancy\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
  /jobdetails/i,
].some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  const title = (extractTitle(page) || '').toLowerCase()

  return title.includes('moonfrog labs')
    && title.includes('leading game design for delightful experiences')
    && /href=["']\/careers\/["']/i.test(page)
    && (
      normalized.includes('world-class mobile games')
      || (normalized.includes('work with us') && normalized.includes('open positions'))
    )
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const title = (extractTitle(page) || '').toLowerCase()

  return title.includes('careers')
    && title.includes('moonfrog labs')
    && /No Open Positions Currently/i.test(normalized)
    && /hr@moonfroglabs\.com/i.test(page)
    && /LinkedIn/i.test(normalized)
    && !pageExposesPublicJobListings(page)
}

export const hasRecruitmentPrivacyPolicySignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  const title = (extractTitle(page) || '').toLowerCase()

  return title.includes('recruitment privacy policy')
    && title.includes('moonfrog labs')
    && normalized.includes('moonfrog labs private limited')
    && /\b(candidate|applicant)\b/i.test(normalized)
}

export const isVerifiedMissingCareerRoute = ({ status, html } = {}) =>
  Number(status) === 404
  && ((extractTitle(html) || '').toLowerCase().includes('moonfrog labs'))
  && ((extractTitle(html) || '').toLowerCase().includes('leading game design for delightful experiences'))
  && !pageExposesPublicJobListings(html)

export const createMoonfrogLabsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage?.status) !== 200
      || normalizeComparableUrl(homepage?.url) !== normalizeComparableUrl(HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage?.html)
    ) {
      throw new Error('The verified Moonfrog Labs homepage changed materially')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      Number(careersPage?.status) !== 200
      || normalizeComparableUrl(careersPage?.url) !== normalizeComparableUrl(CAREERS_URL)
    ) {
      throw new Error('The verified Moonfrog Labs careers page changed materially')
    }

    if (pageExposesPublicJobListings(careersPage?.html)) {
      throw new Error('Moonfrog Labs careers page now appears to expose public job listings')
    }

    if (!hasOfficialCareersSignal(careersPage?.html)) {
      throw new Error('The verified Moonfrog Labs careers page changed materially')
    }

    const privacyPage = await fetchPage(RECRUITMENT_PRIVACY_POLICY_URL)
    if (
      Number(privacyPage?.status) !== 200
      || normalizeComparableUrl(privacyPage?.url)
        !== normalizeComparableUrl(RECRUITMENT_PRIVACY_POLICY_URL)
      || !hasRecruitmentPrivacyPolicySignal(privacyPage?.html)
    ) {
      throw new Error('The verified Moonfrog Labs recruitment privacy policy changed materially')
    }

    for (const routeUrl of NO_PUBLIC_CAREER_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`The verified no-public-careers route changed for Moonfrog Labs: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMoonfrogLabsScraper().run(options)

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
