import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'visailabs'
export const COMPANY = 'VisAI Labs'
export const HOMEPAGE_URL = 'https://visailabs.com/'
export const CAREERS_URL = 'https://visailabs.com/careers/'
export const CONTACT_URL = 'https://visailabs.com/contact/'
export const APPLY_URL = 'https://hrmax.myadrenalin.com/CandidateMAX/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => normalizeWhitespace(value)

const normalizeJobId = (value) => normalizeWhitespace(value)
  ?.replace(/\s*-\s*/g, '-')
  .replace(/\s+/g, '') || null

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractSections = (html) => {
  const page = String(html ?? '')
  const explicitSections = [...page.matchAll(
    /<section\b[^>]*class=["'][^"']*\bcareer-opening\b[^"']*["'][^>]*>[\s\S]*?<\/section>/gi,
  )].map((match) => match[0])

  if (explicitSections.length) {
    return explicitSections
  }

  return page
    .split(/(?=JOB ID:\s*VisAI\s*-\s*\d+)/i)
    .slice(1)
    .map((section) => section.match(
      /JOB ID:\s*VisAI\s*-\s*\d+[\s\S]*?(?=JOB ID:\s*VisAI\s*-\s*\d+|<footer\b|<\/main>|©\s*All rights reserved|$)/i,
    )?.[0] ?? section)
}

const getFieldValue = (sectionHtml, label) => stripHtml(
  sectionHtml.match(new RegExp(`${escapeRegExp(label)}\\s*:?\\s*([\\s\\S]*?)(?:<\\/p>|\\n|$)`, 'i'))?.[1],
)

const getApplyUrl = (sectionHtml) => {
  const href = String(sectionHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1] ?? '')
  if (!href) return APPLY_URL

  try {
    return new URL(href, CAREERS_URL).toString()
  } catch {
    return APPLY_URL
  }
}

const getSkills = (sectionHtml) => [...String(sectionHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripHtml(match[1]))
  .filter(Boolean)

const buildDescription = ({ location, experienceRequired, qualification }) => [
  location ? `Location: ${location}` : null,
  experienceRequired ? `Experience: ${experienceRequired}` : null,
  qualification ? `Education Qualification: ${qualification}` : null,
].filter(Boolean).join(' | ')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /Edge AI and Computer Vision Product Development Experts- Home/i.test(page)
    && /Join VisAI Labs\./i.test(page)
    && /Apply Now!/i.test(page)
    && /https:\/\/visailabs\.com\/careers\//i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  return /\bCareers\b/i.test(text)
    && /Build the next-gen tech with us!/i.test(text)
    && /Positions and Eligibility/i.test(text)
    && /JOB ID:\s*VisAI-\s*001/i.test(page)
    && /hrmax\.myadrenalin\.com/i.test(page)
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  return /Get in touch/i.test(text)
    && /Development Centre:/i.test(text)
    && /Chennai\s*-\s*600\s*045,\s*India/i.test(text)
    && /Contact\s*-\s*Visai Labs/i.test(page)
}

export const extractOpenings = (html) => extractSections(html)
  .map((sectionHtml) => {
    const jobId = normalizeJobId(sectionHtml.match(/JOB ID:\s*([^<\n]+)/i)?.[1])
    const title = getFieldValue(sectionHtml, 'Position')
    const rawLocation = getFieldValue(sectionHtml, 'Location')
    const city = normalizeCity(rawLocation)
    const experienceRequired = getFieldValue(sectionHtml, 'Experience')
    const qualification = getFieldValue(sectionHtml, 'Education Qualification')
    const requiredSkills = getSkills(sectionHtml)
    const applyUrl = getApplyUrl(sectionHtml)

    if (!jobId || !title || !rawLocation || !city || !applyUrl) {
      return null
    }

    return {
      title,
      company: COMPANY,
      department: null,
      location: `${city}, India`,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: qualification,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: buildDescription({
        location: rawLocation,
        experienceRequired,
        qualification,
      }),
    }
  })
  .filter(Boolean)
  .sort((left, right) => left.jobId.localeCompare(right.jobId))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createVisAiLabsScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('VisAI Labs homepage no longer matches the verified official public site')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('VisAI Labs careers page no longer matches the verified official public jobs surface')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('VisAI Labs contact page no longer matches the verified official careers contact surface')
    }

    const jobs = extractOpenings(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createVisAiLabsScraper().run(options)

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
