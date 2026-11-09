import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createCommvaultClumioScraper } from '../../scraper-support/native-sources/commvaultClumio/nativeCareers.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'clumio'
export const COMPANY = 'Clumio'
export const CAREERS_URL = 'https://www.commvault.com/careers/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&rsquo;|&#8217;/gi, '’')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&hellip;/gi, '...')

const decodeRepeatedHtmlEntities = (value, maxPasses = 4) => {
  let current = String(value ?? '')

  for (let index = 0; index < maxPasses; index += 1) {
    const decoded = decodeHtmlEntities(current)
    if (decoded === current) break
    current = decoded
  }

  return current.replace(/\u00a0/g, ' ').trim()
}

const stripTags = (value) =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/section)\b[^>]*>/gi, '\n')
      .replace(/<(p|div|li|ul|ol|h[1-6]|section)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const deriveCity = (location) => normalizeWhitespace(location)?.split(/[;,]/)[0]?.trim() || null

const normalizeDepartment = (value) => normalizeWhitespace(decodeRepeatedHtmlEntities(value))

const extractListItemsText = (html) => {
  const items = [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(([, itemHtml]) => stripTags(itemHtml))
    .filter(Boolean)

  return items.length > 0 ? items.join('\n') : null
}

const inferRemoteStatusFromDetail = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  if (/#LI-Hybrid\b/i.test(page) || /\bhybrid\b/i.test(text)) return 'Hybrid'
  if (/#LI-Remote\b/i.test(page) || /\bremote\b/i.test(text)) return 'Remote'
  if (/#LI-Onsite\b/i.test(page) || /\bon[\s-]?site\b/i.test(text)) return 'On-site'
  return null
}

const extractTitleFromDetail = (html) => {
  const page = String(html ?? '')
  const jobHeadingTitle = page.match(/<div class="job__heading">[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (jobHeadingTitle) return normalizeWhitespace(decodeRepeatedHtmlEntities(stripTags(jobHeadingTitle[1])))

  return normalizeWhitespace(
    decodeRepeatedHtmlEntities(stripTags((page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1])),
  )
}

export const buildJobDetailUrl = (jobId) => {
  const normalizedJobId = normalizeWhitespace(jobId)
  return normalizedJobId ? `${CAREERS_URL}/${encodeURIComponent(normalizedJobId)}` : null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Find a Career with Commvault\s*<\/title>/i.test(page)
    && /<h1[^>]*>\s*Find a career with Commvault\s*<\/h1>/i.test(page)
    && /const\s+greenhouse_list\s*=\s*\[/i.test(page)
    && /href=["']\/careers\/jobs\/\d+["']/i.test(page)
}

export const extractGreenhouseListPayload = (html) => {
  const page = String(html ?? '')
  const marker = 'const greenhouse_list ='
  const markerIndex = page.indexOf(marker)

  if (markerIndex < 0) {
    throw new Error('Clumio careers page no longer exposes the verified inline greenhouse_list payload')
  }

  const arrayStart = page.indexOf('[', markerIndex)
  if (arrayStart < 0) {
    throw new Error('Clumio careers page no longer exposes the verified inline greenhouse_list payload')
  }

  let depth = 0
  let arrayEnd = -1

  for (let index = arrayStart; index < page.length; index += 1) {
    const char = page[index]
    if (char === '[') depth += 1
    if (char === ']') {
      depth -= 1
      if (depth === 0) {
        arrayEnd = index
        break
      }
    }
  }

  if (arrayEnd < 0) {
    throw new Error('Clumio careers page no longer exposes the verified inline greenhouse_list payload')
  }

  return JSON.parse(page.slice(arrayStart, arrayEnd + 1))
}

const isClumioExcerpt = (excerpt) => /\bclumio\b/i.test(decodeRepeatedHtmlEntities(excerpt))

const inferListingRemoteStatus = (job = {}) =>
  /^yes$/i.test(normalizeWhitespace(job?.remote_position) || '') ? 'Remote' : 'On-site'

export const extractClumioJobsFromGreenhouseList = (
  greenhouseList,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  if (!Array.isArray(greenhouseList)) {
    throw new Error('Clumio greenhouse_list payload no longer matches the expected array shape')
  }

  return greenhouseList
    .filter((job) => isClumioExcerpt(job?.excerpt))
    .map((job) => {
      const title = normalizeWhitespace(job?.title)
      const jobId = normalizeWhitespace(job?.job_id)
      const location = normalizeWhitespace(job?.location)
      const country = normalizeWhitespace(job?.country)
      const sourceUrl = buildJobDetailUrl(jobId)
      const jobDescription = normalizeWhitespace(decodeRepeatedHtmlEntities(job?.excerpt))

      if (!title || !jobId || !location || !country || !sourceUrl || !jobDescription) {
        throw new Error('Clumio greenhouse_list payload no longer exposes the verified first-party job detail handoff')
      }

      return {
        title,
        company: COMPANY,
        location,
        city: deriveCity(location),
        country,
        link: sourceUrl,
        applyUrl: sourceUrl,
        sourceUrl,
        source: SOURCE,
        jobId,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        department: normalizeDepartment(job?.department),
        employmentType: normalizeWhitespace(job?.hiring_type),
        experienceRequired: null,
        jobDescription,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        remoteStatus: inferListingRemoteStatus(job),
        scrapedAt,
      }
    })
}

export const extractDetailFields = (html) => {
  const page = String(html ?? '')
  const bodyMatch = page.match(/<div class="job__body">([\s\S]*?)<div class="content-conclusion">/i)

  if (!bodyMatch) {
    throw new Error('Clumio job detail page no longer exposes the verified first-party job body')
  }

  let jobBodyHtml = bodyMatch[1].trim()
  const aboutTeamIndex = jobBodyHtml.search(/<h2>\s*About the Team\s*<\/h2>/i)
  if (aboutTeamIndex >= 0) {
    jobBodyHtml = jobBodyHtml.slice(aboutTeamIndex)
  }

  jobBodyHtml = jobBodyHtml
    .replace(/<p>\s*(?:&nbsp;|\s)*<\/p>/gi, '')
    .trim()

  const basicQualificationsHtml =
    (jobBodyHtml.match(/<h2>\s*Basic Qualifications\s*<\/h2>\s*<ul>([\s\S]*?)<\/ul>/i) || [])[1]
  const preferredQualificationsHtml =
    (jobBodyHtml.match(/<h2>\s*Preferred Qualifications\s*<\/h2>\s*<ul>([\s\S]*?)<\/ul>/i) || [])[1]

  return {
    title: extractTitleFromDetail(page),
    jobDescription: jobBodyHtml || null,
    minimumQualification: extractListItemsText(basicQualificationsHtml),
    preferredQualification: extractListItemsText(preferredQualificationsHtml),
    remoteStatus: inferRemoteStatusFromDetail(page),
  }
}

export const createClumioScraper = (options = {}) => createCommvaultClumioScraper(options)

export const run = async (options = {}) => createClumioScraper(options).run(options)

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
