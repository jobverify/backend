import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'logicfruittechnologies'
export const COMPANY = 'Logic Fruit Technologies'
export const HOMEPAGE_URL = 'https://www.logic-fruit.com/'
export const CAREERS_URL = 'https://www.logic-fruit.com/career/jobs-current-opening/'
export const APPLY_URL = 'https://www.logic-fruit.com/career/application-form/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const extractTitle = (html = '') => stripTags(
  String(html ?? '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1],
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
  const normalized = stripTags(value)
  if (!normalized) return null

  const cleaned = normalized
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()

  return /\bindia\b/i.test(cleaned) ? cleaned : `${cleaned}, India`
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const [firstPart] = normalized.split('/').map((part) => part.split(',')[0]?.trim()).filter(Boolean)
  return normalizeCity(firstPart || normalized)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const title = extractTitle(page) || ''

  return /^Current Jobs Opening\s*-\s*Logic Fruit Technologies$/i.test(title)
    && /Create Your Future With Us!/i.test(text)
    && /Current Openings/i.test(text)
    && /Open Positions In Logic Fruit/i.test(text)
    && /theplus-tabs-content-wrapper/i.test(page)
    && /jobs-current-opening\//i.test(page)
}

export const extractCurrentAppBundleUrl = (html = '') => {
  const source = String(html ?? '').match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i)?.[1]
  if (!source) return null
  try {
    const url = new URL(source, HOMEPAGE_URL)
    return url.hostname === 'www.logic-fruit.com' ? url.toString() : null
  } catch {
    return null
  }
}

