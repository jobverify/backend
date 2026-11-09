import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'greenavni'
export const COMPANY = 'Green Avni Solutions LLP'
export const HOMEPAGE_URL = 'https://www.greenavni.com/'
export const ABOUT_URL = 'https://www.greenavni.com/about/'
export const CAREERS_URL = 'https://www.greenavni.com/careers/'
export const JOBS_URL = 'https://www.greenavni.com/open-positions/'
export const APPLY_EMAIL = 'hr@greenavni.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '–')
  .replace(/&#8212;|&mdash;/gi, '—')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeText = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeText(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractTextLines = (html) => decodeHtmlEntities(
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/section|\/article|\/main|\/header|\/footer|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|section|article|main|header|footer|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean)

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('Green Avni Solutions LLP | Energy Management and Sustainability Partner')
    && normalized.includes('Serving our clients to achieve their ESG goals is our core business.')
    && normalized.includes('Green Avni team comprises passionate and motivated sustainability professionals')
    && normalized.includes('Center-of-Excellence team based out of Hyderabad, India')
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('founded ‘Green Avni Solutions, LLP’ in March 2019')
    && normalized.includes('Pavani and Prakash relocated from Boston to Hyderabad')
    && normalized.includes('Green Avni Solutions primary focus')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('Energy Career Opportunities')
    && normalized.includes('We are hiring for the following energy job opportunities, based out of our office in Hyderabad, India.')
    && normalized.includes(`sending your resume and cover letter to ${APPLY_EMAIL}`)
    && normalized.includes('Open Positions')
    && /href=["']https:\/\/www\.greenavni\.com\/open-positions\/["']/i.test(String(html ?? ''))
}

export const hasOfficialJobsPageSignal = (html) => {
  const normalized = normalizeText(html)

  return normalized.includes('Job Opportunities')
    && normalized.includes('Green Avni Solutions, LLP provides comprehensive data-driven energy management services')
    && normalized.includes('Energy Engineer – I/Energy Engineer Analyst')
    && normalized.includes('Renewable Energy Engineer')
}

const extractJobBlock = (sourceLines, startLine, nextHeading) => {
  const startIndex = sourceLines.findIndex((line) => line === startLine)
  if (startIndex < 0) return []

  const block = []
  for (let index = startIndex; index < sourceLines.length; index += 1) {
    const line = sourceLines[index]
    if (index > startIndex && line === nextHeading) break
    if (line === '## Green Avni Solutions') break
    block.push(line)
  }

  return block
}

const extractLineAfterLabel = (block, label) => {
  const index = block.findIndex((line) => line === label)
  if (index < 0) return null
  return block[index + 1] || null
}

const extractResponsibilities = (block = []) => {
  const startIndex = block.findIndex((line) => line === 'Key Responsibilities:')
  if (startIndex < 0) return []

  const lines = []
  for (let index = startIndex + 1; index < block.length; index += 1) {
    const line = block[index]
    if (line === 'Required Qualifications' || /^Job Type:/i.test(line)) break
    if (/^(?:Must Qualifications:|Role Description:)$/.test(line)) continue
    lines.push(line.replace(/^[*•]\s*/, ''))
  }
  return lines.filter(Boolean)
}

const extractExperience = (block = []) => {
  const text = block.join(' ')
  const match = text.match(/\bat least\s+(\d+)\s+year/i)
  return match ? `At least ${match[1]} year` : null
}

const buildJob = ({ title, block }) => {
  const minimumQualification = extractLineAfterLabel(block, 'Must Qualifications:')
  const roleDescription = extractLineAfterLabel(block, 'Role Description:')
  const responsibilities = extractResponsibilities(block)
  const descriptionParts = [roleDescription, ...responsibilities].filter(Boolean)
  const jobId = `${SOURCE}-${slugify(title)}`

  return {
    title,
    company: COMPANY,
    department: null,
    location: 'Gachibowli, Hyderabad -500032, Telangana',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: JOBS_URL,
    applyUrl: `mailto:${APPLY_EMAIL}`,
    employmentType: 'Full-time',
    experienceRequired: extractExperience(block),
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: descriptionParts.join('\n') || null,
    remoteStatus: 'On-site',
  }
}

export const extractJobs = (html) => {
  const lines = extractTextLines(html)
  const firstTitle = 'Energy Engineer – I/Energy Engineer Analyst'
  const secondTitle = 'Renewable Energy Engineer'

  const firstBlock = extractJobBlock(lines, firstTitle, secondTitle)
  const secondBlock = extractJobBlock(lines, secondTitle, '## Green Avni Solutions')

  return [
    buildJob({ title: firstTitle, block: firstBlock }),
    buildJob({ title: secondTitle, block: secondBlock }),
  ]
}

export const createGreenAvniScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Green Avni verified homepage no longer matches the trusted first-party surface')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('Green Avni verified about page no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Green Avni verified careers page no longer matches the trusted first-party surface')
    }

    const jobsHtml = await fetchText(JOBS_URL)
    if (!hasOfficialJobsPageSignal(jobsHtml)) {
      throw new Error('Green Avni verified jobs page no longer matches the trusted first-party surface')
    }

    if (!normalizeText(jobsHtml).includes(APPLY_EMAIL)) {
      throw new Error('Green Avni jobs page no longer exposes the shared apply mailbox')
    }

    const jobs = extractJobs(jobsHtml)
    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createGreenAvniScraper().run(options)

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
