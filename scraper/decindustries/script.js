import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://decindustries.in/'
export const CAREERS_URL = 'https://decindustries.in/careers'
export const COMPANY = 'DEC Industries'
export const SOURCE = 'decindustries'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const INDEX_BUNDLE_PATTERN = /<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["'][^>]*>/i
const CAREERS_BUNDLE_PATTERN = /import\("(\.\/CareersPage-[^"]+\.js)"\)/
const JOB_ARRAY_START_MARKER = ',s=['
const JOB_ARRAY_END_MARKER = '],j=()=>'
const JOB_BLOCK_PATTERN =
  /\{\s*id:"([^"]+)",\s*title:"([^"]+)",\s*location:"([^"]+)",\s*schedule:"([^"]+)",\s*jobNumber:"([^"]+)",\s*segmentation:"([^"]+)",\s*description:`([\s\S]*?)`,\s*responsibilities:\[([\s\S]*?)\],\s*offer:\[([\s\S]*?)\],\s*qualifications:\[([\s\S]*?)\]\s*\}/g
const QUOTED_STRING_PATTERN = /"(?:\\.|[^"\\])*"/g

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const decodeTemplateLiteral = (value) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/\\n/g, '\n')
  .replace(/\\r/g, '\r')
  .replace(/\\t/g, '\t')
  .replace(/\\`/g, '`')
  .replace(/\\"/g, '"')
  .replace(/\\\\/g, '\\')
  .trim()

const extractQuotedStrings = (value) => [...String(value ?? '').matchAll(QUOTED_STRING_PATTERN)]
  .map((match) => JSON.parse(match[0]))
  .map((item) => normalizeWhitespace(item))
  .filter(Boolean)

const buildJobDescription = ({
  description,
  responsibilities,
  offer,
  qualifications,
}) => {
  const sections = [
    ['JOB DESCRIPTION', decodeTemplateLiteral(description)],
    ['KEY RESPONSIBILITIES', responsibilities],
    ['WHAT WE OFFER', offer],
    ['JOB QUALIFICATIONS', qualifications],
  ]

  return sections
    .map(([heading, value]) => {
      if (Array.isArray(value)) {
        const lines = value.map((item) => `- ${item}`).join('\n')
        return `${heading}:\n${lines}`
      }

      return `${heading}:\n${value}`
    })
    .join('\n\n')
}

const inferEmploymentType = (schedule) => {
  const normalized = normalizeWhitespace(schedule)?.toLowerCase() || ''

  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('contract') && !normalized.includes('full time')) return 'Contract'
  if (normalized.includes('full time')) return 'Full-time'
  return null
}

export const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => new URL(value, baseUrl).toString()

export const extractIndexBundlePath = (html) => {
  const match = INDEX_BUNDLE_PATTERN.exec(String(html ?? ''))
  return match?.[1] || null
}

export const extractCareersBundlePath = (indexBundleText) => {
  const match = CAREERS_BUNDLE_PATTERN.exec(String(indexBundleText ?? ''))
  return match?.[1] || null
}

const extractJobsArrayLiteral = (careersBundleText) => {
  const bundle = String(careersBundleText ?? '')
  const start = bundle.indexOf(JOB_ARRAY_START_MARKER)
  if (start === -1) {
    throw new Error('DEC Industries careers bundle no longer exposes the expected jobs array')
  }

  const end = bundle.indexOf(JOB_ARRAY_END_MARKER, start)
  if (end === -1) {
    throw new Error('DEC Industries careers bundle no longer closes the expected jobs array')
  }

  const arrayStart = start + JOB_ARRAY_START_MARKER.length - 1
  return bundle.slice(arrayStart, end + 1)
}

export const extractJobsFromCareersBundle = (careersBundleText) => {
  const jobsLiteral = extractJobsArrayLiteral(careersBundleText)
  const jobs = []

  for (const match of jobsLiteral.matchAll(JOB_BLOCK_PATTERN)) {
    const [
      ,
      requisitionId,
      title,
      location,
      schedule,
      jobId,
      department,
      description,
      responsibilitiesLiteral,
      offerLiteral,
      qualificationsLiteral,
    ] = match

    const responsibilities = extractQuotedStrings(responsibilitiesLiteral)
    const offer = extractQuotedStrings(offerLiteral)
    const qualifications = extractQuotedStrings(qualificationsLiteral)

    jobs.push({
      title: normalizeWhitespace(title),
      company: COMPANY,
      location: normalizeWhitespace(location),
      country: 'India',
      employmentType: inferEmploymentType(schedule),
      jobId: normalizeWhitespace(jobId),
      requisitionId: normalizeWhitespace(requisitionId),
      department: normalizeWhitespace(department),
      schedule: normalizeWhitespace(schedule),
      description: buildJobDescription({
        description,
        responsibilities,
        offer,
        qualifications,
      }),
      minimumQualification: qualifications[0] || null,
      preferredQualification: null,
      requiredSkills: [],
      experienceRequired: null,
      sourceUrl: `${CAREERS_URL}/${requisitionId}`,
      applyUrl: `${CAREERS_URL}/${requisitionId}/apply`,
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const createDecIndustriesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    const indexBundlePath = extractIndexBundlePath(homepageHtml)

    if (!indexBundlePath) {
      throw new Error('DEC Industries homepage no longer exposes the expected Vite entry bundle')
    }

    const indexBundleUrl = toAbsoluteUrl(indexBundlePath)
    const indexBundleText = await fetchText(indexBundleUrl)
    const careersBundlePath = extractCareersBundlePath(indexBundleText)

    if (!careersBundlePath) {
      throw new Error('DEC Industries index bundle no longer exposes the careers route bundle')
    }

    const careersBundleText = await fetchText(toAbsoluteUrl(careersBundlePath, indexBundleUrl))

    return extractJobsFromCareersBundle(careersBundleText).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createDecIndustriesScraper().run(options)

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
