import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { KUVERA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KUVERA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_URL = PROVIDER_METADATA.companyCareerPage
export const RESUME_EMAIL = PROVIDER_METADATA.officialResumeSubmissionEmail

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /darwinbox/i,
  /peoplestrong/i,
  /ashbyhq\.com/i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTagsToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeBundleText = (value) => String(value ?? '')
  .replace(/\\u2019/gi, "'")
  .replace(/\u2019/gi, "'")
  .replace(/\\u0026/gi, '&')
  .replace(/\s+/g, ' ')

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

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const extractResumeEmail = (html = '') => {
  const mailtoMatch = String(html ?? '').match(/mailto:\s*(jobs@kuvera\.in)/i)
  if (mailtoMatch?.[1]) return mailtoMatch[1].toLowerCase()

  const textMatch = stripTagsToText(html).match(/\bjobs@kuvera\.in\b/i)
  return textMatch?.[0]?.toLowerCase() ?? null
}

export const extractAppBundleUrl = (html = '') => {
  const match = String(html ?? '').match(
    /src=["'](https:\/\/assets2\.kuvera\.in\/production\/[^"']*\/assets\/js\/main[^"']+\.js)["']/i,
  )

  return match?.[1] ?? null
}

export const hasPublicJobListingSignal = (value = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const hasOfficialAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title>\s*Kuvera by CRED\s*<\/title>/i.test(page)
    && /join our team/i.test(text)
    && /we(?:['\u2019])re hiring!?/i.test(text)
    && extractResumeEmail(page) === RESUME_EMAIL
}

export const hasOfficialAboutPageShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Kuvera by CRED\s*<\/title>/i.test(page)
    && extractAppBundleUrl(page) !== null
}

export const hasVerifiedBundleHiringSignal = (bundleText = '') => {
  const normalized = normalizeBundleText(bundleText)

  return /join our team/i.test(normalized)
    && /we(?:['\u2019])re hiring!?/i.test(normalized)
    && /\bjobs@kuvera\.in\b/i.test(normalized)
}

export const hasVerifiedBundleShellSignal = (bundleText = '') => {
  const normalized = normalizeBundleText(bundleText)
  const signals = [
    /Kuvera by CRED/i.test(normalized),
    /Arevuk Advisory Services/i.test(normalized),
    /https:\/\/assets2\.kuvera\.in\/production\/atlantis\/web\//i.test(normalized),
  ]

  return signals.filter(Boolean).length >= 2
}

export const createKuveraScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchText = defaultFetchText } = {}) {
    const aboutPage = await fetchPage(ABOUT_URL)

    if (aboutPage.status !== 200 || aboutPage.url !== ABOUT_URL) {
      throw new Error('Kuvera verified about page no longer matches the known public surface')
    }

    if (hasPublicJobListingSignal(aboutPage.html)) {
      throw new Error('Kuvera about page now appears to expose a public jobs board')
    }

    if (hasOfficialAboutPageSignal(aboutPage.html)) {
      return []
    }

    const appBundleUrl = extractAppBundleUrl(aboutPage.html)
    if (!appBundleUrl || !hasOfficialAboutPageShellSignal(aboutPage.html)) {
      throw new Error('Kuvera verified about page no longer matches the known public surface')
    }

    const bundleText = await fetchText(appBundleUrl)
    if (hasPublicJobListingSignal(bundleText)) {
      throw new Error('Kuvera about page now appears to expose a public jobs board')
    }

    if (!hasVerifiedBundleHiringSignal(bundleText) && !hasVerifiedBundleShellSignal(bundleText)) {
      throw new Error('Kuvera verified about page no longer matches the known public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createKuveraScraper().run(options)

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
