import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

export const CAREER_PAGE_URL = 'https://jobs.lever.co/hevodata/'
export const LEVER_ENDPOINT = 'https://api.lever.co/v0/postings/hevodata?mode=json'

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; JobverifyBot/1.0)',
  Accept: 'application/json',
}

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&mdash;/gi, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const isIndiaJob = (job) => [
  job?.categories?.location,
  ...(Array.isArray(job?.categories?.allLocations) ? job.categories.allLocations : []),
].some((location) => /(^|[\s,-])india\b/i.test(normalizeWhitespace(location) || ''))

const extractCity = (location) => normalizeWhitespace(location)?.split(/\s+-\s+|,/)[0] || null

const toRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'
  return null
}

const toIsoDateTime = (value) => {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return null

  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const collectRichDescriptionSections = (job = {}) => {
  const sections = [
    job?.openingPlain,
    job?.opening,
    job?.descriptionPlain,
    job?.descriptionBodyPlain,
    job?.description,
    job?.additionalPlain,
    job?.additional,
    ...(Array.isArray(job?.lists)
      ? job.lists.flatMap((section) => [section?.text, section?.content])
      : []),
  ]

  return [...new Set(
    sections
      .map((section) => stripTags(section))
      .filter(Boolean),
  )]
}

const buildJobDescription = (job = {}) => {
  const sections = collectRichDescriptionSections(job)
  return sections.length > 0 ? sections.join(' ') : null
}

const extractExperienceRequired = (job = {}) => {
  const description = buildJobDescription(job)
  if (!description) return null

  const { experienceProfile } = extractJobFilterSignals({
    description,
  })

  if (experienceProfile?.confidence !== 'high' || !experienceProfile.evidence) {
    return null
  }

  return normalizeWhitespace(experienceProfile.evidence)?.replace(/\s*-\s*/g, '-') || null
}

export const extractLeverJobs = (leverJobs = []) => (Array.isArray(leverJobs) ? leverJobs : [])
  .filter(isIndiaJob)
  .map((job) => {
    const title = normalizeWhitespace(job?.text)
    const location = normalizeWhitespace(job?.categories?.location)
    const sourceUrl = normalizeWhitespace(job?.hostedUrl)
    const id = normalizeWhitespace(job?.id)

    if (!title || !location || !sourceUrl || !id) return null

    return {
      title,
      company: 'Hevo Data',
      department: normalizeWhitespace(job?.categories?.team || job?.categories?.department),
      location,
      city: extractCity(location),
      country: 'India',
      jobId: id,
      requisitionId: id,
      sourceUrl,
      applyUrl: normalizeWhitespace(job?.applyUrl) || sourceUrl,
      employmentType: normalizeWhitespace(job?.categories?.commitment),
      experienceRequired: extractExperienceRequired(job),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: toIsoDateTime(job?.createdAt),
      closingDate: null,
      jobDescription: buildJobDescription(job),
      remoteStatus: toRemoteStatus(job?.workplaceType),
    }
  })
  .filter(Boolean)

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: DEFAULT_HEADERS,
  label: 'hevodata',
})

export const createHevoDataScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const leverJobs = await fetchJson(LEVER_ENDPOINT)

    return extractLeverJobs(leverJobs).map((job) => ({
      ...job,
      source: 'hevodata',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createHevoDataScraper().run(options)
