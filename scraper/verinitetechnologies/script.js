import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'verinitetechnologies'
export const COMPANY = 'Verinite Technologies'
export const COMPANY_DOMAIN = 'verinite.com'
export const CAREERS_URL = 'https://www.verinite.com/careers.html'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#8211;|&#x2013;|&ndash;/gi, ' - ')
  .replace(/&#8212;|&#x2014;|&mdash;/gi, ' - ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&#x2019;|&rsquo;/gi, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<div\b[^>]*>/gi, '\n')
    .replace(/<section\b[^>]*>/gi, '\n')
    .replace(/<article\b[^>]*>/gi, '\n')
    .replace(/<h[1-6]\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title>\s*([\s\S]*?)\s*<\/title>/i)?.[1] || '')
  const text = stripTags(page)

  return title === 'Verinite | Explore World of Opportunities with Us'
    && /class=["']job_box["']/i.test(page)
    && text.includes('Powercard L2 Support')
    && text.includes('Apply Now')
}

export const extractJobCards = (html) => [...String(html ?? '').matchAll(
  /<div class=["']job_box["'][\s\S]*?<h5>([\s\S]*?)<\/h5>[\s\S]*?<p[^>]*class=["'][^"']*job_location[^"']*["'][\s\S]*?<span[^>]*class=["'][^"']*theme_text[^"']*["']>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class=["'][^"']*job_status[^"']*["']>([\s\S]*?)<\/span>[\s\S]*?<\/p>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply\s*Now\s*<\/a>[\s\S]*?<\/div>/gi,
)].map((match) => {
  const title = stripTags(match[1])
  const cityLabel = stripTags(match[2])
  const employmentType = /full\s*time/i.test(match[3]) ? 'Full-time' : stripTags(match[3]) || null
  const sourceUrl = toAbsoluteUrl(match[4])
  const jobId = sourceUrl?.split('/').pop()?.replace(/\.html$/i, '') ?? null

  return {
    title,
    company: COMPANY,
    department: null,
    location: cityLabel ? `${cityLabel}, India` : null,
    city: cityLabel.split('/')[0]?.trim() || null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  }
}).filter((job) => job.title && job.sourceUrl && job.jobId)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractDivInnerHtml = (html, startTagPattern) => {
  const page = String(html ?? '')
  const flags = startTagPattern.flags.replace(/g/g, '')
  const match = new RegExp(startTagPattern.source, flags).exec(page)

  if (!match) return ''

  const openTagStart = match.index
  const openTagEnd = page.indexOf('>', openTagStart)
  if (openTagEnd < 0) return ''

  let depth = 1
  const contentStart = openTagEnd + 1
  const nestedDivPattern = /<\/?div\b[^>]*>/gi
  nestedDivPattern.lastIndex = contentStart

  for (let nestedMatch = nestedDivPattern.exec(page); nestedMatch; nestedMatch = nestedDivPattern.exec(page)) {
    if (/^<div\b/i.test(nestedMatch[0])) {
      depth += 1
      continue
    }

    depth -= 1
    if (depth === 0) {
      return page.slice(contentStart, nestedMatch.index)
    }
  }

  return page.slice(contentStart)
}

const extractOverviewHtml = (html) => {
  const overviewHtml = extractDivInnerHtml(html, /<div[^>]*id=["']overview["'][^>]*>/i)
  if (!overviewHtml) return ''

  return extractDivInnerHtml(
    overviewHtml,
    /<div[^>]*class=["'][^"']*job__JobDescriptionWrapper[^"']*["'][^>]*>/i,
  ) || overviewHtml
}

const escapeForRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractAdjacentParagraphValue = (html, label) => {
  const escapedLabel = escapeForRegex(label)
  const match = String(html ?? '').match(new RegExp(
    `<p[^>]*>\\s*(?:<strong[^>]*>)?\\s*${escapedLabel}\\s*:?\\s*(?:<\\/strong>)?\\s*<\\/p>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`,
    'i',
  ))

  return stripTags(match?.[1] || '') || null
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*years?/i)
  if (rangeMatch) {
    return `${rangeMatch[1]} - ${rangeMatch[2]} years`
  }

  const plusMatch = normalized.match(/(\d+(?:\.\d+)?)\s*\+\s*years?/i)
  if (plusMatch) {
    return `${plusMatch[1]}+ years`
  }

  const singleMatch = normalized.match(/(\d+(?:\.\d+)?)\s*years?/i)
  if (singleMatch) {
    return `${singleMatch[1]} years`
  }

  return normalized
}

export const extractJobDetail = (html) => {
  const overviewHtml = extractOverviewHtml(html)
  const jobDescription = stripTags(overviewHtml) || null
  const experienceRequired = normalizeExperience(
    extractAdjacentParagraphValue(overviewHtml, 'Experience'),
  )

  return {
    experienceRequired,
    jobDescription,
    publicExperienceChecked: Boolean(jobDescription),
  }
}

const enrichJobFromDetail = (job, detail) => ({
  ...job,
  experienceRequired: detail.experienceRequired || job.experienceRequired || null,
  jobDescription: detail.jobDescription || job.jobDescription || null,
  publicExperienceChecked: detail.publicExperienceChecked ?? job.publicExperienceChecked ?? false,
})

export const createVeriniteTechnologiesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Verinite careers page no longer matches the verified first-party job-card surface')
    }

    const scrapedAt = now()
    const jobs = []

    for (const job of extractJobCards(careersHtml)) {
      const baseJob = {
        ...job,
        source: SOURCE,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-first-party-job-card-page',
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
      }

      try {
        const detailHtml = await fetchText(job.sourceUrl)
        jobs.push(enrichJobFromDetail(baseJob, extractJobDetail(detailHtml)))
      } catch {
        jobs.push(baseJob)
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createVeriniteTechnologiesScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
