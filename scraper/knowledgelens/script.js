import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'knowledgelens'
export const COMPANY = 'Knowledge Lens'
export const HOMEPAGE_URL = 'https://www.knowledgelens.com/'
export const RETIRED_ANNOUNCEMENT_URL =
  'https://kalypso.com/about/press/releases/rockwell-automation-announces-acquisition-of-knowledge-lens'
export const PARENT_CAREERS_URL = 'https://kalypso.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/&quot;/gi, '"')
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(timeoutMs),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const isRetiredHomepageTimeoutError = (error) => {
  const message = String(error?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const combined = `${message} ${causeCode} ${causeMessage}`

  return /UND_ERR_CONNECT_TIMEOUT/i.test(combined)
    || /Connect Timeout Error/i.test(combined)
    || /\btimed out\b/i.test(combined)
}

const normalizeUrlString = (value) => String(value ?? '').replace(/\/+$/, '')

export const isRetiredAnnouncementUrl = (value) =>
  normalizeUrlString(value) === normalizeUrlString(RETIRED_ANNOUNCEMENT_URL)

export const hasRetiredHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Rockwell Acquires Knowledge Lens\s*\|\s*Kalypso\s*<\/title>/i.test(rawHtml)
    && normalized.includes('knowledge lens integration with rockwell automation complete')
    && normalized.includes('march 1, 2025')
    && normalized.includes("we're proud to share that knowledge lens is now fully integrated into rockwell automation")
    && normalized.includes('the knowledge lens website has been retired')
    && normalized.includes('explore kalypso.com')
}

export const hasParentCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Careers\s*\|\s*Kalypso\s*<\/title>/i.test(rawHtml)
    && normalized.includes("we've never wanted to be a typical firm")
    && normalized.includes('kalypsonians are innovators and intrapreneurs')
    && normalized.includes('what it means to be a kalypsonian')
    && normalized.includes('view all openings')
    && /rockwellautomation\.wd1\.myworkdayjobs\.com/i.test(rawHtml)
}

export const hasBrandSpecificOpeningsSignal = (html) =>
  /knowledge lens.{0,80}\b(open(?:ings)?|jobs?|positions?)\b/i.test(normalizeWhitespace(html))

export const createKnowledgeLensScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    let retiredHomepage
    try {
      retiredHomepage = await fetchPage(HOMEPAGE_URL)
    } catch (error) {
      if (!isRetiredHomepageTimeoutError(error)) {
        throw error
      }

      retiredHomepage = await fetchPage(RETIRED_ANNOUNCEMENT_URL)
    }

    if (
      retiredHomepage.status !== 200
      || !isRetiredAnnouncementUrl(retiredHomepage.url)
      || !hasRetiredHomepageSignal(retiredHomepage.html)
    ) {
      throw new Error('Knowledge Lens retired brand homepage no longer matches the verified first-party surface')
    }

    const parentCareersPage = await fetchPage(PARENT_CAREERS_URL)

    if (
      parentCareersPage.status !== 200
      || !hasParentCareersSignal(parentCareersPage.html)
    ) {
      throw new Error('Knowledge Lens parent careers page no longer matches the verified first-party surface')
    }

    if (hasBrandSpecificOpeningsSignal(parentCareersPage.html)) {
      throw new Error('Knowledge Lens parent careers page now appears to expose brand-specific openings')
    }

    return []
  },
})

export const run = async (options = {}) => createKnowledgeLensScraper().run(options)

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
