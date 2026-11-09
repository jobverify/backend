export const SOURCE = 'wealthy'
export const COMPANY = 'Wealthy'
export const COMPANY_DOMAIN = 'wealthy.in'
export const CAREERS_URL = 'https://www.wealthy.in/careers'
export const BOARD_URL = 'https://wealthy.zohorecruit.in/jobs/Careers'
export const JOBS_RSS_URL = `${BOARD_URL}/rss`
export const CONTACT_EMAIL = 'hello@wealthy.in'
export const EMPTY_BOARD_CODE = 'zr.pos.no.act'
export const ATS_PLATFORM = 'zoho-recruit-public-board'

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

const uniqueParts = (parts) => {
  const seen = new Set()
  const output = []

  for (const value of parts) {
    const normalized = normalizeText(value)
    if (!normalized) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    output.push(normalized)
  }

  return output
}

const buildLocation = ({ city, state, country }) => {
  const parts = uniqueParts([city, state, country])
  return parts.length > 0 ? parts.join(', ') : null
}

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
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Solving an India-sized problem')
    && normalized.includes('Job Openings')
    && normalized.includes('View all jobs')
    && normalized.includes(CONTACT_EMAIL)
    && normalized.includes('Harlukunte Village Sector 2 HSR Layout, Bengaluru')
    && /rec_job_listing_div/i.test(page)
    && /embed_jobs\.js/i.test(page)
}

export const hasOfficialZohoBoardSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  const pageJson = extractHiddenInputJson(html, 'pageJson')
  const meta = extractHiddenInputJson(html, 'meta')

  return normalized.includes('Jobs at Wealthy')
    && meta?.list_url === BOARD_URL
    && meta?.page_name === 'Careers'
    && pageJson?.detail?.section?.data?.some((section) =>
      section?.blocktype === 'jobs'
      && /Join us/i.test(section?.title ?? '')
      && /Current Openings/i.test(section?.subtitle ?? ''),
    )
}

export const hasRemovedRssSignal = (xml = '') =>
  /joblist has been removed/i.test(normalizeWhitespace(xml))

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

      const city = normalizeText(getFirstPresent(record, ['City', 'city']))
      const state = normalizeText(getFirstPresent(record, ['State', 'state']))
      const country = normalizeText(getFirstPresent(record, ['Country', 'country']))
      const sourceUrl = normalizeText(getFirstPresent(record, ['applyUrl', 'sourceUrl']))
        || buildZohoDetailUrl(recordId, title)

      return {
        title,
        jobId: `${SOURCE}-${recordId}`,
        requisitionId: recordId,
        department: normalizeText(getFirstPresent(record, ['Industry', 'department'])),
        location: buildLocation({ city, state, country }),
        city,
        country,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeText(getFirstPresent(record, ['Job_Type', 'jobType', 'type'])),
        workplaceType: record.Remote_Job === true ? 'Remote' : null,
        experienceRequired: normalizeText(getFirstPresent(record, ['Work_Experience', 'experience'])),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        compensation: normalizeCompensation(getFirstPresent(record, ['Salary', 'salary'])),
        postingDate: normalizePostingDate(getFirstPresent(record, ['Date_Opened', 'publishDate'])),
        closingDate: null,
        jobDescription: stripTags(getFirstPresent(record, ['Job_Description', 'jobDescription'])),
        companyCareerPage: CAREERS_URL,
      }
    })
    .filter(Boolean)
}

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,text/xml;q=0.8,*/*;q=0.7',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createWealthyScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const careersHtml = await fetchHtml(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Wealthy careers handoff no longer matches the trusted first-party contract.')
    }

    const boardHtml = await fetchHtml(BOARD_URL)
    if (!hasOfficialZohoBoardSignal(boardHtml)) {
      throw new Error('The verified Wealthy Zoho board no longer matches the trusted public board contract.')
    }

    const jobs = extractJobsFromOfficialBoard(boardHtml)
    if (jobs.length > 0) {
      return jobs
        .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
        .map((job) => ({
          ...job,
          company: COMPANY,
          source: SOURCE,
          companyDomain: COMPANY_DOMAIN,
          atsPlatform: ATS_PLATFORM,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        }))
    }

    const boardMeta = extractHiddenInputJson(boardHtml, 'meta')
    const rssXml = await fetchHtml(JOBS_RSS_URL)

    if (boardMeta?._no_longer === EMPTY_BOARD_CODE && hasRemovedRssSignal(rssXml)) {
      return []
    }

    throw new Error('The verified Wealthy empty-board contract changed and requires manual review.')
  },
})

export const run = async (options = {}) => createWealthyScraper().run(options)
