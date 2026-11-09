import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { inferExperienceFromPublicPageHtml } from '../../scraper-support/utils/publicExperienceEnrichment.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'molecularconnectionspvtltd'
export const COMPANY = 'Molecular Connections Pvt Ltd'
export const HOMEPAGE_URL = 'https://molecularconnections.com/'
export const CAREERS_HOME_URL = 'https://career.molecularconnections.com/'
export const TECHNOLOGY_OPENINGS_URL = 'https://career.molecularconnections.com/technology-job-openings/'
export const APPLY_URL = 'https://career.molecularconnections.com/job-openings/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsToLines = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\r/g, '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/main|\/h[1-6]|\/a)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|section|article|main|h[1-6]|a)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/\n+/g, '\n')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const normalizePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const date = new Date(`${normalized} UTC`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const deriveCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null

  const [firstPart] = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  return normalizeCity(firstPart || normalized)
}

const extractDetailUrls = (html) => [...String(html ?? '').matchAll(
  /data-post-link="([^"]+)"/gi,
)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /<title[^>]*>\s*Molecular Connections\s*<\/title>/i.test(page)
    && /Molecular Connections Private Limited|MC Group/i.test(page)
    && /Powered by AI(?:\s*&amp;\s*|\s*&\s*)5,000\+\s*Experts/i.test(page)
    && /Experience applied AI/i.test(page)
    && /https:\/\/career\.molecularconnections\.com\/?/i.test(page)
}

export const hasOfficialCareersHomeSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTagsToLines(page).join(' ')

  return /Career at Molecular Connections/i.test(page)
    && /Ranked Best Place to Work/i.test(text)
    && /Current Openings/i.test(text)
    && new RegExp(TECHNOLOGY_OPENINGS_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(page)
    && new RegExp(APPLY_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(page)
}

export const hasOfficialApplyFormSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTagsToLines(page).join(' ')

  return /Job Openings/i.test(text)
    && /submit your resume below/i.test(text)
    && /Position you are applying for/i.test(text)
    && /\bApply\b/i.test(text)
}

export const hasOfficialTechnologyOpeningsSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTagsToLines(page).join(' ')

  return /Technology Job Openings/i.test(text)
    && /Current Openings/i.test(text)
    && /Take a look at the open positions mentioned below/i.test(text)
    && /Application Support Specialist\s*-\s*Publishing Platforms/i.test(text)
}

export const extractTechnologyOpenings = (html) => {
  if (!hasOfficialTechnologyOpeningsSignal(html)) {
    throw new Error('Molecular Connections public technology openings page no longer matches the verified official surface')
  }

  const lines = stripTagsToLines(html)
  const detailUrls = extractDetailUrls(html)
  const headerIndex = lines.findIndex((line) => /^POSTED ON$/i.test(line))
  if (headerIndex === -1) {
    throw new Error('Molecular Connections public technology openings header is missing')
  }

  const jobs = []

  for (let index = headerIndex + 1; index + 2 < lines.length; index += 3) {
    const title = normalizeWhitespace(lines[index])
    const rawLocation = normalizeWhitespace(lines[index + 1])
    const rawPostingDate = normalizeWhitespace(lines[index + 2])
    const postingDate = normalizePostingDate(rawPostingDate)

    if (!title || !rawLocation || !postingDate) break

    jobs.push({
      title,
      location: normalizeLocation(rawLocation),
      city: deriveCity(rawLocation),
      postingDate,
      sourceUrl: `${TECHNOLOGY_OPENINGS_URL}#${slugify(title)}`,
      applyUrl: APPLY_URL,
    })
  }

  if (jobs.length === 0) {
    throw new Error('Molecular Connections public technology openings could not be extracted from the verified surface')
  }

  if (detailUrls.length < jobs.length) {
    throw new Error('Molecular Connections public technology openings no longer expose the expected first-party job detail links')
  }

  return jobs.map((job, index) => ({
    ...job,
    sourceUrl: detailUrls[index],
    applyUrl: APPLY_URL,
  }))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMolecularConnectionsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Molecular Connections official public site changed; refusing to guess the careers surface')
    }

    const careersHomeHtml = await fetchText(CAREERS_HOME_URL)
    if (!hasOfficialCareersHomeSignal(careersHomeHtml)) {
      throw new Error('Molecular Connections official careers hub changed; refusing to guess the openings surface')
    }

    const technologyOpeningsHtml = await fetchText(TECHNOLOGY_OPENINGS_URL)
    const applyPageHtml = await fetchText(APPLY_URL)

    if (!hasOfficialApplyFormSignal(applyPageHtml)) {
      throw new Error('Molecular Connections official apply form changed; refusing to route applications blindly')
    }

    const jobs = extractTechnologyOpenings(technologyOpeningsHtml).map((job) => {
      const identitySlug = slugify(`${job.title}-${job.location}-${job.postingDate}`)

      return {
        ...job,
        company: COMPANY,
        department: 'Technology',
        country: 'India',
        jobId: `${SOURCE}-${identitySlug}`,
        requisitionId: `${SOURCE}-${identitySlug}`,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        closingDate: null,
        jobDescription: null,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }
    })

    const jobsWithDetails = await Promise.all(jobs.map(async (job) => {
      try {
        const detailHtml = await fetchText(job.sourceUrl)
        const enriched = inferExperienceFromPublicPageHtml(job, detailHtml)

        return {
          ...job,
          experienceRequired: enriched.experienceRequired || job.experienceRequired,
          jobDescription: enriched.jobDescription || job.jobDescription,
          description: enriched.description || job.jobDescription || null,
          publicExperienceChecked: enriched.publicExperienceChecked === true,
        }
      } catch {
        return job
      }
    }))

    return jobsWithDetails
  },
})

export const run = async (options = {}) => createMolecularConnectionsScraper().run(options)

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
