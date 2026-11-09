import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bytestrone'
export const COMPANY = 'Bytestrone'
export const COMPANY_DOMAIN = 'bytestrone.com'
export const ATS_PLATFORM = 'official-company-careers'
export const POSITION_PAGE_URL = 'https://bytestrone.com/en/position/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toArray = (value) => Array.isArray(value) ? value : []

const linesFromRichText = (value) => {
  const lines = []

  const visit = (node) => {
    if (!node) return

    if (typeof node === 'string') {
      const normalized = normalizeWhitespace(node)
      if (normalized) lines.push(normalized)
      return
    }

    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }

    if (typeof node === 'object') {
      if (typeof node.text === 'string') {
        const normalized = normalizeWhitespace(node.text)
        if (normalized) lines.push(normalized)
      }

      if (Array.isArray(node.children)) {
        node.children.forEach(visit)
      }

      if (Array.isArray(node.content)) {
        node.content.forEach(visit)
      }
    }
  }

  visit(value)
  return lines
}

const joinLines = (lines = []) => {
  const normalizedLines = lines
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

  return normalizedLines.length > 0 ? normalizedLines.join('\n') : null
}

export const buildDetailUrl = (openingId) =>
  `https://bytestrone.com/en/job/${normalizeWhitespace(openingId)}/`

export const extractNextData = (html) => {
  const match = String(html ?? '').match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i,
  )
  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

const extractOpeningPageMeta = (nextData) =>
  nextData?.props?.pageProps?.openingPageData?.[0]?.attributes ?? null

export const extractOpenings = (nextData) =>
  toArray(nextData?.props?.pageProps?.openingsData)

export const extractDetailJobData = (nextData) =>
  nextData?.props?.pageProps?.job?.data ?? null

export const hasOfficialPositionPageSignal = (html) => {
  if (!/<title>\s*Position\s*<\/title>/i.test(String(html ?? ''))) {
    return false
  }

  const nextData = extractNextData(html)
  const meta = extractOpeningPageMeta(nextData)
  const openings = nextData?.props?.pageProps?.openingsData

  return nextData?.page === '/[locale]/position'
    && Array.isArray(openings)
    && normalizeWhitespace(meta?.heading) === 'Current Openings'
    && normalizeWhitespace(meta?.page) === 'Position'
    && Boolean(normalizeWhitespace(meta?.noDataMessage))
}

export const hasOfficialDetailPageSignal = (html) => {
  const nextData = extractNextData(html)
  const detailJob = extractDetailJobData(nextData)

  return nextData?.page === '/[locale]/job/[id]'
    && Number.isInteger(Number(detailJob?.id))
    && Boolean(normalizeWhitespace(detailJob?.attributes?.jobTitle))
    && Boolean(normalizeWhitespace(detailJob?.attributes?.position?.data?.attributes?.positions))
}

const buildTitle = (attributes = {}) => {
  const positionTitle = normalizeWhitespace(attributes?.position?.data?.attributes?.positions)
  const jobTitle = normalizeWhitespace(attributes?.jobTitle)

  if (!positionTitle) return jobTitle
  if (!jobTitle) return positionTitle

  const normalizedPosition = positionTitle.toLowerCase()
  const normalizedJobTitle = jobTitle.toLowerCase()

  if (normalizedPosition.includes(normalizedJobTitle)) return positionTitle
  if (normalizedJobTitle.includes(normalizedPosition)) return jobTitle

  return `${positionTitle} - ${jobTitle}`
}

const extractSectionByLabel = (additionalDetails, labelPattern) =>
  toArray(additionalDetails).find((section) => labelPattern.test(normalizeWhitespace(section?.label) || ''))

const sectionBody = (additionalDetails, labelPattern) =>
  joinLines(linesFromRichText(extractSectionByLabel(additionalDetails, labelPattern)?.content))

