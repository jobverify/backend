import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import NEXDIGM_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NEXDIGM_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.officialHomepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CURRENT_OPENINGS_URL = PROVIDER_METADATA.officialCurrentOpeningsUrl
export const CURRENT_OPENINGS_DATA_URL = PROVIDER_METADATA.officialCurrentOpeningsDataUrl
export const CURRENT_OPENINGS_UPSTREAM_ERROR = PROVIDER_METADATA.reviewedUpstreamErrorValue

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const stripHtmlComments = (value = '') => String(value).replace(/<!--[\s\S]*?-->/g, ' ')

const stripTags = (value = '') =>
  stripHtmlComments(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')

const normalizeText = (value = '') =>
  decodeHtmlEntities(stripTags(String(value)))
    .replace(/\s+/g, ' ')
    .trim()

const normalizeLocation = (value = '') =>
  normalizeText(value)
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/, '')

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''), HOMEPAGE_URL)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const defaultFetchHtml = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: SOURCE,
})

const extractHrefMatches = (html = '') =>
  Array.from(stripHtmlComments(String(html)).matchAll(/href=["']([^"']+)["']/gi), (match) => match[1])

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title>([\s\S]*?)<\/title>/i)
  return normalizeText(match?.[1] || '')
}

const extractFirst = (pattern, value = '') => normalizeText(pattern.exec(String(value ?? ''))?.[1] || '')

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildJobDescription = ({ officeLocation, department, posted }) => {
  const lines = []
  if (officeLocation) lines.push(`Office Location: ${officeLocation}`)
  if (department) lines.push(`Department: ${department}`)
  if (posted) lines.push(`Posted: ${posted}`)
  return lines.join('\n') || null
}

