import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'keechery'
export const COMPANY = 'Keechery'
export const HOMEPAGE_URL = 'https://www.keechery.com/'
export const CAREERS_URL = 'https://www.keechery.com/career/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.keechery\.com\/["']/i.test(page)
    && /WELCOME TO KEECHERY/i.test(text)
    && /Keechery Space n' Design has been a trusted turnkey interior solutions provider/i.test(text)
    && /href=["'](?:https?:\/\/www\.keechery\.com)?\/career\/["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.keechery\.com\/career\/["']/i.test(page)
    && /Careers/i.test(text)
    && /JOBS/i.test(text)
    && /Apply Now/i.test(text)
    && /Project Engineers Quantity Surveyors Marketing Executives/i.test(text)
    && /<select[^>]+name=["'](?:your-role|menu-499)["']/i.test(page)
    && /<input[^>]+type=["']file["'][^>]+name=["'](?:resume|file-202)["']/i.test(page)
  }

const parseRequirementParts = (summary) => {
  const normalized = normalizeWhitespace(summary)

  if (/^B\.E\/B\.Tech in Civil or Mechanical Engineering /i.test(normalized)) {
    return {
      minimumQualification: 'B.E/B.Tech in Civil or Mechanical Engineering',
      experienceRequired: normalized.replace(/^B\.E\/B\.Tech in Civil or Mechanical Engineering /i, ''),
      requiredSkills: [],
      jobDescription:
        'B.E/B.Tech in Civil or Mechanical Engineering. '
        + `${normalized.replace(/^B\.E\/B\.Tech in Civil or Mechanical Engineering /i, '')}. `
        + 'Apply via the official Keechery careers page.',
    }
  }

  if (/^Freshers with an undergraduate degree in any stream /i.test(normalized)) {
    return {
      minimumQualification: 'Undergraduate degree in any stream',
      experienceRequired: 'Freshers',
      requiredSkills: ['Strong Communication Skills'],
      jobDescription:
        'Freshers with an undergraduate degree in any stream. '
        + 'Strong Communication Skills. Apply via the official Keechery careers page.',
    }
  }

  return {
    minimumQualification: null,
    experienceRequired: normalized || null,
    requiredSkills: [],
    jobDescription: `${normalized}. Apply via the official Keechery careers page.`,
  }
}

export const extractPublicListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Keechery verified careers page no longer matches the known public jobs surface')
  }

  const jobs = [...String(html ?? '').matchAll(/<h4>([^<]+)<\/h4>\s*<h6>([\s\S]*?)<\/h6>/gi)]
    .map(([, rawTitle, rawSummary]) => {
      const title = normalizeWhitespace(rawTitle)
      const summary = stripTags(rawSummary)
      const parsed = parseRequirementParts(summary)
      const jobId = `${SOURCE}-${slugify(title)}`

      if (!title || !summary || !jobId) {
        throw new Error('Keechery verified careers page no longer matches the known public jobs surface')
      }

      return {
        title,
        company: COMPANY,
        department: null,
        location: 'India',
        city: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: `${CAREERS_URL}#${jobId}`,
        applyUrl: CAREERS_URL,
        employmentType: null,
        experienceRequired: parsed.experienceRequired,
        minimumQualification: parsed.minimumQualification,
        preferredQualification: null,
        requiredSkills: parsed.requiredSkills,
        postingDate: null,
        closingDate: null,
        jobDescription: parsed.jobDescription,
      }
    })
    .sort((left, right) => left.title.localeCompare(right.title))

  if (jobs.length !== 3) {
    throw new Error('Keechery verified careers page no longer matches the known public jobs surface')
  }

  return jobs
}

export const createKeecheryScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Keechery verified official homepage no longer matches the known careers handoff')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractPublicListings(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createKeecheryScraper().run(options)

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
