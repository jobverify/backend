import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GOAPPTIV_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = GOAPPTIV_CATALOG.source
export const COMPANY = GOAPPTIV_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = GOAPPTIV_CATALOG.officialBrandName
export const VERIFIED_ON = GOAPPTIV_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = GOAPPTIV_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = GOAPPTIV_CATALOG
export const HOMEPAGE_URL = GOAPPTIV_CATALOG.companyCareerPage
export const TEAM_CULTURE_URL = GOAPPTIV_CATALOG.teamCulturePageUrl
export const CAREERS_ROUTE_URLS = [
  'https://www.goapptiv.com/careers',
  'https://www.goapptiv.com/career',
  'https://www.goapptiv.com/jobs',
  'https://www.goapptiv.com/hiring',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /href=["'][^"']*\/job\/[a-z0-9-]+/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;|\u2019/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'goapptiv.com' || hostname === 'www.goapptiv.com'
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

export const hasPublicJobsSignal = (html) => {
  const candidate = String(html ?? '').replace(/<!--[\s\S]*?-->/g, ' ')
  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(candidate))
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('goapptiv')
    && normalized.includes('improving access to primary healthcare')
    && (
      normalized.includes('quality medication across india')
      || normalized.includes('quality medicines across india')
    )
    && normalized.includes('business@goapptiv.com')
    && normalized.includes('grievances@goapptiv.com')
    && normalized.includes('the team')
}

export const hasOfficialTeamCultureSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('the core values')
    && normalized.includes('meet the leadership team')
    && normalized.includes('rajasekhar parcha')
    && normalized.includes('business@goapptiv.com')
    && normalized.includes('grievances@goapptiv.com')
}

export const isVerifiedMissingFirstPartyRoute = (page = {}) => {
  if (Number(page.status) !== 404) return false
  if (!isOfficialDomainUrl(page.url || '')) return false
  if (hasPublicJobsSignal(page.text)) return false

  const normalized = normalizeText(page.text)
  return normalized.includes('page not found')
    || (
      normalized.includes('the team')
      && normalized.includes('business@goapptiv.com')
      && normalized.includes('grievances@goapptiv.com')
    )
}

export const createGoApptivScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!homepage.ok || !hasOfficialHomepageSignal(homepage.text)) {
      throw new Error('GoApptiv homepage no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(homepage.text)) {
      throw new Error('GoApptiv homepage now appears to expose public job listings')
    }

    const teamCulturePage = await fetchPage(TEAM_CULTURE_URL)
    if (hasPublicJobsSignal(teamCulturePage.text)) {
      throw new Error('GoApptiv team and culture page now appears to expose public job listings')
    }
    if (!teamCulturePage.ok || !hasOfficialTeamCultureSignal(teamCulturePage.text)) {
      throw new Error('GoApptiv team and culture page no longer matches the verified first-party surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedMissingFirstPartyRoute(careersRoute)) {
        if (hasPublicJobsSignal(careersRoute.text)) {
          throw new Error(`GoApptiv careers route changed materially or now exposes public job listings: ${careersRouteUrl}`)
        }

        throw new Error(`GoApptiv careers route no longer matches the verified first-party 404 surface: ${careersRouteUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createGoApptivScraper().run(options)

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
