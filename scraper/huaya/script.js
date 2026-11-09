import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { HUAYA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HUAYA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_PAGE_URL = PROVIDER_METADATA.aboutPageUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob openings?\b/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bsearch jobs\b/i,
  /\bcareers?\b/i,
  /\bjoin us\b/i,
  /\brecruit(?:ment)?\b/i,
  /\bJobPosting\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Industrial Forklift Manufacturer \| Diesel &amp; Electric Forklifts \| HUAYA\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.huayaba\.com\/["']/i.test(page)
    && normalized.includes('Hebei Huaya Co., Ltd.')
    && normalized.includes('HUAYA was founded in 1996')
    && normalized.includes('info@huaya.cn')
}

export const hasVerifiedAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*ABOUT HUAYA\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.huayaba\.com\/about\/["']/i.test(page)
    && normalized.includes('Hebei Huaya Co., Ltd.')
    && normalized.includes('Company Profile')
    && normalized.includes('HUAYA has established after-sales service networks')
}

export const hasVerifiedSitemapSignal = (xml = '') => {
  const page = String(xml ?? '')

  return /<sitemapindex\b/i.test(page)
    && /https:\/\/www\.huayaba\.com\/post-sitemap\.xml/i.test(page)
    && /https:\/\/www\.huayaba\.com\/page-sitemap\.xml/i.test(page)
}

export const hasPublicJobSignals = (content = '') => {
  const page = String(content ?? '')
  const normalized = normalizeWhitespace(page)

  return PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(normalized))
}

export const createHuayaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (hasPublicJobSignals(homepageHtml)) {
      throw new Error('Huaya homepage now appears to expose a public jobs surface')
    }
    if (!hasVerifiedHomepageSignal(homepageHtml)) {
      throw new Error('Huaya verified homepage no longer matches the known first-party surface')
    }

    const aboutHtml = await fetchText(ABOUT_PAGE_URL)
    if (hasPublicJobSignals(aboutHtml)) {
      throw new Error('Huaya about page now appears to expose a public jobs surface')
    }
    if (!hasVerifiedAboutPageSignal(aboutHtml)) {
      throw new Error('Huaya verified about page no longer matches the known first-party surface')
    }

    const sitemapXml = await fetchText(SITEMAP_URL)
    if (hasPublicJobSignals(sitemapXml)) {
      throw new Error('Huaya sitemap now appears to expose a public jobs surface')
    }
    if (!hasVerifiedSitemapSignal(sitemapXml)) {
      throw new Error('Huaya verified sitemap no longer matches the known first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createHuayaScraper().run(options)

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
