import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'zeoncharging'
export const COMPANY = 'Zeon Electric Pvt Ltd'
export const LEGACY_HOMEPAGE_URL = 'https://zeonelectric.in/'
export const HOMEPAGE_URL = 'https://zeoncharging.com/'
export const ABOUT_URL = 'https://zeoncharging.com/about_us'
export const CONTACT_URL = 'https://zeoncharging.com/contact_us'
export const CAREERS_URL = 'https://zeoncharging.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (/^full[\s_-]*time$/i.test(normalized)) return 'FULL_TIME'
  if (/^part[\s_-]*time$/i.test(normalized)) return 'PART_TIME'
  if (/^contract$/i.test(normalized)) return 'CONTRACT'

  return normalized
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const inferEmploymentType = (title, description = null, explicitValue = null) => {
  const normalizedExplicitValue = normalizeWhitespace(explicitValue)
  if (normalizedExplicitValue) return normalizedExplicitValue

  if (/\binternship\b/i.test(String(title ?? ''))) return 'Internship'

  const normalizedDescription = normalizeWhitespace(description) || ''
  const employmentTypePatterns = [
    ['Full-time', /\bfull[\s-]?time\b/i],
    ['Part-time', /\bpart[\s-]?time\b/i],
    ['Contract', /\bcontract\b/i],
  ]

  for (const [employmentType, pattern] of employmentTypePatterns) {
    if (pattern.test(normalizedDescription)) return employmentType
  }

  return null
}

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(value)
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/'
    return `${url.origin}${normalizedPath}`.toLowerCase()
  } catch {
    return null
  }
}

const extractQueryParam = (value, parameterName) => {
  try {
    return new URL(String(value ?? '')).searchParams.get(parameterName)
  } catch {
    return null
  }
}

const extractJsonLdPayloads = (html = '') => Array.from(
  String(html ?? '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
)
  .flatMap(([, rawPayload]) => {
    try {
      const parsed = JSON.parse(rawPayload)
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      return []
    }
  })

const toIndiaLocation = ({ city, state, country } = {}) => {
  const normalizedCountry = normalizeWhitespace(country)
  const countryLabel = normalizedCountry === 'IN' ? 'India' : normalizedCountry
  const parts = [
    normalizeWhitespace(city),
    normalizeWhitespace(state),
    countryLabel,
  ].filter(Boolean)

  return {
    city: normalizeWhitespace(city),
    state: normalizeWhitespace(state),
    country: countryLabel || null,
    location: parts.join(', ') || null,
  }
}

const mergeJobCards = (existing = {}, candidate = {}) => Object.fromEntries(
  [...new Set([
    ...Object.keys(existing),
    ...Object.keys(candidate),
  ])].map((key) => [
    key,
    candidate[key] ?? existing[key] ?? null,
  ]),
)

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

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Zeon Charging(?:\s+[—-]\s+EV Charging Solutions)?\s*<\/title>/i.test(page)
    && /\bOur Charging Network\b/i.test(normalized)
    && /\bFind Nearest Station\b/i.test(normalized)
    && /\bLocations\b/i.test(normalized)
    && /\bBusiness\b/i.test(normalized)
}

export const hasOfficialAboutSignal = (html) =>
  /Zeon Electric Pvt Ltd/i.test(String(html ?? ''))

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  return /care@zeoncharging\.com/i.test(page)
    && /Tiruppur/i.test(page)
    && /Tamil Nadu/i.test(page)
}

