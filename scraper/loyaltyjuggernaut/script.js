import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'loyaltyjuggernaut'
export const COMPANY = 'Loyalty Juggernaut'
export const HOMEPAGE_URL = 'https://www.lji.io/'
export const ABOUT_URL = 'https://www.lji.io/about-us'
export const CAREERS_ROUTE_URLS = [
  'https://www.lji.io/careers',
  'https://www.lji.io/careers/',
  'https://www.lji.io/jobs',
  'https://www.lji.io/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_LINK_PATTERN =
  /href=["'](?:https:\/\/(?:www\.)?lji\.io)?\/(?:careers?|jobs?|join-us|work-with-us|openings?|vacanc(?:y|ies))(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
  /darwinbox/i,
]

const HOMEPAGE_DESCRIPTION_PATTERN =
  /<meta\s+name="description"\s+content="Agentic AI, real-time experiences, ecosystem-scale intelligence\. What legacy platforms were never built to deliver\."\s*\/?>/i

const ABOUT_DESCRIPTION_PATTERN =
  /<meta\s+name="description"\s+content="Loyalty Juggernaut, founded 2015 in Palo Alto\. 200\+ people across 7 offices, building the loyalty operating layer the world(?:&#39;|')s largest programs run on\."\s*\/?>/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&middot;|&#183;/gi, ' ')
  .replace(/&reg;|&#174;/gi, ' ')
  .replace(/&trade;|&#8482;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
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
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()
  const legacyIdentity = /<title>\s*Loyalty Juggernaut\.\s*Transform loyalty into the enterprise growth engine\.\s*<\/title>/i.test(rawHtml)
    && HOMEPAGE_DESCRIPTION_PATTERN.test(rawHtml)
  const currentIdentity = /<title>\s*Loyalty Juggernaut\s*(?:·|&middot;)\s*Loyalty as an Enterprise Growth Engine\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/(?:www\.)?lji\.io\/["']/i.test(rawHtml)
    && [...rawHtml.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].some((match) => {
      try {
        const organization = JSON.parse(match[1])
        return organization['@type'] === 'Organization'
          && organization.name === 'Loyalty Juggernaut, Inc.'
          && /^https:\/\/(?:www\.)?lji\.io\/?$/.test(organization.url)
      } catch {
        return false
      }
    })

  return (legacyIdentity || currentIdentity)
    && /alt="Loyalty Juggernaut"/i.test(rawHtml)
    && /href="\/about-us"/i.test(rawHtml)
    && /href="\/contact-us"/i.test(rawHtml)
    && (
      normalized.includes('transform loyalty into your enterprise growth engine')
      || normalized.includes('enterprise loyalty platform. agentic ai. real-time intelligence. built on gravty')
    )
}

export const hasOfficialAboutSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()
  const legacyCopy = normalized.includes('about loyalty juggernaut')
    && normalized.includes('born in silicon valley in 2015')
    && normalized.includes('palo alto, california')
    && normalized.includes('founded 2015')
  const officialOrganization = [...rawHtml.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].some((match) => {
    try {
      const organization = JSON.parse(match[1])
      return organization['@type'] === 'Organization'
        && organization.name === 'Loyalty Juggernaut, Inc.'
        && /^https:\/\/(?:www\.)?lji\.io\/?$/.test(organization.url)
    } catch {
      return false
    }
  })
  const currentCopy = officialOrganization
    && /founded in silicon valley\s*(?:·)?\s*2015/.test(normalized)
    && normalized.includes('leading the next era of enterprise loyalty')
    && normalized.includes('palo alto, ca')

  return /<title>\s*About Us\s*(?:&middot;|·|Â·)\s*Loyalty Juggernaut\s*<\/title>/i.test(rawHtml)
    && ABOUT_DESCRIPTION_PATTERN.test(rawHtml)
    && normalized.includes('global headquarters')
    && /href="\/contact-us"/i.test(rawHtml)
    && (legacyCopy || currentCopy)
}

export const hasFirstPartyCareerLikeLink = (html) =>
  CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) =>
  Number(page?.status) === 404
  && !hasFirstPartyCareerLikeLink(page?.html)
  && !hasPublicJobsSignal(page?.html)

export const createLoyaltyJuggernautScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Loyalty Juggernaut verified official homepage no longer matches the known first-party surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html) || hasPublicJobsSignal(homepage.html)) {
      throw new Error('Loyalty Juggernaut homepage now exposes a first-party careers or public jobs surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)

    if (aboutPage.status !== 200 || !hasOfficialAboutSignal(aboutPage.html)) {
      throw new Error('Loyalty Juggernaut verified about page no longer matches the known first-party surface')
    }

    if (hasFirstPartyCareerLikeLink(aboutPage.html) || hasPublicJobsSignal(aboutPage.html)) {
      throw new Error('Loyalty Juggernaut about page now exposes a first-party careers or public jobs surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)

      if (!isVerifiedMissingCareersRoute(careersRoute)) {
        throw new Error('Loyalty Juggernaut careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createLoyaltyJuggernautScraper().run(options)

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
