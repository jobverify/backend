import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MAGNASOFT_CONSULTING_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_BOARD_URL = PROVIDER_METADATA.jobsBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#34;|&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#34;|&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;|&#160;/gi, ' ')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersShellSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers\s*-\s*Magnasoft\s*<\/title>/i.test(page)
    && text.includes('Careers')
    && (text.includes('Talk to Us') || text.includes('Contact Us'))
    && /site:\s*"https:\/\/magnasoft\.zohorecruit\.in"/i.test(page)
    && /empty_job_msg:\s*"No current Openings"/i.test(page)
}

export const hasOfficialJobsBoardSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Jobs at Magnasoft Consulting India Pvt\.\s*Ltd\.\s*<\/title>/i.test(page)
    && /id="jobs"/i.test(page)
    && /id="meta"/i.test(page)
    && text.includes('Magnasoft Consulting India Pvt. Ltd.')
}

export const extractHiddenInputValue = (html = '', inputId = '') => {
  const tags = String(html ?? '').match(/<input\b[^>]*>/gi) || []

  for (const tag of tags) {
    const id = tag.match(/\bid=["']([^"']+)["']/i)?.[1] || null
    if (id !== inputId) continue

    return tag.match(/\bvalue=["']([\s\S]*?)["']/i)?.[1] || null
  }

  return null
}

const slugifyTitle = (value = '') => normalizeWhitespace(value)
  ?.replace(/[^A-Za-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || ''

const buildZohoDetailUrl = ({ jobId, title }) => {
  const slug = slugifyTitle(title)
  if (!jobId || !slug) return JOBS_BOARD_URL
  return `${JOBS_BOARD_URL}/${jobId}/${slug}?source=CareerSite`
}

const normalizeEmploymentType = (value = '') => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/full\s*time/i.test(normalized)) return 'Full-time'
  if (/part\s*time/i.test(normalized)) return 'Part-time'
  if (/contract/i.test(normalized)) return 'Contract'
  return normalized
}

export const extractBoardJobs = (html = '') => {
  const rawJobsValue = extractHiddenInputValue(html, 'jobs')
  if (!rawJobsValue) return []

  let jobsPayload
  try {
    jobsPayload = JSON.parse(decodeHtmlEntities(rawJobsValue))
  } catch {
    return []
  }

  return Array.isArray(jobsPayload)
    ? jobsPayload
      .filter((job) => job?.Publish === true)
      .filter((job) => normalizeWhitespace(job?.Country) === 'India')
      .map((job) => {
        const title = normalizeWhitespace(job?.Posting_Title || job?.Job_Opening_Name)
        const jobId = normalizeWhitespace(job?.id)
        const city = normalizeWhitespace(job?.City)
        if (!title || !jobId || !city) return null

        const detailUrl = buildZohoDetailUrl({ jobId, title })
        return {
          title,
          company: COMPANY,
          department: normalizeWhitespace(job?.Industry),
          location: `${city}, India`,
          city,
          country: 'India',
          jobId,
          requisitionId: jobId,
          sourceUrl: detailUrl,
          applyUrl: detailUrl,
          employmentType: normalizeEmploymentType(job?.Job_Type),
          experienceRequired: null,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: null,
          closingDate: null,
          jobDescription: null,
          ...(job?.Remote_Job === true ? { remoteStatus: 'Remote' } : {}),
        }
      })
      .filter(Boolean)
    : []
}

export const createMagnasoftConsultingIndiaScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersShellSignal(careersHtml)) {
      throw new Error('Magnasoft Consulting India verified first-party careers shell changed materially')
    }

    const jobsBoardHtml = await fetchText(JOBS_BOARD_URL)
    if (!hasOfficialJobsBoardSignal(jobsBoardHtml)) {
      throw new Error('Magnasoft Consulting India verified Zoho Recruit jobs board changed materially')
    }

    return extractBoardJobs(jobsBoardHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createMagnasoftConsultingIndiaScraper().run(options)

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
