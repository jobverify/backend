import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {runWebandcraftsNative} from './native.js'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'webandcrafts'
export const COMPANY = 'Webandcrafts'
export const COMPANY_DOMAIN = 'webandcrafts.com'
export const HOMEPAGE_URL = 'https://webandcrafts.com/'
export const CAREERS_URL = 'https://webandcrafts.com/careers'
export const JOBS_INDEX_URL = 'https://webandcrafts.com/careers/job-openings'
export const JOBS_API_URL = 'https://forms.webandcrafts.com/api/careers/career-job-listing'
export const ATS_PLATFORM = 'webandcrafts-first-party-careers-api'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#039;|&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const htmlToText = (value) => {
  const normalized = decodeHtml(value)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return normalized || null
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('on-site') || normalized.includes('onsite')) return 'On-site'
  return normalizeWhitespace(value)
}

const titleCaseWord = (value) =>
  value.length > 1
    ? `${value[0].toUpperCase()}${value.slice(1).toLowerCase()}`
    : value.toUpperCase()

const normalizeLocationCase = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (!/^[a-z][a-z\s/-]*$/i.test(normalized)) return normalized

  return normalized.replace(/[A-Za-z]+/g, (part) => (
    /^[A-Z]{2,}$/.test(part) ? part : titleCaseWord(part)
  ))
}

const normalizeLocation = (value) => {
  const normalized = normalizeLocationCase(value)
  if (!normalized) return null
  return normalized
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)?.replace(/,\s*India$/i, '')
  if (!normalized) return null
  if (/\b(or|and)\b|[/|,&-]/i.test(normalized)) return null
  return normalized
}

const decodeFlightChunk = (value) => {
  try {
    return JSON.parse(`"${String(value ?? '')}"`)
  } catch {
    return null
  }
}

const extractFlightChunks = (html) =>
  [...String(html ?? '').matchAll(/self\.__next_f\.push\(\[1,"((?:\\.|[^"])*)"\]\)/g)]
    .map((match) => decodeFlightChunk(match[1]))
    .filter(Boolean)

const extractJsonValue = (source, marker) => {
  const text = String(source ?? '')
  const start = text.indexOf(marker)
  if (start < 0) return null

  let cursor = start + marker.length
  const open = text[cursor]
  const close = open === '[' ? ']' : open === '{' ? '}' : null
  if (!close) return null

  const valueStart = cursor
  let depth = 0
  let inString = false
  let escaped = false

  for (; cursor < text.length; cursor += 1) {
    const char = text[cursor]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === open) depth += 1

    if (char === close) {
      depth -= 1
      if (depth === 0) {
        return text.slice(valueStart, cursor + 1)
      }
    }
  }

  return null
}

const buildJobUrl = (job) => {
  const slug = normalizeWhitespace(job?.slug)
  const jobId = Number(job?.id)
  const departmentId = Number(job?.wac_pro_job_dept?.id)

  if (!slug || !Number.isFinite(jobId) || !Number.isFinite(departmentId)) {
    throw new Error('Webandcrafts job payload no longer exposes the verified detail route fields')
  }

  return `${JOBS_INDEX_URL}/${slug}?job_id=${jobId}&dept=${departmentId}`
}

const buildJobDescription = (job, categoryName) => {
  const category = normalizeWhitespace(categoryName)
  const track = normalizeWhitespace(job?.department_id?.name)
  const headerLines = [
    'Official Webandcrafts opening listed on the first-party public jobs surface.',
    category ? `Department: ${category}.` : null,
    track && track !== category ? `Track: ${track}.` : null,
  ].filter(Boolean)

  const sections = [
    ['About', job?.about],
    ['Responsibilities', job?.responsibilities],
    ['Requirements', job?.requirements],
    ['Join The Team', job?.join_team_content],
  ]
    .map(([label, html]) => {
      const text = htmlToText(html)
      return text ? `${label}:\n${text}` : null
    })
    .filter(Boolean)

  return [...headerLines, ...sections].join('\n\n')
}

const parseOpeningsCount = (value) => {
  const count = Number(value)
  return Number.isInteger(count) && count > 0 ? count : null
}

