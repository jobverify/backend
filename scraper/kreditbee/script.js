import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { KREDITBEE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KREDITBEE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const VERIFIED_DETAIL_PROBE_URLS = PROVIDER_METADATA.verifiedDetailProbeUrls
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedCareersShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*KreditBee\s*<\/title>/i.test(page)
    && /<div[^>]+id=["'](?:root|app)["'][^>]*><\/div>/i.test(page)
    && /\/react\/(?:runtime-main|main)\.[a-z0-9]+\.js/i.test(page)
}

export const extractCareerUrlsFromSitemap = (xml = '') => {
  const urls = new Set()

  for (const match of String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (!absoluteUrl) continue
    if (!/\/careers(?:\/|$)/i.test(absoluteUrl)) continue
    urls.add(absoluteUrl)
  }

  return [...urls]
}

export const hasVerifiedSitemapShape = (xml = '') => {
  const careerUrls = extractCareerUrlsFromSitemap(xml)
  return careerUrls.length === 1 && careerUrls[0] === CAREERS_URL
}

export const hasTrustworthyPublicJobDetailSignal = (html = '') => {
  const page = normalizeWhitespace(html)
  const signals = [
    /\b(Data Engineer|Team Lead)\b/i.test(page),
    /\bJob Description\b/i.test(page),
    /\bJob Requirements\b/i.test(page),
    /\bNeed More Details\?\b/i.test(page),
    /\bPosition Applied\b/i.test(page),
  ]

  return signals.filter(Boolean).length >= 3
}

export const hasNonVerifiableDetailShell = (html = '') => {
  const page = String(html ?? '')

  return hasVerifiedCareersShellSignal(page)
    && !hasTrustworthyPublicJobDetailSignal(page)
}

export const createKreditBeeScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersShellSignal(careersHtml)) {
      throw new Error('KreditBee official careers shell changed and no longer matches the verified first-party surface')
    }

    const sitemapXml = await fetchText(SITEMAP_URL)
    const careerUrls = extractCareerUrlsFromSitemap(sitemapXml)
    const detailUrls = careerUrls.filter((url) => url !== CAREERS_URL)
    if (detailUrls.length > 0) {
      throw new Error(`KreditBee sitemap now exposes public career detail urls: ${detailUrls[0]}`)
    }

    if (!hasVerifiedSitemapShape(sitemapXml)) {
      throw new Error('KreditBee sitemap no longer matches the verified first-party shape')
    }

    for (const detailUrl of VERIFIED_DETAIL_PROBE_URLS) {
      const detailHtml = await fetchText(detailUrl)

      if (hasTrustworthyPublicJobDetailSignal(detailHtml)) {
        throw new Error(`KreditBee detail route now exposes trustworthy public job content: ${detailUrl}`)
      }

      if (!hasNonVerifiableDetailShell(detailHtml)) {
        throw new Error(`KreditBee detail route no longer matches the verified non-verifiable shell: ${detailUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createKreditBeeScraper().run(options)

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