const extractLegacyJobCards = (html) =>
  String(html ?? '')
    .split(/<div class="card\s*">/i)
    .slice(1)
    .map((cardHtml) => {
      const location = normalizeWhitespace(
        cardHtml.match(/<div class="col-xs-6 pad_lr">([\s\S]*?)<\/div>/i)?.[1],
      )
      const experienceRequired = normalizeWhitespace(
        cardHtml.match(/<div class="experience col-xs-6">([\s\S]*?)<\/div>/i)?.[1],
      )
      const roleId = normalizeWhitespace(cardHtml.match(/<h3 id="job_title_(\d+)"/i)?.[1])
      const title = normalizeWhitespace(
        cardHtml.match(/<h3 id="job_title_\d+"[^>]*>([\s\S]*?)<\/h3>/i)?.[1],
      )
      const department = normalizeWhitespace(cardHtml.match(/<h6>([\s\S]*?)<\/h6>/i)?.[1])
      const jobDescription = normalizeWhitespace(
        cardHtml.match(/<p>([\s\S]*?)<a href="JavaScript:show_job_role/i)?.[1],
      )
      const detailHtml = roleId
        ? String(cardHtml.match(new RegExp(`<div id="job_role_${roleId}" class="hide">([\\s\\S]*?)<\\/div>`, 'i'))?.[1] ?? '')
        : ''
      const titleSlug = slugify(title)
      const employmentType = inferEmploymentType(
        title,
        jobDescription,
        detailHtml.match(/<h3>\s*Job Type\s*<\/h3>\s*<p>([\s\S]*?)<\/p>/i)?.[1],
      )

      if (!location || !roleId || !title || !department || !jobDescription || !titleSlug) return null

      const jobId = `${SOURCE}-${roleId}`
      const jobUrl = `${CAREERS_URL}#job-${roleId}`

      return {
        title,
        company: COMPANY,
        department,
        location: `${location}, India`,
        city: location,
        state: null,
        country: 'India',
        jobId,
        requisitionId: roleId,
        sourceUrl: jobUrl,
        applyUrl: jobUrl,
        employmentType,
        experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription,
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)

const extractArticleJobCards = (html) =>
  Array.from(String(html ?? '').matchAll(/<article\b[\s\S]*?<\/article>/gi))
    .map(([articleHtml]) => {
      const title = normalizeWhitespace(
        articleHtml.match(/<(?:h3|h4|h5)[^>]*>([\s\S]*?)<\/(?:h3|h4|h5)>/i)?.[1],
      )
      const department = normalizeWhitespace(articleHtml.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i)?.[1])
      const applyUrl = normalizeWhitespace(articleHtml.match(/href="([^"]*apply_job[^"]*)"/i)?.[1])
      const roleId = normalizeWhitespace(applyUrl?.match(/[?&]job_id=(\d+)/i)?.[1])
      const articleDivValues = Array.from(articleHtml.matchAll(/<div[^>]*>([^<]+)<\/div>/gi))
        .map(([, value]) => normalizeWhitespace(value))
        .filter(Boolean)
      const location = articleDivValues[0] || null
      const experienceRequired = articleDivValues[1] || null
      const jobDescription = normalizeWhitespace(
        articleHtml.match(/<h6[^>]*>[\s\S]*?<\/h6>\s*<div[^>]*>([\s\S]*?)<details\b/i)?.[1],
      ) || normalizeWhitespace(
        articleHtml.match(/<h6[^>]*>[\s\S]*?<\/h6>\s*<div[^>]*>([\s\S]*?)<\/div>/i)?.[1],
      )
      const employmentType = inferEmploymentType(title, jobDescription)

      if (!location || !roleId || !title || !department || !jobDescription || !applyUrl) return null

      return {
        title,
        company: COMPANY,
        department,
        location: `${location}, India`,
        city: location,
        state: null,
        country: 'India',
        jobId: `${SOURCE}-${roleId}`,
        requisitionId: roleId,
        sourceUrl: applyUrl,
        applyUrl,
        employmentType,
        experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription,
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)

const extractJsonLdJobCards = (html) => extractJsonLdPayloads(html)
  .filter((payload) => String(payload?.['@type'] ?? '').toLowerCase() === 'jobposting')
  .map((payload) => {
    const applyUrl = normalizeWhitespace(payload?.url)
    const requisitionId = normalizeWhitespace(
      payload?.identifier?.value
      || extractQueryParam(applyUrl, 'job_id'),
    )
    const { city, state, country, location } = toIndiaLocation({
      city: payload?.jobLocation?.address?.addressLocality,
      state: payload?.jobLocation?.address?.addressRegion,
      country: payload?.jobLocation?.address?.addressCountry,
    })
    const title = normalizeWhitespace(payload?.title)
    const jobDescription = normalizeWhitespace(payload?.description)

    if (!title || !requisitionId || !applyUrl || !location) {
      return null
    }

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      state,
      country,
      jobId: `${SOURCE}-${requisitionId}`,
      requisitionId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: normalizeEmploymentType(payload?.employmentType) || inferEmploymentType(title, jobDescription),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(payload?.datePosted),
      closingDate: normalizeWhitespace(payload?.validThrough),
      jobDescription,
      remoteStatus: 'On-site',
    }
  })
  .filter(Boolean)

export const extractJobCards = (html) => {
  const dedupedJobs = new Map()

  for (const job of [
    ...extractLegacyJobCards(html),
    ...extractArticleJobCards(html),
    ...extractJsonLdJobCards(html),
  ]) {
    const existing = dedupedJobs.get(job.jobId)
    dedupedJobs.set(job.jobId, existing ? mergeJobCards(existing, job) : job)
  }

  return [...dedupedJobs.values()]
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /Join Us/i.test(page)
    && /Open Positions/i.test(page)
    && extractJobCards(page).length > 0
}

export const createZeonChargingScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    extractRenderedJobs = null,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepage = await fetchPage(LEGACY_HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || normalizeComparableUrl(homepage.url) !== normalizeComparableUrl(HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Response is not the verified official homepage for Zeon Charging')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialAboutSignal(aboutPage.html)) {
      throw new Error('Response is not the verified legal-name about page for Zeon Charging')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Response is not the verified official contact page for Zeon Charging')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200) {
      throw new Error('Response is not the verified official careers page for Zeon Charging')
    }

    let jobs = hasOfficialCareersSignal(careersPage.html) ? extractJobCards(careersPage.html) : []
    if (
      jobs.length === 0
      && typeof extractRenderedJobs === 'function'
    ) {
      jobs = await extractRenderedJobs({ careersPage, careersUrl: CAREERS_URL })
    }
    if (jobs.length === 0) {
      throw new Error('Zeon Charging API-only scraper could not find jobs in the official careers response')
    }

    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createZeonChargingScraper().run(options)

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