const extractDetailField = (html = '', label = '') => extractFirst(
  new RegExp(
    `<div[^>]*class=["'][^"']*result-left[^"']*["'][^>]*>\\s*${escapeRegExp(label)}\\s*<\\/div>\\s*<div[^>]*class=["'][^"']*result-right[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
    'i',
  ),
  html,
)

const extractDetailJobDescription = (html = '') => {
  const page = stripHtmlComments(String(html ?? ''))
  const marker = page.match(/<div[^>]*class=["'][^"']*job-title[^"']*["'][^>]*>\s*Job Description\s*<\/div>/i)
  if (!marker?.index) {
    if (marker == null) return null
  }

  const start = marker.index + marker[0].length
  const remainder = page.slice(start)
  let end = remainder.length

  for (const endPattern of [
    /<!--input[^>]*value=["']Apply["']/i,
    /<input[^>]*value=["']Apply["']/i,
    /<div[^>]*class=["'][^"']*col-lg-3[^"']*["']/i,
  ]) {
    const match = remainder.match(endPattern)
    if (match?.index != null && match.index < end) {
      end = match.index
    }
  }

  return normalizeText(remainder.slice(0, end))
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return extractTitle(page) === 'Nexdigm | Explore Career Opportunities'
    && /\bJob Search\b/i.test(normalized)
    && /\bCurrent Opportunities\b/i.test(normalized)
    && /\bView All\b/i.test(normalized)
    && extractHrefMatches(page).some((href) => sameUrl(href, CURRENT_OPENINGS_URL))
}

export const extractCurrentOpeningsUrl = (html = '') =>
  extractHrefMatches(html).find((href) => sameUrl(href, CURRENT_OPENINGS_URL)) || null

export const hasVerifiedCurrentOpeningsShell = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeText(page)

  return extractTitle(page) === 'Current Opportunities | Job Openings | Nexdigm'
    && /\bCurrent Openings\b/i.test(normalized)
    && /placeholder=["'][^"']*Search by Position Name, Location Name etc[^"']*["']/i.test(page)
    && /id=["']my_form["']/i.test(page)
    && /id=["']load_data["']/i.test(page)
    && /id=["']loadmore["']/i.test(page)
    && new RegExp(CURRENT_OPENINGS_DATA_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(page)
}

export const extractCurrentOpeningsErrorValue = (html = '') => {
  const match = stripHtmlComments(String(html)).match(
    /id=["']arr["'][^>]*name=["']arr["'][^>]*value=(?:"([^"]*)"|'([^']*)')/i,
  )
  return normalizeText(match?.[1] || match?.[2] || '')
}

export const hasVerifiedUpstreamErrorCurrentOpeningsState = (html = '') =>
  extractCurrentOpeningsErrorValue(html).toLowerCase() === CURRENT_OPENINGS_UPSTREAM_ERROR

export const extractInlineJobs = (html = '', { scrapedAt = new Date().toISOString() } = {}) => {
  const cards = String(html ?? '').split('<div class="result-inside careerdata">').slice(1)
  const jobsById = new Map()

  for (const cardHtml of cards) {
    const sourceUrl = extractFirst(/<a\b[^>]*href="([^"]*career-details\?id=[^"]+)"[^>]*>/i, cardHtml)
    const title = extractFirst(/<a\b[^>]*href="[^"]*career-details\?id=[^"]+"[^>]*>([\s\S]*?)<\/a>/i, cardHtml)
    const city = extractFirst(/<span><b>Location City<\/b><\/span>\s*<span>([\s\S]*?)<\/span>/i, cardHtml)
    const employmentType = extractFirst(/<span><b>Employee Type<\/b><\/span>\s*<span>([\s\S]*?)<\/span>/i, cardHtml)
    const posted = extractFirst(/<span><b>Posted<\/b><\/span>\s*<span>([\s\S]*?)<\/span>/i, cardHtml)
    const officeLocation = normalizeLocation(
      extractFirst(/<span><b>Office Location : <\/b><\/span>([\s\S]*?)<br\/?>/i, cardHtml),
    )
    const department = extractFirst(/<span><b>Department : <\/b><\/span>([\s\S]*?)<\/p>/i, cardHtml)
    const applyUrl = extractFirst(/onclick="apply\('([^']+)'\);?"/i, cardHtml)

    if (!sourceUrl || !title) continue

    const jobId = (() => {
      try {
        return new URL(sourceUrl, CURRENT_OPENINGS_URL).searchParams.get('id')
      } catch {
        return null
      }
    })()

    if (!jobId) continue

    jobsById.set(jobId, {
      title,
      company: COMPANY,
      department: department || null,
      location: officeLocation || null,
      city: city || null,
      state: null,
      country: officeLocation ? 'India' : null,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: applyUrl || sourceUrl,
      link: applyUrl || sourceUrl,
      source: SOURCE,
      employmentType: employmentType || null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription({
        officeLocation,
        department,
        posted,
      }),
      scrapedAt,
    })
  }

  return [...jobsById.values()]
}

export const enrichInlineJobFromDetail = (job = {}, detailHtml = '') => {
  const experienceRequired = extractDetailField(detailHtml, 'Experience')
  const detailDescription = extractDetailJobDescription(detailHtml)
  const applyUrl = extractFirst(/onclick="apply\('([^']+)'\);?"/i, detailHtml) || job.applyUrl

  return {
    ...job,
    applyUrl,
    link: applyUrl || job.link || job.sourceUrl,
    experienceRequired: experienceRequired || job.experienceRequired || null,
    jobDescription: detailDescription || job.jobDescription || null,
    publicExperienceChecked: true,
  }
}

export const createNexdigmScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchHtml = defaultFetchHtml,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchHtml(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Nexdigm verified careers page no longer matches the trusted first-party surface')
    }

    const currentOpeningsUrl = extractCurrentOpeningsUrl(careersHtml)
    if (!sameUrl(currentOpeningsUrl, CURRENT_OPENINGS_URL)) {
      throw new Error('Nexdigm verified careers handoff changed materially')
    }

    const currentOpeningsHtml = await fetchHtml(CURRENT_OPENINGS_URL)
    if (!hasVerifiedCurrentOpeningsShell(currentOpeningsHtml)) {
      throw new Error('Nexdigm verified current openings shell no longer matches the trusted first-party surface')
    }

    const jobs = extractInlineJobs(currentOpeningsHtml, { scrapedAt: now() })
    if (jobs.length > 0) {
      const enrichedJobs = await Promise.all(jobs.map(async (job) => {
        try {
          const detailHtml = await fetchHtml(job.sourceUrl)
          return enrichInlineJobFromDetail(job, detailHtml)
        } catch {
          return job
        }
      }))

      return enrichedJobs
    }

    if (hasVerifiedUpstreamErrorCurrentOpeningsState(currentOpeningsHtml)) {
      return []
    }

    throw new Error(
      'Nexdigm current openings shell no longer exposes public cards or the reviewed upstream-error empty state',
    )
  },
})

export const run = async (options = {}) => createNexdigmScraper(options).run(options)

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
