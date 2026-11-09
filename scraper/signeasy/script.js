import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import SIGNEASY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = SIGNEASY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const RECRUITERBOX_OPENINGS_URL = 'https://app.recruiterbox.com/widget/14690/openings/'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url)
  return response.json()
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()
  const title = (extractTitle(page) || '').toLowerCase()

  return title === 'careers at signeasy | signeasy'
    && (text.includes('join our tribe') || text.includes('join our mission'))
    && (text.includes('apply now') || text.includes('apply here'))
    && text.includes('our principles')
    && text.includes('perks and benefits')
}

export const hasOfficialRecruiterboxWidget = (html = '') =>
  /\/static\/client-src-served\/widget\/14690\/rbox_api\.js/i.test(String(html ?? ''))
  && /class=["'][^"']*rbox-opening-list/i.test(String(html ?? ''))

const mapRecruiterboxJobs = (openings, now) => {
  if (!Array.isArray(openings)) {
    throw new Error('Signeasy Recruiterbox openings payload changed')
  }
  const seen = new Set()
  return openings
    .map((opening) => {
      const id = String(opening?.id || '')
      const hash = String(opening?.hash_id || '')
      const title = normalizeWhitespace(opening?.title)
      const location = normalizeWhitespace(opening?.location?.city)
      if (!/^\d+$/.test(id) || !/^[a-z0-9]+$/i.test(hash) || !title
        || opening?.company_name !== 'Signeasy' || !location || !opening?.description
        || seen.has(id)) {
        throw new Error('Signeasy Recruiterbox role payload changed or contains duplicate jobs')
      }
      seen.add(id)
      if (!/\bIndia\b|Bengaluru|Bangalore/i.test(location)) return null
      const applyUrl = 'https://signeasy.hire.trakstar.com/jobs/' + hash + '/'
      return {
        company: COMPANY_NAME,
        title,
        location: /India/i.test(location) ? location : location + ', Karnataka, India',
        city: 'Bengaluru',
        country: 'India',
        link: applyUrl,
        applyUrl,
        sourceUrl: applyUrl,
        source: SOURCE,
        jobId: id,
        department: normalizeWhitespace(opening.team),
        employmentType: normalizeWhitespace(opening.position_type),
        experienceRequired: null,
        jobDescription: opening.description,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        remoteStatus: opening.allows_remote ? 'Remote' : 'On-site',
        scrapedAt: now(),
      }
    })
    .filter(Boolean)
}

export const hasNoTrustworthyPublicJobsSignal = (html = '') => {
  const page = String(html ?? '')
  return !/View Job/i.test(page)
    && !/class=["'][^"']*\bjob-card\b/i.test(page)
    && !/\/careers\/[a-z0-9-]+/i.test(page)
    && !/\/jobs\/[a-z0-9-]+/i.test(page)
}

export const createSigneasyScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified SignEasy careers page changed materially')
    }

    if (hasOfficialRecruiterboxWidget(careersHtml)) {
      return mapRecruiterboxJobs(await fetchJson(RECRUITERBOX_OPENINGS_URL), now)
    }

    if (!hasNoTrustworthyPublicJobsSignal(careersHtml)) {
      throw new Error('The verified SignEasy careers page now exposes trustworthy public jobs and needs a real scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createSigneasyScraper(options).run(options)

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