const extractExperienceRequired = (attributes = {}) => {
  const requirementsLines = linesFromRichText(
    extractSectionByLabel(attributes?.additionalDetails, /requirements/i)?.content,
  )
  const experienceLine = requirementsLines.find((line) => /\byears?\s+of\s+experience\b/i.test(line))
  if (experienceLine) return experienceLine

  const detailLines = linesFromRichText(attributes?.details)
  return detailLines.find((line) => /\byears?\s+of\s+experience\b/i.test(line)) || null
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('on site') || normalized.includes('on-site') || normalized.includes('onsite')) {
    return 'On-site'
  }
  return normalizeWhitespace(value)
}

const extractRequiredSkills = (attributes = {}) => {
  const primarySkill = normalizeWhitespace(attributes?.skill_area?.data?.attributes?.skill)
  return primarySkill ? [primarySkill] : []
}

const buildJobDescription = (attributes = {}) => {
  const sections = [
    ['Requirements And Skill', sectionBody(attributes?.additionalDetails, /requirements/i)],
    ['Responsibilities', sectionBody(attributes?.additionalDetails, /responsibilities/i)],
    ['Preferred Qualifications', sectionBody(attributes?.additionalDetails, /preferred qualifications/i)],
  ]
    .filter(([, body]) => Boolean(body))
    .map(([label, body]) => `${label}:\n${body}`)

  return [joinLines(linesFromRichText(attributes?.details)), ...sections]
    .filter(Boolean)
    .join('\n\n') || null
}

export const mapOpeningToJob = ({
  openingSummary,
  detailPageHtml,
}) => {
  if (!hasOfficialDetailPageSignal(detailPageHtml)) {
    throw new Error('Bytestrone detail page no longer matches the verified first-party job payload')
  }

  const detailData = extractDetailJobData(extractNextData(detailPageHtml))
  if (String(detailData?.id) !== String(openingSummary?.id)) {
    throw new Error('Bytestrone detail page no longer matches the verified first-party job payload')
  }

  const attributes = detailData?.attributes || {}
  const rawLocation = normalizeWhitespace(attributes?.location?.data?.attributes?.location)

  return {
    title: buildTitle(attributes),
    company: COMPANY,
    department: normalizeWhitespace(attributes?.position?.data?.attributes?.positions),
    location: rawLocation ? `${rawLocation}, India` : null,
    city: rawLocation,
    state: null,
    country: 'India',
    jobId: String(detailData.id),
    requisitionId: String(detailData.id),
    sourceUrl: buildDetailUrl(detailData.id),
    applyUrl: buildDetailUrl(detailData.id),
    employmentType: null,
    experienceRequired: extractExperienceRequired(attributes),
    minimumQualification: sectionBody(attributes?.additionalDetails, /requirements/i),
    preferredQualification: sectionBody(attributes?.additionalDetails, /preferred qualifications/i),
    requiredSkills: extractRequiredSkills(attributes),
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(attributes),
    remoteStatus: normalizeRemoteStatus(attributes?.work_type?.data?.attributes?.type),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createBytestroneScraper = ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText: overrideFetchText,
    now: overrideNow,
  } = {}) {
    const fetchTextImpl = overrideFetchText || fetchText
    const positionPageHtml = await fetchTextImpl(POSITION_PAGE_URL)

    if (!hasOfficialPositionPageSignal(positionPageHtml)) {
      throw new Error('Bytestrone position page no longer matches the verified first-party public surface')
    }

    const nextData = extractNextData(positionPageHtml)
    const openings = extractOpenings(nextData)

    if (!Array.isArray(openings)) {
      throw new Error('Bytestrone openings data is missing from the verified first-party position page')
    }

    if (openings.length === 0) {
      return []
    }

    const scrapedAt = (overrideNow || now)()
    const jobs = []

    for (const openingSummary of openings) {
      const detailPageHtml = await fetchTextImpl(buildDetailUrl(openingSummary?.id))
      jobs.push(mapOpeningToJob({ openingSummary, detailPageHtml }))
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      companyCareerPage: POSITION_PAGE_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: ATS_PLATFORM,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createBytestroneScraper().run(options)

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
