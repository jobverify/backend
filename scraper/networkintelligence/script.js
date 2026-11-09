import path from 'path'
import { fileURLToPath } from 'url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://www.networkintelligence.ai/career/'
export const CAREERS_API_URL =
  'https://www.networkintelligence.ai/wp-json/wp/v2/careers?per_page=100'

const COMPANY = 'Network Intelligence'
const SOURCE = 'networkintelligence'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugifyTitle = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  const directMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/)
  if (directMatch) return directMatch[1]

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('full-time') || normalized.includes('full time')) return 'Full-time'
  if (normalized.includes('part-time') || normalized.includes('part time')) return 'Part-time'
  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('contract')) return 'Contract'
  return normalizeWhitespace(value)
}

const hasForeignLocationSignal = (value) =>
  /united states|usa|u\.s\.|canada|europe|uk|united kingdom|singapore|dubai|uae|australia/i
    .test(String(value ?? ''))

const isIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (/india/i.test(normalized)) return true
  if (hasForeignLocationSignal(normalized)) return false
  return true
}

const toLocationParts = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return {
    location: null,
    city: null,
    state: null,
    country: null,
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || normalized
  const state = parts.length > 2 ? parts[1] : null
  const country = 'India'
  const location = /india/i.test(normalized) ? normalized : `${normalized}, India`

  return { location, city, state, country }
}

export const hasOfficialPageSignal = (html) => {
  const page = String(html ?? '')
  return /Join Our Elite Cyber security Community!/i.test(page)
    && /Current Opening/i.test(page)
    && /Job Code:/i.test(page)
}

export const extractOpeningsFromCareersPage = (html) => {
  const page = String(html ?? '')
  const matches = page.matchAll(
    /<h3>\s*([^<]+?)\s+((?:Full|Part)[-\s]?Time|Internship|Contract)\s*<\/h3>[\s\S]*?Job Code:\s*([^<\n]+)[\s\S]*?Location:\s*([^<\n]+)[\s\S]*?Experience:\s*([^<\n]+)/gi,
  )

  const openings = []
  for (const match of matches) {
    const rawTitle = normalizeWhitespace(match[1])
    const employmentType = normalizeEmploymentType(match[2])
    const requisitionId = normalizeWhitespace(match[3])
    const rawLocation = normalizeWhitespace(match[4])
    const experienceRequired = normalizeWhitespace(match[5])
    const locationParts = toLocationParts(rawLocation)

    if (!rawTitle || !requisitionId || !locationParts.location) continue

    openings.push({
      title: rawTitle,
      titleKey: slugifyTitle(rawTitle),
      rawLocation,
      requisitionId,
      employmentType,
      experienceRequired,
      ...locationParts,
    })
  }

  return openings
}

const extractExplicitApplyUrl = (html) => {
  const page = String(html ?? '')
  const hrefMatch = page.match(
    /<a\b[^>]*href=["'](https?:\/\/[^"'#\s]+|mailto:[^"'\s]+)["'][^>]*>([\s\S]*?)<\/a>/i,
  )
  if (hrefMatch) return normalizeWhitespace(hrefMatch[1])

  const keywordUrlMatch = page.match(
    /(LinkedIn Easy Apply|Apply|Email your Resume|submit your resume)[\s\S]{0,200}?(https?:\/\/[^\s<"']+)/i,
  )
  if (keywordUrlMatch) return normalizeWhitespace(keywordUrlMatch[2])

  return null
}

const extractApplyLine = (html) => {
  const line = normalizeWhitespace(
    String(html ?? '').match(
      /(LinkedIn Easy Apply[\s\S]{0,200}?https?:\/\/[^\s<"']+)/i,
    )?.[1],
  )

  return line || null
}

const extractDetailSummary = (html) => {
  const blocks = Array.from(
    String(html ?? '').matchAll(/<(?:li|p)\b[^>]*>([\s\S]*?)<\/(?:li|p)>/gi),
  )
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

  return blocks.join(' ') || null
}

const buildJobDescription = ({ apiContent, detailHtml }) => {
  const base = normalizeWhitespace(apiContent)
  const detailSummary = extractDetailSummary(detailHtml)
  const applyLine = extractApplyLine(detailHtml)

  if (detailSummary && (applyLine || !base || detailSummary.length > base.length)) {
    return detailSummary
  }

  if (base && applyLine && !base.includes(applyLine)) return `${base} ${applyLine}`
  return base || normalizeWhitespace(detailHtml)
}

const buildJobFromPost = async (post, { opening, fetchText }) => {
  const title = normalizeWhitespace(post?.title?.rendered)
  const jobId = normalizeWhitespace(post?.id)
  const sourceUrl = normalizeWhitespace(post?.link)

  if (!title || !jobId || !sourceUrl || !opening) return null

  const detailHtml = await fetchText(sourceUrl)
  const applyUrl = extractExplicitApplyUrl(detailHtml) || sourceUrl
  const jobDescription = buildJobDescription({
    apiContent: post?.content?.rendered,
    detailHtml,
  })

  return {
    title,
    company: COMPANY,
    department: null,
    location: opening.location,
    city: opening.city,
    state: opening.state,
    country: opening.country,
    jobId,
    requisitionId: opening.requisitionId,
    sourceUrl,
    applyUrl,
    employmentType: opening.employmentType,
    experienceRequired: opening.experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizePostingDate(post?.date),
    closingDate: null,
    jobDescription,
    remoteStatus: 'On-site',
  }
}

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: 'networkintelligence-html',
    timeoutMs: 15000,
  })

const defaultFetchJson = (url) =>
  fetchJsonWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
    label: 'networkintelligence-json',
    timeoutMs: 15000,
  })

export const createNetworkIntelligenceScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersPageHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialPageSignal(careersPageHtml)) {
      throw new Error('Response is not the verified official Network Intelligence careers page')
    }

    const openings = extractOpeningsFromCareersPage(careersPageHtml)
      .filter((opening) => isIndiaLocation(opening.rawLocation))
    const openingsByTitle = new Map(openings.map((opening) => [opening.titleKey, opening]))

    const posts = await fetchJson(CAREERS_API_URL)
    if (!Array.isArray(posts)) {
      throw new Error('Network Intelligence careers API no longer returns an array payload')
    }

    const jobs = []
    for (const post of posts) {
      const postTitle = normalizeWhitespace(post?.title?.rendered)
      const opening = openingsByTitle.get(slugifyTitle(postTitle))
      if (!opening) continue

      const job = await buildJobFromPost(post, { opening, fetchText })
      if (!job) continue

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })

      if (maxJobs && jobs.length >= maxJobs) break
    }

    return jobs
  },
})

export const run = async () => createNetworkIntelligenceScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Network Intelligence scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
