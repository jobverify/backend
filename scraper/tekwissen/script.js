import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'tekwissen'
export const COMPANY = 'TekWissen Software Pvt Ltd'
export const HOMEPAGE_URL = 'https://tekwissen.com/'
export const CAREERS_PAGE_URL = 'https://tekwissen.com/career/'
export const INDIA_CAREERS_URL = 'https://tekwissen.com/career/india/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/contract/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/intern/.test(normalized)) return 'Internship'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

const getLastPathSegment = (value) => {
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    return segments.at(-1) || null
  } catch {
    return null
  }
}

const getAttributeValue = (tag, attribute) => {
  const match = String(tag ?? '').match(new RegExp(`\\b${attribute}=["']([^"']+)["']`, 'i'))
  return normalizeWhitespace(match?.[1] ?? null)
}

const extractJsonProp = (html, propName) => {
  const patterns = [
    new RegExp(`"${propName}"\\s*:\\s*"([^"]+)"`, 'i'),
    new RegExp(`'${propName}'\\s*:\\s*'([^']+)'`, 'i'),
    new RegExp(`${propName}\\s*:\\s*"([^"]+)"`, 'i'),
    new RegExp(`${propName}\\s*:\\s*'([^']+)'`, 'i'),
    new RegExp(`\\\\"${propName}\\\\\"\\s*:\\s*\\\\"([^"\\\\]+)\\\\"`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = String(html ?? '').match(pattern)
    if (match?.[1]) {
      return normalizeWhitespace(match[1])
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''

  return normalized.includes('tekwissen does not charge candidates a fee')
    && normalized.includes('job openings')
    && normalized.includes('pan india')
    && normalized.includes('build high-performance global teams, on demand')
}

export const hasCareersLandingSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('join our global team')
    && normalized.includes('build your future at tekwissen')
    && normalized.includes('region pan india')
    && normalized.includes('our application process explained')
}

export const hasIndiaCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  const rawHtml = String(html ?? '')

  return normalized.includes('apply for future roles at tekwissen')
    && normalized.includes('home')
    && normalized.includes('careers')
    && normalized.includes('pan india')
    && (
      /jobsapi\.ceipal\.com\/apisource\/widget\.js/i.test(rawHtml)
      || /careerportalid/i.test(rawHtml)
      || /apikey/i.test(rawHtml)
    )
}

export const extractWidgetConfig = (html) => {
  const rawHtml = String(html ?? '')
  const scriptMatch = rawHtml.match(
    /<script\b[^>]*src=["']https:\/\/jobsapi\.ceipal\.com\/APISource\/widget\.js["'][^>]*><\/script>/i,
  )
  const scriptTag = scriptMatch?.[0]

  const apiKeyFromAttributes = getAttributeValue(scriptTag, 'data-ceipal-api-key')
  const portalIdFromAttributes = getAttributeValue(scriptTag, 'data-ceipal-career-portal-id')

  const apiKey = apiKeyFromAttributes || extractJsonProp(rawHtml, 'apiKey')
  const careerPortalId = portalIdFromAttributes || extractJsonProp(rawHtml, 'careerPortalId')

  if (!apiKey || !careerPortalId) return null

  return {
    apiKey,
    careerPortalId,
  }
}

export const buildWidgetUrl = ({ apiKey, careerPortalId } = {}) =>
  `https://jobsapi.ceipal.com/APISource/v2/index.html?api_key=${apiKey}&cp_id=${careerPortalId}`

export const hasWidgetSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  return normalized.includes('ceipal career portal')
    && normalized.includes('search jobs')
    && normalized.includes('current openings')
}

export const extractIndiaJobs = (html) => {
  if (!hasWidgetSignal(html)) return []

  const rawHtml = String(html ?? '')
  const postingPattern =
    /<div\b[^>]*class=["'][^"']*job-posting[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*class=["'][^"']*job-title[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<div\b[^>]*class=["'][^"']*job-location[^"']*["'][^>]*>([\s\S]*?)<\/div>[\s\S]*?<div\b[^>]*class=["'][^"']*job-type[^"']*["'][^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/div>/gi

  return Array.from(rawHtml.matchAll(postingPattern))
    .map((match) => {
      const sourceUrl = normalizeWhitespace(match[1] ?? null)
      const title = normalizeWhitespace(match[2] ?? null)
      const location = normalizeWhitespace(match[3] ?? null)

      if (!sourceUrl || !title || !location) return null

      const city = normalizeWhitespace(location.split(',')[0] ?? null)
      const jobId = getLastPathSegment(sourceUrl)
      if (!jobId) return null

      return {
        title,
        company: COMPANY,
        department: null,
        location,
        city,
        state: null,
        country: /\bindia\b/i.test(location) ? 'India' : null,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeEmploymentType(match[4] ?? null),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)
}

export const createTekWissenScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Response is not the verified official TekWissen homepage')
    }

    const careersLandingHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasCareersLandingSignal(careersLandingHtml)) {
      throw new Error('Response is not the verified TekWissen careers landing page')
    }

    const indiaCareersHtml = await fetchText(INDIA_CAREERS_URL)
    if (!hasIndiaCareersSignal(indiaCareersHtml)) {
      throw new Error('Response is not the verified TekWissen India careers page')
    }

    const widgetConfig = extractWidgetConfig(indiaCareersHtml)
    if (!widgetConfig) {
      throw new Error('TekWissen India careers page no longer exposes a public CEIPAL widget configuration')
    }

    const widgetHtml = await fetchText(buildWidgetUrl(widgetConfig))
    if (!hasWidgetSignal(widgetHtml)) {
      throw new Error('Response is not the verified public CEIPAL widget for TekWissen India careers')
    }

    const jobs = extractIndiaJobs(widgetHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createTekWissenScraper().run(options)

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
