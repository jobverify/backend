import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { NAS_ACADEMY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NAS_ACADEMY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const LINKTREE_URL = PROVIDER_METADATA.officialCareersHandoffUrl

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

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

export const extractOfficialLinktreeUrl = (html = '') => normalizeWhitespace(
  extractFirst(
    /<a\b[^>]*href=["'](https:\/\/linktr\.ee\/nascompany)["'][^>]*>\s*Explore Our Job Openings\s*<\/a>/i,
    html,
  ) || extractFirst(/href=["'](https:\/\/linktr\.ee\/nascompany)["']/i, html),
)

export const hasVerifiedNasCareersSignal = (html = '') => {
  const text = stripTags(html) || ''

  return text.includes('Come and do your best work here')
    && text.includes('Explore Our Job Openings')
    && text.includes('Nas Academy')
    && extractOfficialLinktreeUrl(html) === LINKTREE_URL
}

export const extractLinktreeJobLinks = (html = '') => [...String(html ?? '').matchAll(
  /<a\b[^>]*href=["'](https:\/\/www\.linkedin\.com\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
)]
  .map((match) => ({
    label: stripTags(match[2]),
    url: normalizeWhitespace(match[1]),
  }))
  .filter((link) => link.label && link.url)

export const hasExactNasAcademyJobsLink = (html = '') =>
  extractLinktreeJobLinks(html).some((link) =>
    /nas academy jobs/i.test(link.label) || /\/company\/nasacademy\/jobs\/?/i.test(link.url),
  )

export const hasVerifiedLinktreeSignal = (html = '') => {
  const text = stripTags(html) || ''
  const labels = extractLinktreeJobLinks(html).map((link) => link.label)

  return text.includes('@nascompany')
    && labels.includes('Nas Daily Jobs')
    && labels.includes('Nas.com Jobs')
    && labels.includes('Nas Summit Jobs')
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createNasAcademyScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const officialCareersHtml = await fetchText(OFFICIAL_CAREERS_URL)

    if (!hasVerifiedNasCareersSignal(officialCareersHtml)) {
      throw new Error('Nas Academy official careers page no longer matches the verified company-level handoff')
    }

    const linktreeHtml = await fetchText(LINKTREE_URL)
    if (hasExactNasAcademyJobsLink(linktreeHtml)) {
      throw new Error('Nas Academy official surface now exposes an exact Nas Academy jobs surface')
    }

    if (!hasVerifiedLinktreeSignal(linktreeHtml)) {
      throw new Error('Nas Academy official linktree handoff no longer matches the verified company-level jobs links')
    }

    return []
  },
})

export const run = async (options = {}) => createNasAcademyScraper().run(options)

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