const parseJobOpeningsPayload = (html) => {
  const payloadChunk = extractFlightChunks(html).find((chunk) => chunk.includes('"jobOpenings":['))
  if (!payloadChunk) {
    throw new Error('Webandcrafts verified public jobs index no longer exposes the first-party category payload')
  }

  const json = extractJsonValue(payloadChunk, '"jobOpenings":')
  if (!json) {
    throw new Error('Webandcrafts verified public jobs index no longer exposes the first-party category payload')
  }

  try {
    return JSON.parse(json)
  } catch {
    throw new Error('Webandcrafts verified public jobs index category payload is no longer valid JSON')
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = htmlToText(page) || ''

  return (
    /<title>\s*WAC:\s*Digital Transformation Services &amp; Solutions Company\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/webandcrafts\.com\/?"\s*\/?>/i.test(page)
    && /href=["']\/careers["']/i.test(page)
    && /info@webandcrafts\.com/i.test(page)
    && /Helping You Take the Digital Leap/i.test(text)
    && /You Will Like It Here!/i.test(text)
  )
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = htmlToText(page) || ''

  return (
    /<title>\s*Careers at WAC \| Join Our Dynamic Team at Infopark, Kerala\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/webandcrafts\.com\/careers"\s*\/?>/i.test(page)
    && /Current openings/i.test(text)
    && /See all openings/i.test(text)
    && /href=["']\/careers\/job-openings["']/i.test(page)
  )
}

export const hasOfficialJobsIndexSignal = (html) => {
  const page = String(html ?? '')
  const text = htmlToText(page) || ''
  const hasFlightJobPayload = extractFlightChunks(page).some((chunk) => chunk.includes('"jobOpenings":['))

  return (
    /<title>\s*Infopark Jobs &amp; Vacancies For Freshers &amp; Experienced At WAC\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/webandcrafts\.com\/careers\/job-openings"\s*\/?>/i.test(page)
    && /Job Openings/i.test(text)
    && hasFlightJobPayload
  )
}

export const extractJobCategories = (html) => {
  if (!hasOfficialJobsIndexSignal(html)) {
    throw new Error('Webandcrafts verified public jobs index no longer matches the known first-party surface')
  }

  const categories = parseJobOpeningsPayload(html)
    .map((item) => ({
      id: Number(item?.id),
      categoryName: normalizeWhitespace(item?.category_name),
      totalOpenings: parseOpeningsCount(item?.total_openings),
      isActive: item?.is_active === true,
    }))
    .filter((item) => item.isActive && Number.isFinite(item.id) && item.categoryName && item.totalOpenings)
    .map(({ id, categoryName, totalOpenings }) => ({ id, categoryName, totalOpenings }))

  if (categories.length === 0) {
    throw new Error('Webandcrafts verified public jobs index no longer exposes active public job categories')
  }

  return categories
}

const validateDepartmentPayload = (payload, category) => {
  const data = payload?.results?.data

  if (!payload?.status || !Array.isArray(data) || data.length === 0) {
    throw new Error(
      `Webandcrafts verified public department openings no longer return active jobs for ${category.categoryName}`,
    )
  }

  if (
    Number.isFinite(Number(payload?.results?.total_records))
    && Number(payload.results.total_records) !== data.length
  ) {
    throw new Error(
      `Webandcrafts verified public department openings no longer match the expected record count for ${category.categoryName}`,
    )
  }

  let openingSum = 0

  for (const job of data) {
    const jobCategoryId = Number(job?.wac_pro_job_dept?.id)
    const jobCategoryName = normalizeWhitespace(job?.wac_pro_job_dept?.category_name)
    const openings = parseOpeningsCount(job?.number_of_openings)

    if (
      job?.is_active !== true
      || jobCategoryId !== category.id
      || jobCategoryName !== category.categoryName
      || !normalizeWhitespace(job?.title)
      || !normalizeWhitespace(job?.slug)
      || !normalizeWhitespace(job?.requisition_id)
      || !openings
    ) {
      throw new Error(
        `Webandcrafts verified public department openings no longer expose normalized job records for ${category.categoryName}`,
      )
    }

    openingSum += openings
  }

  const hasVerifiedOpeningTotal = openingSum === category.totalOpenings
    || data.length === category.totalOpenings

  if (!hasVerifiedOpeningTotal) {
    throw new Error(
      `Webandcrafts verified public department openings no longer match the verified opening total for ${category.categoryName}`,
    )
  }

  return data
}

export const extractDepartmentJobs = (payload, category) => {
  const records = validateDepartmentPayload(payload, category)

  return records.map((job) => {
    const rawLocation = normalizeLocation(job.location)
    const country = /(?:^|,)\s*India\s*$/i.test(rawLocation || '') ? 'India' : null
    const location = country ? rawLocation : null
    const remoteStatus = normalizeRemoteStatus(job.job_type)
    const requisitionId = normalizeWhitespace(job.requisition_id) || `${SOURCE}-${job.id}`
    const sourceUrl = buildJobUrl(job)

    return {
      title: normalizeWhitespace(job.title),
      company: COMPANY,
      department: category.categoryName,
      location,
      city: null,
      state: null,
      country,
      nativeWorkplace: job.location,
      sourceCountryScopeUnresolved: !country,
      jobId: requisitionId,
      requisitionId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: normalizeWhitespace(job.formatted_experience_range),
      minimumQualification: htmlToText(job.requirements),
      preferredQualification: null,
      requiredSkills: Array.isArray(job.technology)
        ? job.technology.map((item) => normalizeWhitespace(item)).filter(Boolean)
        : [],
      postingDate: null,
      sourceRawDates: {created_at: job.created_at},
      closingDate: null,
      jobDescription: buildJobDescription(job, category.categoryName),
      remoteStatus,
    }
  })
}

export const createWebandcraftsScraper = (configuration = {}) => ({
  run: (options = {}) => runWebandcraftsNative({...configuration, ...options}),
})

export const run = async (options = {}) => createWebandcraftsScraper().run(options)

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
