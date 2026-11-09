import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ACCEDERE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ACCEDERE_CATALOG.source
export const COMPANY = ACCEDERE_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ACCEDERE_CATALOG.officialBrandName
export const VERIFIED_ON = ACCEDERE_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ACCEDERE_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = ACCEDERE_CATALOG
export const HOMEPAGE_URL = ACCEDERE_CATALOG.companyCareerPage
export const ABOUT_URL = ACCEDERE_CATALOG.aboutPageUrl
export const CONTACT_URL = ACCEDERE_CATALOG.contactPageUrl
export const CAREERS_ROUTE_URLS = [
  'https://accedere.io/careers',
  'https://accedere.io/career',
  'https://accedere.io/jobs',
  'https://accedere.io/job',
  'https://accedere.io/join-us',
  'https://accedere.io/openings',
  'https://accedere.io/work-with-us',
  'https://accedere.io/hiring',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)\s+hiring\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;|\u2019/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|\u201c|\u201d/gi, '"')
  .replace(/&#8211;|&ndash;|\u2013|\u2014/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'accedere.io' || hostname === 'www.accedere.io'
  } catch {
    return false
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
    ok: response.ok,
    status: response.status,
    url: response.url,
    text: await response.text(),
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasFirstPartyCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:www\.)?accedere\.io)?\/(?:career|careers|jobs?|join-us|openings|work-with-us|hiring)(?:\/|["'#?])/i.test(rawHtml)
    || /href=["']\/(?:career|careers|jobs?|join-us|openings|work-with-us|hiring)(?:\/|["'#?])/i.test(rawHtml)
}

const hasOfficialSiteShellSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('accedere')
    && normalized.includes('soc attest reports')
    && normalized.includes('global federal assessments')
    && normalized.includes('privacy assessments')
    && normalized.includes('cloud security assessments')
    && normalized.includes('iso/iec certification')
    && normalized.includes('training programs')
    && normalized.includes('esg reporting services')
    && normalized.includes('company')
    && normalized.includes('about us')
    && normalized.includes('contact')
    && normalized.includes('119 andheri industrial estate, off veera desai road, andheri west, mumbai 400053')
    && normalized.includes('designed by accedere')
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeText(html)

  return hasOfficialSiteShellSignal(html)
    && normalized.includes('blogs')
    && normalized.includes('our services')
    && normalized.includes('999, 18th st, #3000, denver, colorado 80202')
}

export const hasOfficialAboutSignal = (html) => hasOfficialSiteShellSignal(html)

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeText(html)

  return hasOfficialSiteShellSignal(html)
    && normalized.includes('999, 18th st, #3000, denver, colorado 80202')
    && normalized.includes('innovation one level 3 dubai ai campus')
}

export const isVerifiedMissingFirstPartyRoute = (page = {}) =>
  Number(page.status) === 404
  && isOfficialDomainUrl(page.url || '')
  && !hasPublicJobsSignal(page.text)
  && !hasFirstPartyCareerLikeLink(page.text)

const routeKeepsVerifiedNoPublicJobsSurface = (page = {}) => {
  if (!isOfficialDomainUrl(page.url || '')) return false
  if (hasPublicJobsSignal(page.text) || hasFirstPartyCareerLikeLink(page.text)) return false

  if (Number(page.status) === 404) return true
  if (!page.ok) return false

  return hasOfficialHomepageSignal(page.text)
    || hasOfficialAboutSignal(page.text)
    || hasOfficialContactSignal(page.text)
}

export const createAccedereScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!homepage.ok || !hasOfficialHomepageSignal(homepage.text)) {
      throw new Error('Accedere homepage no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(homepage.text)) {
      throw new Error('Accedere homepage now appears to expose public jobs')
    }
    if (hasFirstPartyCareerLikeLink(homepage.text)) {
      throw new Error('Accedere homepage now exposes a first-party careers or jobs link')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (!aboutPage.ok || !hasOfficialAboutSignal(aboutPage.text)) {
      throw new Error('Accedere about page no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(aboutPage.text) || hasFirstPartyCareerLikeLink(aboutPage.text)) {
      throw new Error('Accedere about page now appears to expose a careers or jobs surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (!contactPage.ok || !hasOfficialContactSignal(contactPage.text)) {
      throw new Error('Accedere contact page no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(contactPage.text) || hasFirstPartyCareerLikeLink(contactPage.text)) {
      throw new Error('Accedere contact page now appears to expose a careers or jobs surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!routeKeepsVerifiedNoPublicJobsSurface(careersRoute)) {
        throw new Error(`Accedere careers route changed materially or now exposes public jobs: ${careersRouteUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAccedereScraper().run(options)

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
