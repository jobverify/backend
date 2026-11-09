import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KRUTRIM_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KRUTRIM_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const MAIN_SITEMAP_URL = 'https://www.olakrutrim.com/sitemap.xml'
export const AI_LABS_CAREERS_URL = 'https://ai-labs.olakrutrim.com/careers'
export const AI_LABS_SITEMAP_URL = 'https://ai-labs.olakrutrim.com/sitemap.xml'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

export const hasVerifiedHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Krutrim Cloud\s*<\/title>/i.test(page)
    && text.includes('Products')
    && text.includes('Pricing')
    && text.includes('Docs')
    && text.includes('Contact Us')
    && text.includes('Login')
    && text.includes('Register')
  }

export const hasVerifiedAiLabsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Krutrim AI Labs\s*<\/title>/i.test(page)
    && text.includes("India's Frontier AI Research Lab")
    && text.includes('Join Us')
    && text.includes('Career Opportunities')
    && text.includes('Open Positions')
    && text.includes('Contact Us')
  }

export const hasVisiblePublicJobsSignal = (html = '') => /href=["'][^"']*(careers?|jobs?|openings?|greenhouse|lever|workday)[^"']*["']/i.test(String(html ?? ''))
  || /\bApply for This Job\b/i.test(stripTags(html) || '')

const extractSitemapUrls = (xml = '') => [...String(xml ?? '').matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

export const sitemapHasNoPublicCareerUrls = (xml = '') => {
  const urls = extractSitemapUrls(xml)
  return urls.length > 0 && urls.every((url) => !/(careers?|jobs?|join|openings?)/i.test(url))
}

export const isFirstPartyNotFoundPage = ({ status, html } = {}) => {
  const text = stripTags(html) || ''
  return status === 404
    && /<title>\s*404:\s*This page could not be found\.\s*<\/title>/i.test(String(html ?? ''))
    && text.includes('This page could not be found.')
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

export const createKrutrimScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasVerifiedHomepageSignal(homepage.html)) {
      throw new Error('Krutrim homepage no longer matches the verified first-party shell')
    }

    const aiLabsPage = await fetchPage(CAREERS_URL)
    if (hasVisiblePublicJobsSignal(aiLabsPage.html)) {
      throw new Error('Krutrim now exposes a live public jobs surface')
    }

    if (aiLabsPage.status !== 200 || !hasVerifiedAiLabsSignal(aiLabsPage.html)) {
      throw new Error('Krutrim AI Labs page no longer matches the verified first-party shell')
    }

    const mainSitemap = await fetchPage(MAIN_SITEMAP_URL)
    if (mainSitemap.status !== 200 || !sitemapHasNoPublicCareerUrls(mainSitemap.html)) {
      throw new Error('Krutrim now exposes a live public jobs surface')
    }

    const aiLabsCareersRoute = await fetchPage(AI_LABS_CAREERS_URL)
    if (!isFirstPartyNotFoundPage(aiLabsCareersRoute)) {
      throw new Error('Krutrim now exposes a live public jobs surface')
    }

    const aiLabsSitemapRoute = await fetchPage(AI_LABS_SITEMAP_URL)
    if (!isFirstPartyNotFoundPage(aiLabsSitemapRoute)) {
      throw new Error('Krutrim now exposes a live public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createKrutrimScraper().run(options)

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
