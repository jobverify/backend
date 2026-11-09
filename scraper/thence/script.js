import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { inferExperienceFromPublicPageHtml } from '../../scraper-support/utils/publicExperienceEnrichment.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'thence'
export const COMPANY = 'Thence Private Limited'
export const HOMEPAGE_URL = 'https://thence.co'
export const CAREERS_URL = 'https://thence.digital/careers'
export const APPLY_URL = 'https://thence.digital/careers#section-contact-us-form'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|â€“|â€”/g, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractExperienceEvidence = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bno experience required\b/i.test(normalized)) return 'No experience required'

  let match = normalized.match(/\b(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}-${match[2]} years`

  match = normalized.match(/\b(\d+)\+\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\bat least\s+(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  match = normalized.match(/\bminimum\s+(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} years`

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Thence Digital\s*<\/title>/i.test(page)
    && /href=["']https:\/\/thence\.digital\/blogs["']/i.test(page)
    && /href=["']https:\/\/thence\.digital\/contact-us["']/i.test(page)
    && />\s*Careers\s*</i.test(page)
}

export const extractCareersUrlFromHomepage = (html) => {
  const match = String(html ?? '').match(/href=["'](https:\/\/thence\.digital\/careers)["']/i)
  return match?.[1] || null
}

export const isRetiredCareersRouteError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const escapedUrl = CAREERS_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return new RegExp(`HTTP 404 for ${escapedUrl}`, 'i').test(message)
}

const extractRoleTitles = (html) => {
  const selectMatch = String(html ?? '').match(
    /<select[^>]*id=["']jaf-select_role["'][^>]*>([\s\S]*?)<\/select>/i,
  )
  if (!selectMatch) return []

  const titles = [...selectMatch[1].matchAll(
    /<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi,
  )]
    .map((match) => normalizeWhitespace(match[1] || match[2]))
    .filter((value) => value && value !== '-' && !/^select role$/i.test(value))

  return [...new Set(titles)]
}

const hasSharedApplicationFormSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /id=["']jaf-select_role["']/i.test(page)
    && (/id=["']jaf-experience["']/i.test(page) || /Relevant years of experience/i.test(text))
    && /Current-CTC-LPA-INR/i.test(page)
    && /Linked In - Job Posting/i.test(text)
    && /Thence Website/i.test(text)
}

const extractRoleSpecificExperienceFromSharedPage = (html, title) => {
  const normalizedTitle = normalizeWhitespace(title)
  const pageText = stripTags(html) || ''
  if (!normalizedTitle || !pageText) return null

  const titlePattern = new RegExp(escapeRegex(normalizedTitle), 'ig')
  for (const match of pageText.matchAll(titlePattern)) {
    const index = match.index ?? -1
    if (index === -1) continue

    const start = Math.max(0, index - 80)
    const end = Math.min(pageText.length, index + normalizedTitle.length + 260)
    const experience = extractExperienceEvidence(pageText.slice(start, end))
    if (experience) {
      return experience
    }
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const roleTitles = extractRoleTitles(page)

  return /<title>\s*Careers\s*<\/title>/i.test(page)
    && (/Join Thence/i.test(text) || /Solve for Change/i.test(text))
    && /Current-CTC-LPA-INR/i.test(page)
    && /Linked In - Job Posting/i.test(text)
    && /Thence Website/i.test(text)
    && roleTitles.length > 0
}

const enrichRoleFromSharedCareersPage = (job, html) => {
  if (hasSharedApplicationFormSignal(html)) {
    return {
      ...job,
      experienceRequired: extractRoleSpecificExperienceFromSharedPage(html, job.title) || job.experienceRequired || null,
      jobDescription: null,
      publicExperienceChecked: true,
    }
  }

  const enriched = inferExperienceFromPublicPageHtml({
    ...job,
    source: SOURCE,
    link: job.applyUrl || job.sourceUrl,
    publicExperienceChecked: false,
  }, html)

  return {
    ...job,
    experienceRequired: enriched.experienceRequired || job.experienceRequired || null,
    jobDescription: enriched.jobDescription || job.jobDescription || null,
    publicExperienceChecked: enriched.publicExperienceChecked === true
      || hasSharedApplicationFormSignal(html),
  }
}

export const extractOpenRoles = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Thence careers page no longer matches the verified official public careers surface')
  }

  const jobs = extractRoleTitles(html).map((title) => {
    const identitySlug = slugify(title)

    const baseJob = {
      title,
      company: COMPANY,
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: `${SOURCE}-${identitySlug}`,
      requisitionId: `${SOURCE}-${identitySlug}`,
      sourceUrl: CAREERS_URL,
      applyUrl: APPLY_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    }

    return enrichRoleFromSharedCareersPage(baseJob, html)
  })

  if (jobs.length === 0) {
    throw new Error('Thence verified public role list disappeared from the official careers page')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createThenceScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Thence homepage no longer matches the verified official homepage')
    }

    const careersUrl = extractCareersUrlFromHomepage(homepageHtml)
    if (careersUrl !== CAREERS_URL) {
      throw new Error('Thence verified official careers handoff no longer points to the known first-party careers page')
    }

    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      // The current first-party footer retains this legacy link, but its route is retired.
      if (isRetiredCareersRouteError(error)) return []
      throw error
    }

    return extractOpenRoles(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createThenceScraper().run(options)

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
