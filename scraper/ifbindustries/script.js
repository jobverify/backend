import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ifbindustries'
export const COMPANY = 'IFB Industries'
export const CAREERS_URL = 'https://www.ifbappliances.com/career-jobs'
export const GRAPHQL_URL = 'https://edge-graph.adobe.io/api/c966e57b-84c0-4ebb-898a-6e860cf1f906/graphql'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIST_QUERY = `{
  careerList {
    items {
      is_featured
      career_id
      job_id
      job_title
      position
      location
      industry_type
      experience
      role_summary
      key_task
      job_requisites
      amasty_form_id
      created_at
      updated_at
      qualification
    }
  }
}`

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&ndash;|&#8211;|\u2013/gi, '-')
  .replace(/&mdash;|&#8212;|\u2014/gi, '-')
  .replace(/\uFFFD/g, '-')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(normalized.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return null

  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  const day = String(parsed.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const buildDescription = (item = {}) => {
  const sections = [
    ['Role Summary', stripTags(item.role_summary)],
    ['Key Tasks', stripTags(item.key_task)],
    ['Job Requisites', stripTags(item.job_requisites)],
  ]

  return sections
    .filter(([, content]) => content)
    .map(([label, content]) => `${label}: ${content}`)
    .join('\n\n') || null
}

export const buildJobDetailUrl = (jobId) =>
  `https://www.ifbappliances.com/career-jobs/career-job-detail?job_id=${encodeURIComponent(normalizeWhitespace(jobId) || '')}`

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Careers at IFB \| Explore Job Opportunities &amp; Build Your Future\s*<\/title>/i.test(rawHtml)
    && /<link rel="canonical" href="https:\/\/www\.ifbappliances\.com\/career-jobs"/i.test(rawHtml)
    && /Explore All Jobs/i.test(normalized || '')
    && /Featured Jobs/i.test(normalized || '')
    && /id="react-careers-listing-page"/i.test(rawHtml)
    && /clientlib-react-careers-listing/i.test(rawHtml)
}

const getCareerItems = (payload) => payload?.data?.careerList?.items

export const extractJobsFromPayload = (payload, { scrapedAt = new Date().toISOString() } = {}) => {
  const items = getCareerItems(payload)
  if (!Array.isArray(items)) {
    throw new Error('IFB Industries official careers API response no longer matches the verified shape')
  }

  return items
    .filter((item) => normalizeWhitespace(item?.job_id) && normalizeWhitespace(item?.job_title))
    .map((item) => {
      const jobId = normalizeWhitespace(item.job_id)
      const detailUrl = buildJobDetailUrl(jobId)
      const location = normalizeWhitespace(item.location)

      return {
        title: normalizeWhitespace(item.job_title),
        company: COMPANY,
        location,
        city: location,
        jobId,
        requisitionId: normalizeWhitespace(item.career_id),
        sourceUrl: detailUrl,
        applyUrl: detailUrl,
        department: normalizeWhitespace(item.industry_type),
        employmentType: null,
        experienceRequired: normalizeWhitespace(item.experience),
        minimumQualification: normalizeWhitespace(item.qualification),
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeDate(item.created_at),
        closingDate: null,
        jobDescription: buildDescription(item),
        source: SOURCE,
        link: detailUrl,
        scrapedAt,
      }
    })
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createIfbIndustriesScraper = ({ now = () => new Date() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('IFB Industries verified official careers page no longer matches the known public surface')
    }

    const payload = await fetchJson(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: CAREER_LIST_QUERY }),
    })

    const jobs = extractJobsFromPayload(payload, {
      scrapedAt: now().toISOString(),
    })

    if (jobs.length === 0) {
      throw new Error('IFB Industries official careers API returned no public jobs; verify whether the surface changed')
    }

    return jobs
  },
})

export const run = async (options = {}) => createIfbIndustriesScraper().run(options)

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
