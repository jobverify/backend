import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'brysa'
export const COMPANY = 'Brysa'
export const HOMEPAGE_URL = 'https://brysa.ai/'
export const ABOUT_URL = 'https://brysa.ai/about-us'
export const CONTACT_URL = 'https://brysa.ai/contact-us'
export const SITEMAP_URL = 'https://brysa.ai/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://brysa.ai/careers',
  'https://brysa.ai/careers/',
  'https://brysa.ai/career',
  'https://brysa.ai/career/',
  'https://brysa.ai/jobs',
  'https://brysa.ai/jobs/',
  'https://brysa.ai/join-us',
  'https://brysa.ai/join-us/',
  'https://brysa.ai/openings',
  'https://brysa.ai/openings/',
  'https://brysa.ai/work-with-us',
  'https://brysa.ai/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?brysa\.ai)?\/(?:careers?|jobs?|join-us|openings|work-with-us)(?:[\/#?][^"']*)?["']/i

const ABOUT_JOIN_TEAM_CONTACT_HANDOFF_PATTERN =
  /<a[^>]+href=["'](?:https?:\/\/(?:www\.)?brysa\.ai)?\/contact-us(?:\?[^"']*)?["'][^>]*>\s*Join our team\b/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
]

const normalizeEncodingArtifacts = (value) =>
  String(value ?? '')
    .replace(/â€™|â€˜/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€“|â€”|â€‘/g, '-')

const normalizeWhitespace = (value) =>
  normalizeEncodingArtifacts(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeHtml = (value) =>
  normalizeEncodingArtifacts(value)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const raw = normalizeEncodingArtifacts(html)
  const normalized = normalizeWhitespace(html)

  const hasCurrentSignal =
    /<title>\s*Brysa AI \| Salesforce Consulting, AI &amp; Digital Transformation Experts\s*<\/title>/i.test(raw)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/brysa\.ai\/?["']/i.test(raw)
    && normalized.includes('Helping you find your flow')
    && normalized.includes('Salesforce Consulting Services')

  const hasVerifiedLegacySignal =
    /<title>\s*Digital Transformation Consultancy &amp; implementation service in London, UK \| Brysa\s*<\/title>/i.test(raw)
    && raw.includes('Brysa is a UK-based Salesforce partner specializing in management services.')
    && normalized.includes('We are a UK-based digital transformation consultant')
    && normalized.includes('Our Teams, Values & Mission')

  return hasCurrentSignal || hasVerifiedLegacySignal
}

export const hasOfficialAboutSignal = (html) => {
  const raw = normalizeEncodingArtifacts(html)
  const normalized = normalizeWhitespace(html)

  return /<title>\s*About Brysa \| Salesforce, AI &amp; Digital Transformation Experts\s*<\/title>/i.test(raw)
    && (
      /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/brysa\.ai\/about-us\/?["']/i.test(raw)
      || /<h1>\s*About Brysa\s*<\/h1>/i.test(raw)
    )
    && (
      normalized.includes('We are a people-first Salesforce Consulting Company.')
      || normalized.includes("unlock your team's true potential")
    )
}

export const hasOfficialContactSignal = (html) => {
  const raw = normalizeEncodingArtifacts(html)
  const normalized = normalizeWhitespace(html)

  return /<title>\s*Get in Touch with Brysa for Crm and Salesforce Support Today\s*<\/title>/i.test(raw)
    && (
      /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/brysa\.ai\/contact-us\/?["']/i.test(raw)
      || /<h1>\s*Get in touch\s*<\/h1>/i.test(raw)
    )
    && /Get in touch/i.test(normalized)
    && normalized.includes('Contact Us')
}

export const hasExpectedJoinTeamContactHandoff = (html) =>
  ABOUT_JOIN_TEAM_CONTACT_HANDOFF_PATTERN.test(String(html ?? ''))

export const hasUnexpectedCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || []

  return matches.some((entry) =>
    /\b(careers?|jobs?|join-us|openings|work-with-us)\b/i.test(
      entry.replace(/^<loc>|<\/loc>$/gi, ''),
    ))
}

export const isVerifiedMissingCareersRoute = (page = {}) => {
  const raw = normalizeHtml(page?.html)

  return Number(page?.status) === 404
    && raw.includes('<title>error 404 | page not found</title>')
    && raw.includes('https://brysa.ai/404')
    && raw.includes('page not found')
    && !hasUnexpectedCareerLikeLink(page?.html)
    && !hasPublicJobsSignal(page?.html)
}

export const createBrysaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Brysa verified official homepage no longer matches the known first-party surface')
    }
    if (hasUnexpectedCareerLikeLink(homepage.html)) {
      throw new Error('Brysa homepage now exposes a first-party careers path')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Brysa homepage now appears to expose a public jobs surface')
    }

    const about = await fetchPage(ABOUT_URL)
    if (about.status !== 200 || !hasOfficialAboutSignal(about.html)) {
      throw new Error('Brysa verified about page no longer matches the known first-party surface')
    }
    if (hasUnexpectedCareerLikeLink(about.html)) {
      throw new Error('Brysa about page now exposes a public careers handoff')
    }
    if (hasPublicJobsSignal(about.html)) {
      throw new Error('Brysa about page now appears to expose a public jobs surface')
    }

    const contact = await fetchPage(CONTACT_URL)
    if (contact.status !== 200 || !hasOfficialContactSignal(contact.html)) {
      throw new Error('Brysa verified contact page no longer matches the known first-party surface')
    }
    if (hasUnexpectedCareerLikeLink(contact.html)) {
      throw new Error('Brysa contact page now exposes a first-party careers path')
    }
    if (hasPublicJobsSignal(contact.html)) {
      throw new Error('Brysa contact page now appears to expose a public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || sitemapHasCareerLikeUrl(sitemap.html)) {
      throw new Error('Brysa verified sitemap no longer matches the no-public-careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareersRoute(routePage)) {
        throw new Error(
          `Brysa verified missing first-party careers route changed or now exposes a public careers surface: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createBrysaScraper().run(options)

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
