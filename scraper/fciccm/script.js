import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FCI_CCM_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const BOARD_URL = PROVIDER_METADATA.officialZohoBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INPUT_TAG_PATTERN = /<input\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi
const ATTRIBUTE_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&nbsp;|&#160;/gi, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractHiddenInputValue = (html, id) => {
  for (const tag of String(html ?? '').match(INPUT_TAG_PATTERN) ?? []) {
    const attributes = {}
    for (const match of tag.matchAll(ATTRIBUTE_PATTERN)) {
      const [, key, doubleQuoted, singleQuoted, bareValue] = match
      attributes[key.toLowerCase()] = doubleQuoted ?? singleQuoted ?? bareValue ?? ''
    }

    if (attributes.id?.toLowerCase() === String(id).toLowerCase()) {
      return attributes.value ?? null
    }
  }

  return null
}

export const extractHiddenInputJson = (html, id) => {
  const rawValue = extractHiddenInputValue(html, id)
  if (!rawValue) return null

  try {
    return JSON.parse(decodeHtmlEntities(rawValue))
  } catch {
    return null
  }
}

const buildFieldApiMap = (moduleMeta = []) => {
  const map = new Map()
  const jobModule = Array.isArray(moduleMeta)
    ? moduleMeta.find((module) => module?.api_name === 'Job_Openings')
    : null

  for (const field of jobModule?.fields ?? []) {
    if (!field?.id || !field?.api_name) continue
    map.set(String(field.id), field.api_name)
  }

  return map
}

const normalizeZohoJobRecord = (rawJob = {}, fieldApiMap = new Map()) => {
  const normalized = {}

  for (const [key, value] of Object.entries(rawJob)) {
    normalized[key] = value
    const apiName = fieldApiMap.get(String(key))
    if (apiName && normalized[apiName] == null) {
      normalized[apiName] = value
    }
  }

  return normalized
}

const getFirstPresent = (record, keys) => {
  for (const key of keys) {
    if (record?.[key] != null && record[key] !== '') return record[key]
  }
  return null
}

const buildLocation = ({ city, state, country }) => {
  const parts = [normalizeText(city), normalizeText(state), normalizeText(country)]
    .filter(Boolean)
  if (parts.length === 0) return null
  return [...new Set(parts)].join(', ')
}

const normalizePostingDate = (value) => {
  const text = normalizeText(value)
  if (!text) return null
  const match = text.match(/\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

const normalizeCompensation = (value) => {
  const text = normalizeText(value)
  return text && text !== '-None-' ? text : null
}

const buildZohoDetailUrl = (recordId, title) =>
  `${BOARD_URL}/${recordId}/${slugify(title)}?source=CareerSite`

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('current openings')
    && normalized.includes('fci-ccm.zohorecruit.in/jobs/careers')
    && normalized.includes('career opportunities')
}

export const hasOfficialZohoBoardSignal = (html = '') => {
  const pageJson = extractHiddenInputJson(html, 'pageJson')
  const meta = extractHiddenInputJson(html, 'meta')
  const jobsPayload = extractHiddenInputJson(html, 'jobs')

  return Array.isArray(jobsPayload)
    && meta?.org_info?.company_name === 'Friends Color Images Pvt Ltd'
    && meta?.list_url === BOARD_URL
    && pageJson?.detail?.section?.data?.some((section) =>
      section?.blocktype === 'jobs'
      && /Join Our Team/i.test(section?.title ?? '')
      && /Current Openings/i.test(section?.subtitle ?? ''),
    )
}

export const extractJobsFromOfficialBoard = (html = '') => {
  const moduleMeta = extractHiddenInputJson(html, 'moduleMeta') ?? []
  const jobsPayload = extractHiddenInputJson(html, 'jobs')
  if (!Array.isArray(jobsPayload)) return []

  const fieldApiMap = buildFieldApiMap(moduleMeta)

  return jobsPayload
    .map((rawJob) => normalizeZohoJobRecord(rawJob, fieldApiMap))
    .filter((record) => record.Publish !== false)
    .map((record) => {
      const title = normalizeText(getFirstPresent(record, [
        'Job_Opening_Name',
        'Posting_Title',
        'Title',
        'job_title',
        'title',
      ]))
      const recordId = normalizeText(getFirstPresent(record, ['id', 'record_id', 'recordId']))

      if (!title || !recordId) return null

      const cityValue = normalizeText(getFirstPresent(record, ['City', 'city']))
      const stateValue = normalizeText(getFirstPresent(record, ['State', 'state']))
      const countryValue = normalizeText(getFirstPresent(record, ['Country', 'country'])) || 'India'
      const detailUrl = buildZohoDetailUrl(recordId, title)

      return {
        title,
        jobId: `${SOURCE}-${recordId}`,
        requisitionId: recordId,
        sourceUrl: detailUrl,
        applyUrl: detailUrl,
        location: buildLocation({
          city: cityValue,
          state: stateValue,
          country: countryValue,
        }),
        city: cityValue ? normalizeCity(cityValue) || cityValue : null,
        country: countryValue,
        department: normalizeText(getFirstPresent(record, ['Industry', 'department'])),
        employmentType: normalizeText(getFirstPresent(record, ['Job_Type', 'jobType', 'type'])),
        workplaceType: record.Remote_Job === true ? 'Remote' : null,
        experienceRequired: normalizeText(getFirstPresent(record, ['Work_Experience', 'experience'])),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        compensation: normalizeCompensation(getFirstPresent(record, ['Salary', 'salary'])),
        postingDate: normalizePostingDate(getFirstPresent(record, ['Date_Opened', 'publishDate'])),
        closingDate: null,
        openingsCount: null,
        jobDescription: stripTags(getFirstPresent(record, ['Job_Description', 'jobDescription'])),
        companyCareerPage: CAREERS_URL,
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createFciCcmScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('FCI CCM verified first-party careers page changed materially')
    }

    const boardHtml = await fetchText(BOARD_URL)
    if (!hasOfficialZohoBoardSignal(boardHtml)) {
      throw new Error('FCI CCM verified official Zoho board changed materially')
    }

    const jobs = extractJobsFromOfficialBoard(boardHtml)
    if (jobs.length === 0) {
      const meta = extractHiddenInputJson(boardHtml, 'meta')
      if (meta?._no_longer === 'zr.pos.no.act') return []
      throw new Error('FCI CCM verified Zoho board no longer exposes published public openings')
    }

    return jobs
      .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
      .map((job) => ({
        ...job,
        company: COMPANY,
        source: SOURCE,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      }))
  },
})

export const run = async (options = {}) => createFciCcmScraper().run(options)

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
