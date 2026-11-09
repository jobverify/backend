import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'imslearningresources'
export const COMPANY = 'IMS Learning Resources'
export const CAREERS_URL = 'https://www.imsindia.com/about-us/join-our-team/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_SIGNALS = [
  'Join Our Team - IMS India',
  'JOIN OUR TEAM',
  'Feel immensely rewarded and respected',
  'You can send us your profile to recruitment@imsindia.com and we shall get in touch with you in case of a suitable vacancy.',
  'IMS Learning Resources Pvt. Limited, All rights reserved.',
]

const SUSPICIOUS_HOST_PATTERN =
  /(greenhouse|job-boards\.greenhouse|lever|workday|myworkdayjobs|smartrecruiters|ashby|workable|darwinbox|icims|successfactors|taleo|jobvite|recruitcrm|teamtailor|oraclecloud|dayforce|jobs\.)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return OFFICIAL_SIGNALS.every((signal) => normalized.includes(signal))
}

export const extractSuspiciousPublicJobLinks = (html) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || seen.has(absoluteUrl)) continue

    const url = new URL(absoluteUrl)
    const isSamePage = absoluteUrl === CAREERS_URL || `${absoluteUrl}/` === CAREERS_URL
    const pathname = url.pathname.replace(/\/+$/, '') || '/'

    const exposesFirstPartyJobPath = (url.hostname === 'www.imsindia.com' || url.hostname === 'imsindia.com')
      && /\/(jobs?|job-openings?|openings?|vacanc(?:y|ies)|careers?)(\/|$)/i.test(pathname)
      && !isSamePage

    if (SUSPICIOUS_HOST_PATTERN.test(url.hostname) || exposesFirstPartyJobPath) {
      seen.add(absoluteUrl)
      suspiciousLinks.push(absoluteUrl)
    }
  }

  return suspiciousLinks
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createImsLearningResourcesScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('IMS Learning Resources verified official careers surface changed')
    }

    const suspiciousLinks = extractSuspiciousPublicJobLinks(careersHtml)
    if (suspiciousLinks.length > 0) {
      throw new Error('IMS Learning Resources careers page now exposes public job links')
    }

    return attachInventoryEvidence([], {
      status: 'discovery-only',
      surface: CAREERS_URL,
      firstParty: true,
      listingComplete: false,
      pagesFetched: 1,
      reportedTotal: 0,
      indiaFacetCount: 0,
      verifiedAt: now(),
      reason: 'ims-learning-resources-email-only-careers-page',
    })
  },
})

export const run = async (options = {}) => createImsLearningResourcesScraper().run(options)

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
