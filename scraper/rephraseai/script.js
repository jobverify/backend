import path from 'node:path'
import { fileURLToPath } from 'node:url'

import REPHRASE_AI_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = REPHRASE_AI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const ABOUT_URL = PROVIDER_METADATA.aboutPageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_URL = PROVIDER_METADATA.jobsPageUrl
export const COMMON_ROUTE_URLS = [ABOUT_URL, CAREERS_URL, JOBS_URL]
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  })

  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const getPageHtml = (page = {}) => String(page.html ?? page.text ?? page.body ?? '')

export const extractSuspiciousCareerLinks = (html, baseUrl = HOMEPAGE_URL) => {
  const links = []
  const source = String(html ?? '')
  const signalPattern =
    /\b(career|careers|job|jobs|apply|open roles|current openings|join our team)\b/i
  const atsPattern =
    /\b(lever|greenhouse|ashby|jobvite|workday|smartrecruiters|bamboohr|breezy|recruitee)\b/i

  for (const match of source.matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = normalizeWhitespace(match[2])
    const text = stripTags(match[3]) || ''
    const combined = `${href || ''} ${text}`

    if (!signalPattern.test(combined) && !atsPattern.test(combined)) {
      continue
    }

    try {
      links.push(new URL(href || '', baseUrl).href)
    } catch {
      if (href) links.push(href)
    }
  }

  return [...new Set(links)]
}

export const hasHomepageSignal = (html) => {
  const source = String(html ?? '')

  return /<title>\s*Rephrase AI \| Free AI Rephraser for Better Writing\s*<\/title>/i.test(source)
    && /support@rephraseai\.com/i.test(source)
    && /\bAI (writing assistant|rephraser|rewriting tools?)\b/i.test(source)
}

export const hasVercelSecurityCheckpointSignal = (html) => {
  const source = String(html ?? '')
  const normalized = normalizeWhitespace(source)?.toLowerCase() || ''

  return /<title>\s*Vercel Security Checkpoint\s*<\/title>/i.test(source)
    && normalized.includes('vercel')
    && normalized.includes('security checkpoint')
}

export const hasNotFoundSignal = (html) => {
  const source = String(html ?? '')

  return /\b404\b/i.test(source)
    && /Oops!\s*The page you're looking for doesn't exist\./i.test(source)
}

const assertNoSuspiciousLinks = (html, routeLabel, routeUrl) => {
  const suspiciousLinks = extractSuspiciousCareerLinks(html, routeUrl)

  if (suspiciousLinks.length > 0) {
    throw new Error(`${routeLabel} now exposes public jobs links: ${suspiciousLinks.join(', ')}`)
  }
}

export const isVerifiedVercelCheckpointPage = (page = {}, requestedUrl = '') =>
  Number(page.status) === 429
  && String(page.url || requestedUrl) === requestedUrl
  && hasVercelSecurityCheckpointSignal(getPageHtml(page))

export const createRephraseAiScraper = () => ({
  async run({ fetchPage, fetchText } = {}) {
    const effectiveFetchPage = fetchPage || (fetchText
      ? async (url) => ({
        status: 200,
        url,
        html: await fetchText(url),
      })
      : defaultFetchPage)

    const homepage = await effectiveFetchPage(HOMEPAGE_URL)
    const homepageHtml = getPageHtml(homepage)

    if (isVerifiedVercelCheckpointPage(homepage, HOMEPAGE_URL)) {
      for (const routeUrl of COMMON_ROUTE_URLS) {
        const routePage = await effectiveFetchPage(routeUrl)
        if (!isVerifiedVercelCheckpointPage(routePage, routeUrl)) {
          throw new Error('Rephrase.ai public routes no longer match the verified site-wide Vercel security checkpoint state')
        }
      }

      return []
    }

    if (!hasHomepageSignal(homepageHtml)) {
      throw new Error('Rephrase.ai homepage no longer matches the verified public surface')
    }

    assertNoSuspiciousLinks(homepageHtml, 'Rephrase.ai homepage', HOMEPAGE_URL)

    for (const routeUrl of COMMON_ROUTE_URLS) {
      const routePage = await effectiveFetchPage(routeUrl)
      const routeHtml = getPageHtml(routePage)

      if (isVerifiedVercelCheckpointPage(routePage, routeUrl)) {
        continue
      }

      if (!hasNotFoundSignal(routeHtml)) {
        throw new Error(`${routeUrl} no longer matches the verified no-public-careers surface`)
      }

      assertNoSuspiciousLinks(routeHtml, routeUrl, routeUrl)
    }

    return []
  },
})

export const run = async (options = {}) => createRephraseAiScraper().run(options)

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
