import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DLT_LAB_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DLT_LAB_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const REBRAND_ARTICLE_URL = PROVIDER_METADATA.rebrandArticleUrl
export const REDIRECT_TARGET_URL = 'https://knnx.com/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeUrl = (value) => {
  try {
    const url = new URL(value)
    url.hash = ''
    if (url.pathname === '') url.pathname = '/'
    return url.toString()
  } catch {
    return String(value ?? '')
  }
}

export const hasRebrandSignal = (html = '') => {
  const page = String(html ?? '')

  return /DLT Labs/i.test(page)
    && /KNNX Corp/i.test(page)
    && /knnx\.com/i.test(page)
  }

export const isVerifiedRedirectSurface = ({
  finalUrl,
  status,
  html,
  errorKind,
} = {}) =>
  errorKind == null
  && (status === 200 || status === 301 || status === 302)
  && normalizeUrl(finalUrl) === normalizeUrl(REDIRECT_TARGET_URL)
  && /KNNX/i.test(String(html ?? ''))

export const isBlockedCareersSurface = ({
  status,
  html,
  errorKind,
} = {}) =>
  errorKind === 'network'
  || [401, 403, 404, 429, 500, 502, 503, 504, 522].includes(status)
  || /blocked|could not connect|connection/i.test(String(html ?? ''))

const defaultProbeUrl = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })

    return {
      url,
      finalUrl: response.url || url,
      status: response.status,
      html: await response.text(),
      errorKind: null,
    }
  } catch {
    return {
      url,
      finalUrl: url,
      status: null,
      html: null,
      errorKind: 'network',
    }
  }
}

export const createDltLabTechnologiesScraper = () => ({
  async run({ probeUrl = defaultProbeUrl } = {}) {
    const homepagePage = await probeUrl(HOMEPAGE_URL)
    if (!isVerifiedRedirectSurface(homepagePage)) {
      throw new Error('DLT Labs homepage no longer matches the verified first-party redirect to KNNX')
    }

    const rebrandPage = await probeUrl(REBRAND_ARTICLE_URL)
    if (rebrandPage.errorKind != null || rebrandPage.status !== 200 || !hasRebrandSignal(rebrandPage.html)) {
      throw new Error('DLT Labs rebrand article no longer matches the verified first-party KNNX rebrand notice')
    }

    const careersPage = await probeUrl(CAREERS_URL)
    if (!isBlockedCareersSurface(careersPage)) {
      throw new Error('DLT Lab Technologies now resolves to a generic KNNX careers surface; re-verify before enabling enumeration')
    }

    return []
  },
})

export const run = async (options = {}) => createDltLabTechnologiesScraper().run(options)

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
