import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'certo'
export const COMPANY = 'Certo'
export const HOMEPAGE_URL = 'https://www.certosoftware.com/'
export const ABOUT_URL = 'https://www.certosoftware.com/about/'
export const SITEMAP_URL = 'https://www.certosoftware.com/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.certosoftware.com/careers',
  'https://www.certosoftware.com/careers/',
  'https://www.certosoftware.com/jobs',
  'https://www.certosoftware.com/jobs/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_URL_PATTERN = /\/(?:careers?|jobs?)(?:\/|$|[?#])/i
const ATS_URL_PATTERN =
  /boards\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|workable\.com|linkedin\.com\/jobs\/|linkedin\.com\/company\/[^/"']+\/jobs\/?/i

const PUBLIC_JOBS_TEXT_PATTERNS = [
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bopen roles?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bjoin our team\b/i,
  /\bwork with us\b/i,
  /\bvacancies\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/&#8211;?|&#x2013;?|&ndash;?/gi, '-')
  .replace(/\u2013|\u2014/g, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\s+/g, ' ')
  .trim()

const extractVisibleText = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitleText = (html) => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '',
)

const extractSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+)(?:\]\]>)?\s*<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,text/plain;q=0.7,*/*;q=0.6',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasPublicJobsSignal = (html) => {
  const page = String(html ?? '')
  const text = extractVisibleText(page)

  return PUBLIC_JOBS_TEXT_PATTERNS.some((pattern) => pattern.test(text))
    || ATS_URL_PATTERN.test(page)
  }

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = extractVisibleText(page)

  return /<title>\s*iPhone\s*&amp;\s*Android Spyware Detection\s*\|\s*Certo Software\s*<\/title>/i.test(page)
    && text.includes('Your mobile privacy is our mission')
    && text.includes('Think your phone has been hacked?')
    && text.includes("At Certo, mobile security is not an afterthought, it's what we do.")
    && text.includes('Certo Software Limited')
  }

export const hasOfficialAboutPageSignal = (html) => {
  const page = String(html ?? '')
  const text = extractVisibleText(page)

  return /<title>\s*About Certo\s*\|\s*The iPhone\s*&amp;\s*Android Security Experts\s*<\/title>/i.test(page)
    && text.includes('We believe in a right to privacy')
    && text.includes('At Certo, we enable iOS and Android users to quickly and easily scan their device for spyware and security vulnerabilities.')
    && text.includes('Our story')
    && text.includes('Certo Software is born')
    && text.includes('Certo wins Gold Cybersecurity Award')
    && text.includes('Certo Software Limited')
  }

export const hasOfficialSitemapSignal = (xml) => {
  const urls = extractSitemapUrls(xml)
  const urlSet = new Set(urls)

  return urlSet.has(HOMEPAGE_URL)
    && urlSet.has(ABOUT_URL)
    && !urls.some((url) => CAREER_LIKE_URL_PATTERN.test(url))
    && !urls.some((url) => ATS_URL_PATTERN.test(url))
  }

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = extractVisibleText(html).toLowerCase()
  const title = extractTitleText(html)

  return Number(page?.status) === 404
    && /^Page not found\s*(?:-|&ndash;|&mdash;|&#8211;|&#8212;)\s*Certo Software$/i.test(title)
    && text.includes('page not found')
    && text.includes('certo software')
    && !hasPublicJobsSignal(html)
  }

export const createCertoScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html) || hasPublicJobsSignal(homepage.html)) {
      throw new Error('Certo verified homepage no longer matches the known first-party surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (
      aboutPage.status !== 200
      || !hasOfficialAboutPageSignal(aboutPage.html)
      || hasPublicJobsSignal(aboutPage.html)
    ) {
      throw new Error('Certo verified about page no longer matches the known first-party surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasOfficialSitemapSignal(sitemap.html)) {
      throw new Error('Certo verified sitemap no longer matches the known first-party surface')
    }

    for (const url of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const page = await fetchPage(url)
      if (!isVerifiedMissingCareerRoute(page)) {
        throw new Error(`Certo no-public-careers route changed: ${url}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCertoScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
