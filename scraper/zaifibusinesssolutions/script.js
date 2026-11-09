import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'zaifibusinesssolutions'
export const COMPANY = 'ZAi-Fi Business Solutions'
export const VERIFIED_ON = '2026-09-03'
export const FIRST_PARTY_ROOT_URL = 'https://zai-fi.com'
export const HOMEPAGE_URL = `${FIRST_PARTY_ROOT_URL}/`
export const ROBOTS_URL = `${FIRST_PARTY_ROOT_URL}/robots.txt`
export const SITEMAP_URL = `${FIRST_PARTY_ROOT_URL}/sitemap.xml`
export const CAREER_PATHS = [
  '/career',
  '/careers',
  '/jobs',
  '/join-us',
  '/work-with-us',
  '/openings',
]
export const VERIFIED_SURFACE_SUMMARY =
  'Verified the public ZAi-Fi site at https://zai-fi.com on September 3, 2026. Its current Home Intelligence homepage, robots.txt, and sitemap expose no careers route, and common careers URLs return 404.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const CAREER_ROUTE_PATTERN = /\/(?:career|careers|jobs|join-us|work-with-us|openings)(?:\/|$)/i
const CAREER_KEYWORD_PATTERN = /\b(?:career|careers|job openings|join us|work with us|hiring)\b/i
const EXPECTED_HOMEPAGE_TITLE = 'ZAi-Fi | AI Solutions for Business & Manufacturing'
const CURRENT_HOMEPAGE_TITLE = 'HOME INTELLIGENCE - One Home. One AI. Every Room.'
const CURRENT_HOMEPAGE_DESCRIPTION = 'A distributed Home AI system. Central Home AI Hub + Lightweight Voice Nodes. The AI follows the user, not the device.'
const EXPECTED_CANONICAL_URL = 'https://zaifi.co'
const EXPECTED_CONTACT_EMAIL = 'contact@zai-fi.com'
const EXPECTED_SITEMAP_HINT = 'Sitemap: https://zaifi.co/sitemap.xml'

export const buildCandidateCareerUrls = () =>
  CAREER_PATHS.map((careerPath) => `${FIRST_PARTY_ROOT_URL}${careerPath}`)

export const isVerifiedHomepage = (html) => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    .replace(/[\u2013\u2014]/g, '-')
  const canonical = normalizeWhitespace(page.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? '')
  const description = normalizeWhitespace(page.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? '')
  const text = stripTags(page)

  const isLegacyBusinessHomepage = title === EXPECTED_HOMEPAGE_TITLE
    && text.includes(EXPECTED_CONTACT_EMAIL)
  const isCurrentHomeIntelligenceHomepage = title === CURRENT_HOMEPAGE_TITLE
    && description === CURRENT_HOMEPAGE_DESCRIPTION
    && /<meta[^>]+name=["'](?:author|creator|publisher)["'][^>]+content=["']ZAi-Fi["']/i.test(page)
    // The redesigned site publishes the verified contact only in Organization JSON-LD.
    && page.includes(EXPECTED_CONTACT_EMAIL)

  const engineeringOrganization = [...page.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].some(match => {
    try {
      const org = JSON.parse(match[1])
      return org['@type'] === 'Organization' && org.name === 'ZAIFI BUSINESS SOLUTIONS PRIVATE LIMITED'
        && org.alternateName === 'ZAi-Fi' && org.url === 'https://www.zai-fi.com'
        && org.contactPoint?.email === EXPECTED_CONTACT_EMAIL
    } catch { return false }
  })
  const engineeringHome = title === 'ZAi-Fi | Legacy Engineering Drawings to Editable CAD'
    && description === 'Convert scanned, handwritten and legacy engineering drawings into reviewed, editable 2D CAD. Discuss a sample drawing with our team.'
    && canonical === 'https://www.zai-fi.com' && engineeringOrganization
    && text.includes('Turn old engineering drawings into editable CAD.')
    && text.includes('Discuss your drawings')
  return engineeringHome || ((isLegacyBusinessHomepage || isCurrentHomeIntelligenceHomepage)
    && canonical === EXPECTED_CANONICAL_URL)
}

export const sitemapHasCareerRoutes = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .some((url) => CAREER_ROUTE_PATTERN.test(url))

const homepageHasCareerKeywords = (html) => CAREER_KEYWORD_PATTERN.test(stripTags(html))

const hasVerifiedRobotsSignal = (robotsTxt) => {
  const text = normalizeWhitespace(robotsTxt)
  return text.includes('Allow: /')
    && text.includes('Disallow: /api/')
    && text.includes('Disallow: /_next/')
    && (text.includes(EXPECTED_SITEMAP_HINT) || text.includes('Sitemap: https://www.zai-fi.com/sitemap.xml'))
}

const hasVerifiedSitemapSignal = (xml) => {
  const page = String(xml ?? '')
  const locs = [...page.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(match => normalizeWhitespace(match[1]).replace(/\/$/, ''))
  return /<urlset\b/i.test(page) && ['https://zaifi.co', 'https://www.zai-fi.com'].some(origin =>
    ['', '/about', '/services', '/blog'].every(path => locs.includes(origin + path))
    && locs.every(url => url === origin || url.startsWith(origin + '/')))
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,text/plain,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return response.text()
}

const defaultFetchStatus = async (url) => {
  const response = await fetch(url, {
    method: 'HEAD',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (response.status === 405) {
    const fallbackResponse = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })
    return fallbackResponse.status
  }

  return response.status
}

export const createZaifiBusinessSolutionsScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchStatus = defaultFetchStatus,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!isVerifiedHomepage(homepageHtml)) {
      throw new Error(
        'ZAi-Fi verified homepage no longer matches the trusted first-party marketing surface; re-verify before trusting []',
      )
    }

    if (homepageHasCareerKeywords(homepageHtml)) {
      throw new Error(
        'ZAi-Fi homepage now contains careers-like keywords; re-verify the official public jobs surface before trusting []',
      )
    }

    const robotsTxt = await fetchText(ROBOTS_URL)
    if (!hasVerifiedRobotsSignal(robotsTxt)) {
      throw new Error(
        'ZAi-Fi robots.txt no longer matches the verified first-party public surface; re-verify before trusting []',
      )
    }

    const sitemapXml = await fetchText(SITEMAP_URL)
    if (!hasVerifiedSitemapSignal(sitemapXml)) {
      throw new Error(
        'ZAi-Fi public sitemap no longer matches the verified first-party marketing surface; re-verify before trusting []',
      )
    }

    if (sitemapHasCareerRoutes(sitemapXml)) {
      throw new Error(
        'ZAi-Fi public sitemap now exposes a careers-like route; implement a real scraper after re-verifying the first-party jobs surface',
      )
    }

    for (const candidateUrl of buildCandidateCareerUrls()) {
      const status = await fetchStatus(candidateUrl)
      if (status !== 404) {
        throw new Error(
          `ZAi-Fi common careers path no longer returns 404: ${candidateUrl} returned ${status}; re-verify before trusting []`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createZaifiBusinessSolutionsScraper().run(options)

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