export const hasCurrentHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const legacyTitle = /<title>\s*Logic Fruit Technologies \| Semiconductor Systems Solutions Company\s*<\/title>/i.test(page)
  const currentTitle = /<title>\s*Logic Fruit Technologies \| Hardware, Software, AI (?:&amp;|&) Robotics for Mission-Critical Systems\s*<\/title>/i.test(page)
    && /["']@type["']\s*:\s*["']Organization["']/i.test(page)
    && page.includes('https://www.logic-fruit.com')
  return (legacyTitle || currentTitle)
    && /<div id=["']root["']><\/div>/i.test(page)
    && Boolean(extractCurrentAppBundleUrl(page))
}

export const hasVerifiedCurrentCareersBundleSignal = (bundle = '') => {
  const source = String(bundle ?? '')
  return /label:`Career`,page:`career`,href:`\/careers`/.test(source)
    && /Build your Career with Opportunities to Learn, Grow, and Make an Impact/i.test(source)
    && /drop in your resume\. We’ll get back to you in a flash!/i.test(source)
    && /href:`#`,onClick:[^,]+=>[^,]+\.preventDefault\(\),children:`CURRENT OPENING`/.test(source)
    && !/"@type"\s*:\s*"JobPosting"|boards-api\.greenhouse|jobs\.lever\.co|myworkdayjobs|darwinbox/i.test(source)
}

export const extractTabbedOpeningSections = (html = '') => {
  const page = String(html ?? '')
  const wrapperIndex = page.indexOf('theplus-tabs-content-wrapper')
  if (wrapperIndex === -1) return []

  return page
    .slice(wrapperIndex)
    .split(/<div class="elementor-tab-title elementor-tab-mobile-title[^>]*>/i)
    .slice(1)
    .map((sectionHtml) => {
      const label = stripTags(sectionHtml.match(/<span>([\s\S]*?)<\/span>/i)?.[1])
      const contentIndex = sectionHtml.indexOf('<div id="elementor-tab-content')
      if (contentIndex === -1) return null

      return {
        label,
        html: sectionHtml.slice(contentIndex),
      }
    })
    .filter(Boolean)
}

export const extractOpeningCardsFromSection = (sectionHtml = '') =>
  String(sectionHtml ?? '')
    .split(/<div\s+data-tp-sc-link=/i)
    .slice(1)
    .map((cardHtml) => {
      const sourceUrl = toAbsoluteUrl(
        cardHtml.match(
          /<h[1-6][^>]*class=["'][^"']*elementor-heading-title[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["']/i,
        )?.[1],
      )
      const title = stripTags(
        cardHtml.match(
          /<h[1-6][^>]*class=["'][^"']*elementor-heading-title[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
        )?.[1],
      )
      const location = normalizeLocation(
        cardHtml.match(
          /<span[^>]*class=["'][^"']*elementor-icon-list-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
        )?.[1],
      )

      return {
        title,
        location,
        city: deriveCity(location),
        sourceUrl,
        applyUrl: sourceUrl || APPLY_URL,
        remoteStatus: 'On-site',
      }
    })
    .filter((job) => job.title && job.location && job.sourceUrl)

const scoreOpeningSpecificity = (job = {}) => {
  const location = normalizeWhitespace(job.location) || ''

  return location.length
    + (location.includes('/') ? 100 : 0)
    + ((location.match(/,/g) || []).length * 5)
}

export const mergePreferredOpening = (existingJob, candidateJob) => {
  if (!existingJob) return candidateJob
  if (!candidateJob) return existingJob

  return scoreOpeningSpecificity(candidateJob) > scoreOpeningSpecificity(existingJob)
    ? { ...existingJob, ...candidateJob }
    : existingJob
}

export const extractOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error(
      'Logic Fruit Technologies verified official public careers surface no longer matches the expected page',
    )
  }

  const jobsBySourceUrl = new Map()

  for (const section of extractTabbedOpeningSections(html)) {
    for (const job of extractOpeningCardsFromSection(section.html)) {
      jobsBySourceUrl.set(
        job.sourceUrl,
        mergePreferredOpening(jobsBySourceUrl.get(job.sourceUrl), job),
      )
    }
  }

  const jobs = [...jobsBySourceUrl.values()]

  if (jobs.length === 0) {
    throw new Error('Logic Fruit Technologies verified public openings changed or disappeared')
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


export const CURRENT_JOBS_API_URL = 'https://api.logic-fruit.com/api/jobs'

const hasVerifiedPublicJobsApiSignal = (bundle = '') =>
  bundle.includes('https://api.logic-fruit.com/api')
  && /async getJobs\(/.test(bundle)
  && /label:`Career`,page:`career`,href:`\/careers`/.test(bundle)
  && bundle.includes('CURRENT OPENINGS')
  && bundle.includes('/career/jobs-current-opening/')

const extractCurrentApiJobs = (payload, scrapedAt) => {
  if (payload?.success !== true || !Array.isArray(payload.data) || Number(payload.count) !== payload.data.length) {
    throw new Error('Logic Fruit public jobs feed changed materially or is incomplete')
  }
  return payload.data.filter((record) => record?.status === 'published').map((record) => {
    if (record.entityType !== 'job' || !record.id || !record.slug || !record.title || !record.location) {
      throw new Error('Logic Fruit public jobs feed changed materially: invalid published job')
    }
    if (!/\b(?:India|Gurugram|Gurgaon|Bengaluru|Bangalore|Hyderabad|Noida|Chennai|Pune|Mumbai|Delhi)\b/i.test(record.location)) return null
    const sourceUrl = new URL('/jobs-current-opening/' + encodeURIComponent(record.slug) + '/', HOMEPAGE_URL).toString()
    const location = normalizeLocation(record.location)
    return {
      title: normalizeWhitespace(record.title), company: COMPANY, source: SOURCE,
      jobId: SOURCE + '-' + record.id, requisitionId: record.id,
      location, city: deriveCity(location), country: 'India',
      department: normalizeWhitespace(record.department),
      employmentType: /full[- ]?time/i.test(record.type || '') ? 'Full-time' : normalizeWhitespace(record.type),
      experienceRequired: normalizeWhitespace(record.experience),
      remoteStatus: /remote/i.test(record.workMode || '') ? 'Remote' : /hybrid/i.test(record.workMode || '') ? 'Hybrid' : 'On-site',
      minimumQualification: stripTags(record.qualifications), preferredQualification: null,
      requiredSkills: Array.isArray(record.skills) ? record.skills.filter((skill) => typeof skill === 'string') : [],
      jobDescription: [record.overview, record.description, record.responsibilities, record.qualifications].map(stripTags).filter(Boolean).join('\n') || null,
      postingDate: record.createdAt || null, closingDate: null,
      sourceUrl, applyUrl: sourceUrl, link: sourceUrl,
      companyCareerPage: HOMEPAGE_URL + 'careers', companyDomain: 'logic-fruit.com', atsPlatform: 'official-company-careers', scrapedAt,
    }
  }).filter(Boolean)
}

export const createLogicFruitTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = (url) => fetchJsonWithRetry(url, { label: SOURCE, timeoutMs: 15000 }) } = {}) {
    let html
    try {
      html = await fetchText(CAREERS_URL)
    } catch (error) {
      if (!/HTTP 404 for https:\/\/www\.logic-fruit\.com\/career\/jobs-current-opening\//i.test(String(error?.message))) {
        throw error
      }

      const homepageHtml = await fetchText(HOMEPAGE_URL)
      if (!hasCurrentHomepageSignal(homepageHtml)) {
        throw new Error('Logic Fruit Technologies current official app shell changed materially')
      }
      const bundleUrl = extractCurrentAppBundleUrl(homepageHtml)
      const bundle = await fetchText(bundleUrl)
      if (hasVerifiedPublicJobsApiSignal(bundle)) {
        return extractCurrentApiJobs(await fetchJson(CURRENT_JOBS_API_URL), now())
      }
      if (!hasVerifiedCurrentCareersBundleSignal(bundle)) {
        throw new Error('Logic Fruit Technologies current careers app changed materially or now exposes public jobs')
      }
      return []
    }
    const scrapedAt = now()

    return extractOpenings(html).map((job) => {
      const identitySlug = slugify(`${job.title}-${job.location}`)

      return {
        ...job,
        company: COMPANY,
        department: null,
        country: 'India',
        jobId: `${SOURCE}-${identitySlug}`,
        requisitionId: `${SOURCE}-${identitySlug}`,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
      }
    })
  },
})

export const run = async (options = {}) => createLogicFruitTechnologiesScraper().run(options)

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
