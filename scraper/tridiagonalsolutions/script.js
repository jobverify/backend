import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'tridiagonalsolutions'
export const COMPANY = 'Tridiagonal Solutions Pvt Ltd'
export const CAREERS_URL = 'https://www.tridiagonal.com/careers'
export const CAREERS_API_BASE_URL = 'https://www.tridiagonal.com/api/careers/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#8211;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(value).replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).href
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)?.replace(/\s*,?\s*india\s*$/i, '')
  return normalized ? `${normalized}, India` : null
}

const deriveCity = (location) => {
  const raw = normalizeWhitespace(String(location ?? '').replace(/,\s*India$/i, ''))
  if (!raw) return null

  const primaryToken = normalizeWhitespace(raw.split(',')[0]?.replace(/\s*\([^)]*\)\s*$/g, ''))
  return primaryToken ? normalizeCity(primaryToken) : null
}

const deriveJobSlugFromUrl = (value) => {
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    return slugify(segments.at(-1))
  } catch {
    return slugify(value)
  }
}

const deriveRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/remote/i.test(normalized)) return 'Remote'
  if (/hybrid/i.test(normalized)) return 'Hybrid'
  return 'On-site'
}

const normalizeExperience = (value) => normalizeWhitespace(value)?.replace(/\byears?\b/gi, 'years') || null

const buildDescriptionSection = (label, items) => {
  const values = Array.isArray(items)
    ? items.map((item) => stripTags(item)).filter(Boolean)
    : [stripTags(items)].filter(Boolean)

  return values.length > 0 ? `${label}: ${values.join(' ')}` : null
}

const buildJobDescription = (record = {}) => [
  stripTags(record.overview),
  buildDescriptionSection('Responsibilities', record.responsibilities),
  buildDescriptionSection('Requirements', record.requirements),
  buildDescriptionSection('Benefits', record.benefits),
]
  .filter(Boolean)
  .join(' ') || null

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*-\s*Tridiagonal Solutions\s*<\/title>/i.test(page)
    && /Search by title,\s*department,\s*or location/i.test(page)
    && /class="jobs-dept-select"/i.test(page)
    && /class="jobs-list"/i.test(page)
    && /class="job-row-title"/i.test(page)
    && /class="job-apply-btn"/i.test(page)
}

export const extractOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Tridiagonal Solutions verified official public careers surface changed or disappeared')
  }

  const jobs = []
  const page = String(html ?? '')

  for (const match of page.matchAll(
    /<div class="job-row">([\s\S]*?)<a class="job-apply-btn" href="([^"]+)">\s*APPLY NOW\s*<\/a>\s*<\/div>/gi,
  )) {
    const rowHtml = match[1]
    const detailUrl = toAbsoluteUrl(match[2])
    const title = stripTags(rowHtml.match(/<h3 class="job-row-title">([\s\S]*?)<\/h3>/i)?.[1])

    const meta = [...rowHtml.matchAll(
      /<span class="job-meta-pill(?: job-type-pill)?">([\s\S]*?)<\/span>/gi,
    )].map((item) => stripTags(item[1]))

    const [department, rawLocation, postingDate, employmentType] = meta
    const location = normalizeLocation(rawLocation)

    if (!title || !department || !location || !detailUrl) continue

    jobs.push({
      title,
      department,
      location,
      city: deriveCity(location),
      postingDate: postingDate || null,
      employmentType: employmentType || null,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      remoteStatus: deriveRemoteStatus(location),
    })
  }

  if (jobs.length === 0) {
    throw new Error('Tridiagonal Solutions verified official public careers surface changed or disappeared')
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

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const buildJobDetailApiUrl = (jobOrUrl) => {
  const detailUrl = typeof jobOrUrl === 'string'
    ? jobOrUrl
    : jobOrUrl?.sourceUrl || jobOrUrl?.applyUrl || ''
  const slug = deriveJobSlugFromUrl(detailUrl)

  if (!slug) return null

  try {
    return new URL(`/api/careers/jobs/${slug}`, CAREERS_URL).toString()
  } catch {
    return `${CAREERS_API_BASE_URL}/${slug}`
  }
}

export const extractJobDetail = (payload = {}) => {
  const record = payload?.data && typeof payload.data === 'object'
    ? payload.data
    : payload

  const location = normalizeLocation(record?.location)
  const jobDescription = buildJobDescription(record)
  const experienceRequired = normalizeExperience(record?.experience)
  const minimumQualification = normalizeWhitespace(record?.education)

  return {
    department: normalizeWhitespace(record?.department),
    location,
    employmentType: normalizeWhitespace(record?.type),
    postingDate: normalizeWhitespace(record?.date),
    experienceRequired,
    minimumQualification,
    jobDescription,
    publicExperienceChecked: Boolean(jobDescription || experienceRequired || minimumQualification),
  }
}

const mergeJobDetail = (job, detail = {}) => ({
  ...job,
  department: detail.department || job.department || null,
  location: detail.location || job.location || null,
  city: detail.location ? deriveCity(detail.location) || job.city : job.city,
  employmentType: detail.employmentType || job.employmentType || null,
  postingDate: detail.postingDate || job.postingDate || null,
  experienceRequired: detail.experienceRequired || job.experienceRequired || null,
  minimumQualification: detail.minimumQualification || job.minimumQualification || null,
  jobDescription: detail.jobDescription || job.jobDescription || null,
  remoteStatus: deriveRemoteStatus(detail.location || job.location) || job.remoteStatus,
  publicExperienceChecked: detail.publicExperienceChecked ?? job.publicExperienceChecked ?? false,
})

export const createTridiagonalSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const html = await fetchText(CAREERS_URL)

    const jobs = []

    for (const job of extractOpenings(html)) {
      const identitySlug = deriveJobSlugFromUrl(job.sourceUrl)
      const baseJob = {
        ...job,
        company: COMPANY,
        country: 'India',
        source: SOURCE,
        jobId: `${SOURCE}-${identitySlug}`,
        requisitionId: `${SOURCE}-${identitySlug}`,
        preferredQualification: null,
        requiredSkills: [],
        closingDate: null,
        minimumQualification: null,
        experienceRequired: null,
        jobDescription: null,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }
      const detailApiUrl = buildJobDetailApiUrl(job)

      if (!detailApiUrl) {
        jobs.push(baseJob)
        continue
      }

      try {
        jobs.push(mergeJobDetail(baseJob, extractJobDetail(await fetchJson(detailApiUrl))))
      } catch {
        jobs.push(baseJob)
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createTridiagonalSolutionsScraper().run(options)

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
