import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ELLENBARRIE_INDUSTRIAL_GASES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ELLENBARRIE_INDUSTRIAL_GASES_CATALOG.source
export const COMPANY = ELLENBARRIE_INDUSTRIAL_GASES_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ELLENBARRIE_INDUSTRIAL_GASES_CATALOG.officialBrandName
export const VERIFIED_ON = ELLENBARRIE_INDUSTRIAL_GASES_CATALOG.verifiedOn
export const PROVIDER_METADATA = ELLENBARRIE_INDUSTRIAL_GASES_CATALOG
export const HOMEPAGE_URL = ELLENBARRIE_INDUSTRIAL_GASES_CATALOG.homepageUrl
export const CAREER_PAGE_URL = ELLENBARRIE_INDUSTRIAL_GASES_CATALOG.companyCareerPage
export const ROBOTS_TXT_URL = ELLENBARRIE_INDUSTRIAL_GASES_CATALOG.robotsTxtUrl
export const SITEMAP_URL = ELLENBARRIE_INDUSTRIAL_GASES_CATALOG.sitemapUrl
export const APPLICATION_EMAIL = ELLENBARRIE_INDUSTRIAL_GASES_CATALOG.applicationEmail
export const COMMON_MISSING_ROUTE_URLS = [
  'https://ellenbarrie.com/careers',
  'https://ellenbarrie.com/jobs',
  'https://ellenbarrie.com/join-us',
  'https://ellenbarrie.com/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Ellenbarrie\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/ellenbarrie\.com\/["']/i.test(page)
    && /href=["']https:\/\/ellenbarrie\.com\/career\/["']/i.test(page)
    && /mailto:info@ellenbarrie\.com/i.test(page)
}

export const hasCareerPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Career(?:\s|&[^;]+;|-)+Ellenbarrie\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/ellenbarrie\.com\/career\/["']/i.test(page)
    && normalized.includes('Join Our Team')
    && normalized.includes('Why Work with Us?')
    && normalized.includes('Opportunities Await!')
    && normalized.includes('Apply Now')
    && /<form[^>]+action=["']\/career\/#wpcf7-f1766-p1101-o1["']/i.test(page)
    && /name=["']candidate_name["']/i.test(page)
    && /name=["']sender_mail["']/i.test(page)
    && /name=["']your_phoneno["']/i.test(page)
    && /name=["']select_file["']/i.test(page)
    && /mailto:info@ellenbarrie\.com/i.test(page)
}

export const hasRobotsTxtSignal = (text = '') =>
  /Sitemap:\s*https:\/\/ellenbarrie\.com\/wp-sitemap\.xml/i.test(String(text ?? ''))

export const hasSitemapSignal = (text = '') => {
  const sitemap = String(text ?? '')

  return /<loc>https:\/\/ellenbarrie\.com\/wp-sitemap-posts-page-1\.xml<\/loc>/i.test(sitemap)
    && /<loc>https:\/\/ellenbarrie\.com\/wp-sitemap-users-1\.xml<\/loc>/i.test(sitemap)
}

export const hasUnexpectedPublicOpeningSignal = (html = '') => {
  const page = String(html ?? '')

  if (/JobPosting/i.test(page)) {
    return true
  }

  for (const match of page.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(match[1], CAREER_PAGE_URL)
      const pathname = url.pathname.toLowerCase()

      if (url.origin !== 'https://ellenbarrie.com') continue
      if (pathname === '/career/' || pathname === '/careers' || pathname === '/jobs') continue
      if (/(opening|vacanc|position|job)/i.test(pathname)) {
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

const isExpectedMissingRoute = (response) => response?.status === 404

export const createEllenbarrieIndustrialGasesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Ellenbarrie Industrial Gases verified homepage no longer matches the trusted first-party surface')
    }

    const careerPage = await fetchPage(CAREER_PAGE_URL)
    if (careerPage.status === 200
      && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/ellenbarrie\.com\/career\/["']/i.test(careerPage.html)
      && /wpcf7-contact-form-not-found/i.test(careerPage.html)
      && /Error:\s*Contact form not found\./i.test(normalizeWhitespace(String(careerPage.html).replace(/<[^>]+>/g, ' ')))) {
      throw Object.assign(new Error('Ellenbarrie Industrial Gases public careers inventory is unavailable: the first-party contact form is missing (Contact form not found)'), {
        code: 'ELLENBARRIE_INVENTORY_UNAVAILABLE',
        softFailure: true,
        failureKind: 'upstream_inventory_unavailable',
        abortRetries: true,
      })
    }

    if (careerPage.status !== 200 || !hasCareerPageSignal(careerPage.html)) {
      throw new Error('Ellenbarrie Industrial Gases verified career page no longer matches the trusted first-party form surface')
    }

    if (hasUnexpectedPublicOpeningSignal(careerPage.html)) {
      throw new Error('Ellenbarrie Industrial Gases public openings surface changed and needs re-verification')
    }

    const robotsTxt = await fetchPage(ROBOTS_TXT_URL)
    if (robotsTxt.status !== 200 || !hasRobotsTxtSignal(robotsTxt.html)) {
      throw new Error('Ellenbarrie Industrial Gases robots.txt no longer matches the verified sitemap contract')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasSitemapSignal(sitemap.html)) {
      throw new Error('Ellenbarrie Industrial Gases sitemap no longer matches the verified WordPress index contract')
    }

    for (const url of COMMON_MISSING_ROUTE_URLS) {
      const response = await fetchPage(url)
      if (!isExpectedMissingRoute(response)) {
        throw new Error(`Ellenbarrie Industrial Gases missing-route contract drifted: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) =>
  createEllenbarrieIndustrialGasesScraper(options).run(options)

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
