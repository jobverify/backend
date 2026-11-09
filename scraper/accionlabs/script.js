import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCurrentAccionRoles } from './currentNative.js'
import CURRENT_NATIVE_METADATA from '../../scraper-support/providers/providerExtensions/zzzz-accionlabs-native-20261103.json' with { type: 'json' }

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'accionlabs'
export const COMPANY = 'Accion Labs'
export const COMPANY_DOMAIN = 'accionlabs.com'
export const VERIFIED_AT = null
export const HOMEPAGE_URL = 'https://www.accionlabs.com/'
export const CAREERS_URL = 'https://www.accionlabs.com/careers'
export const US_OPPORTUNITIES_URL = 'https://www.accionlabs.com/us-opportunities'
export const PRAGUE_ENGINEERING_CENTER_URL = 'https://www.accionlabs.com/prague-engineering-center'
export const SCRAPER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: CAREERS_URL,
  companyDomain: COMPANY_DOMAIN,
  countryFilter: 'India',
  atsPlatform: 'official-company-site-no-public-careers',
  paginationStrategy:
    'verified-homepage-plus-resume-intake-careers-page-plus-supplemental-no-public-job-routes',
  extractionStrategy:
    'verified-first-party-homepage+verified-careers-intake-page+verified-supplemental-no-public-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  ...CURRENT_NATIVE_METADATA,
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\brequisition id\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /href=["'][^"']*\/jobs\/[^"']*["']/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  })

  return {
    ok: response.ok,
    status: response.status,
    url,
    finalUrl: response.url,
    text: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*AI-Led Innovation Engineering Company \| Accion Labs\s*<\/title>/i.test(page)
    && /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.accionlabs\.com\/?"/i.test(page)
    && text.includes('AI-Led Innovation Engineering Company')
    && text.includes('Powered by Semantic Engineering')
    && text.includes('Accion Labs')
    && /href=["'](?:https:\/\/www\.accionlabs\.com)?\/careers\/?["']/i.test(page)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Empower Your Future at Accion Labs \| Where Careers Thrive\s*<\/title>/i.test(page)
    && /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.accionlabs\.com\/careers"/i.test(page)
    && text.includes('Explore Opportunities for Career Growth')
    && text.includes('Join a Thriving Community of Innovators and Collaborators')
    && text.includes('Thrive in Your Career with Accion Labs')
    && text.includes('Kindly provide your information, and we will reach out to you if a suitable match is found.')
    && text.includes('US Opportunities')
    && text.includes('Prague Opportunities')
}

export const hasOfficialPragueEngineeringCenterSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Join our Prague Engineering Center for Career Opportunities\s*<\/title>/i
      .test(page)
    && /<link[^>]+rel="canonical"[^>]+href="https:\/\/www\.accionlabs\.com\/prague-engineering-center"/i
      .test(page)
    && text.includes('Prague Engineering Center')
    && text.includes('Join us and fast-track your career at Accion Prague Engineering Center.')
    && text.includes('Data Platform team')
    && text.includes('Crashtest team')
    && text.includes('Flaw Reporting team')
    && text.includes('Portal UI team')
    && text.includes("If you don't find a position that perfectly matches your profile, don't worry!")
    && text.includes('Spontaneous Application')
    && text.includes('ta.cz@accionlabs.com')
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedUsOpportunitiesRedirect = (page = {}) => {
  const finalUrl = page.finalUrl || page.url || ''

  return page.ok === true
    && finalUrl === CAREERS_URL
    && hasOfficialCareersSignal(page.text)
    && !pageExposesPublicJobListings(page.text)
}

export const createAccionLabsScraper = () => ({
  async run({ fetchPage: providedFetch = defaultFetchPage, signal, now, onAudit } = {}) {
    const fetchPage = async url => {
      signal?.throwIfAborted()
      const page = await providedFetch(url, { signal })
      signal?.throwIfAborted()
      if ((page?.finalUrl || page?.url) !== url && !(url === US_OPPORTUNITIES_URL && page.finalUrl === CAREERS_URL)) {
        throw new Error('Accion Labs current first-party response identity changed')
      }
      return page
    }
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!homepage.ok || !hasOfficialHomepageSignal(homepage.text)) {
      throw new Error('The official Accion Labs homepage no longer matches the verified public surface')
    }

    if (pageExposesPublicJobListings(homepage.text)) {
      throw new Error('The official Accion Labs homepage appears to expose public job listings')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (!careersPage.ok || !hasOfficialCareersSignal(careersPage.text)) {
      throw new Error('The official Accion Labs resume-only careers surface no longer matches the verified public contract')
    }

    const current = await readCurrentAccionRoles({ careersHtml: careersPage.text, read: fetchPage, signal, now, onAudit })
    if (current) return current

    if (pageExposesPublicJobListings(careersPage.text)) {
      throw new Error('The official Accion Labs careers page appears to expose public job listings')
    }

    const usOpportunitiesPage = await fetchPage(US_OPPORTUNITIES_URL)
    if (!isVerifiedUsOpportunitiesRedirect(usOpportunitiesPage)) {
      throw new Error('The official Accion Labs US opportunities route no longer redirects to the verified non-listing careers surface')
    }

    const praguePage = await fetchPage(PRAGUE_ENGINEERING_CENTER_URL)
    if (!praguePage.ok || !hasOfficialPragueEngineeringCenterSignal(praguePage.text)) {
      throw new Error('The official Accion Labs Prague Engineering Center page no longer matches the verified spontaneous-application surface')
    }

    if (pageExposesPublicJobListings(praguePage.text)) {
      throw new Error('The official Accion Labs Prague Engineering Center page appears to expose public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createAccionLabsScraper().run(options)

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
