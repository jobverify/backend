import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.247.ai/jobs/'
export const AJAX_URL = 'https://www.247.ai/wp-admin/admin-ajax.php'

const INDIA_LOCATION_PATTERN = /india|bengaluru|bangalore|hyderabad|mumbai|pune|gurgaon|gurugram|noida|chennai|kolkata|coimbatore|ahmedabad|jaipur|kochi|trivandrum|mysore|mangalore|mohali|indore|navi mumbai|nagpur|bhubaneswar|vadodara|surat|visakhapatnam|vishakhapatnam|vijayawada|lucknow|chandigarh|ghaziabad|faridabad|meerut|patna|ranchi|nashik|shimla|dehradun|goa|thane|madurai|tiruchirappalli|trichy|salem|hubli|dharwad|belgaum|belagavi|siliguri|guwahati|bhopal|rajkot|jodhpur|udaipur|varanasi|ludhiana|amritsar|jalandhar|shimoga|shivamogga|nellore|guntur|warangal|tirupati|raipur|jamshedpur|Shillong/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const decodeAttribute = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"'),
)

export const buildSearchUrl = () => CAREER_PAGE_URL

export const extractPageConfig = (html) => {
  const paramsMatch = String(html ?? '').match(/data-params='([^']+)'/)
  const nonceMatch = String(html ?? '').match(/_smart_filter_object\s*=\s*(\{[\s\S]*?\})\s*(?:;|<\/script>)/)
  if (!paramsMatch || !nonceMatch) {
    return null
  }

  try {
    const params = JSON.parse(paramsMatch[1].replace(/&quot;/g, '"'))
    const noncePayload = JSON.parse(nonceMatch[1])
    const nonce = normalizeWhitespace(noncePayload?.nonce)
    const ajaxUrl = normalizeWhitespace(noncePayload?.ajax_url) || AJAX_URL

    if (!nonce) return null

    return { params, nonce, ajaxUrl }
  } catch {
    return null
  }
}

export const buildAjaxRequestBody = ({ params, nonce, paged = 1 }) => {
  const body = new URLSearchParams({
    action: 'ymc_get_posts',
    nonce_code: String(nonce ?? ''),
    params: JSON.stringify(params ?? {}),
    paged: String(paged),
  })

  return body.toString()
}

const parseExcerpt = (value) => {
  const segments = String(value ?? '')
    .split('|')
    .map((segment) => normalizeWhitespace(segment))
    .filter(Boolean)

  const location = segments[0] || null
  const secondary = segments[1] || null
  const experience = segments.find((segment) => /^experience\s*:/i.test(segment)) || null
  const remoteStatus = /hybrid/i.test(secondary)
    ? 'Hybrid'
    : /remote/i.test(secondary)
      ? 'Remote'
      : /on[- ]?site/i.test(secondary)
        ? 'On-site'
        : 'On-site'
  const employmentType = /full[- ]?time/i.test(secondary)
    ? 'Full-time'
    : /part[- ]?time/i.test(secondary)
      ? null
      : /contract/i.test(secondary)
        ? 'Contract'
        : /intern/i.test(secondary)
          ? 'Internship'
          : null

  return {
    location,
    remoteStatus,
    employmentType,
    experienceRequired: experience
      ? normalizeWhitespace(experience.replace(/^experience\s*:\s*/i, ''))
      : null,
  }
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

export const extractSearchResults = (payload = {}) => {
  const html = String(payload?.data ?? '')
  const articles = [...html.matchAll(/<article\b[\s\S]*?post-(\d+)[\s\S]*?<a class="media-link\s*"[^>]*href="([^"]+)"[\s\S]*?>([\s\S]*?)<\/a>[\s\S]*?<div class="excerpt">([\s\S]*?)<\/div>/gi)]

  return articles
    .map(([, postId, href, rawTitle, rawExcerpt]) => {
      const title = stripTags(rawTitle)
      const sourceUrl = decodeAttribute(href)
      const excerpt = stripTags(rawExcerpt)
      const { location, remoteStatus, employmentType, experienceRequired } = parseExcerpt(excerpt)

      if (!title || !postId || !sourceUrl || !location || !INDIA_LOCATION_PATTERN.test(location)) {
        return null
      }

      return {
        title,
        company: '[24]7.ai',
        department: null,
        location,
        city: extractCity(location),
        country: 'India',
        jobId: normalizeWhitespace(postId),
        requisitionId: normalizeWhitespace(postId),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType,
        experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: excerpt,
        remoteStatus,
      }
    })
    .filter(Boolean)
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'application/json,text/javascript,*/*;q=0.01',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Origin: 'https://www.247.ai',
      Referer: CAREER_PAGE_URL,
    },
    body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const create247AiScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchJson = options.fetchJson || defaultFetchJson
    const pageHtml = await fetchText(buildSearchUrl())
    const pageConfig = extractPageConfig(pageHtml)

    if (!pageConfig) {
      throw new Error('24 7.ai jobs page no longer exposes the expected smart-filter config')
    }

    const payload = await fetchJson(
      pageConfig.ajaxUrl,
      buildAjaxRequestBody({
        params: pageConfig.params,
        nonce: pageConfig.nonce,
        paged: 1,
      }),
    )

    const jobs = extractSearchResults(payload)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: '247ai',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => create247AiScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running 24 7.ai scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, '247ai')
    console.log('DB result:', result)
    process.exit(0)
  }
}
