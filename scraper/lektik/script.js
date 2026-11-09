import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  fetchJsonWithRetry,
  fetchTextWithRetry,
} from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lektik'
export const COMPANY = 'Lektik'
export const HOMEPAGE_URL = 'https://www.lektik.com/'
export const CAREERS_URL = 'https://www.lektik.com/careers'
export const CAREERS_API_URL = 'https://lektik-backend.lektikprojects.com/api/graphql'

export const LIST_CAREERS_QUERY =
  'query GetCareers { careers { id jobTitle jobDescription experienceLevel workSite employmentType slug createdAt } }'

export const CAREER_DETAIL_QUERY =
  'query GetCareerBySlug($slug: String!) { career(where: { slug: $slug }) { id jobTitle jobDescription detailedJobDescription { document } niceToHave { document } experienceLevel workSite employmentType slug education preferredQualifications createdAt seoOgImage } }'

export const LIST_CAREERS_REQUEST_BODY = {
  query: LIST_CAREERS_QUERY,
}

export const buildCareerDetailRequestBody = (slug) => ({
  query: CAREER_DETAIL_QUERY,
  variables: { slug },
})

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? '')).replace(/<[^>]+>/g, ' '),
)

const LOCATION_BY_WORKSITE = {
  kochi: {
    location: 'Kochi, Kerala, India',
    city: 'Kochi',
    country: 'India',
  },
  thiruvananthapuram: {
    location: 'Thiruvananthapuram, Kerala, India',
    city: 'Thiruvananthapuram',
    country: 'India',
  },
  hollywood_fl: {
    location: 'Hollywood, FL, United States',
    city: 'Hollywood',
    country: 'United States',
  },
  remote: {
    location: 'Remote',
    city: null,
    country: null,
  },
  hybrid: {
    location: 'Hybrid',
    city: null,
    country: null,
  },
  onsite: {
    location: 'On-site',
    city: null,
    country: null,
  },
}

const EXPERIENCE_LABEL_BY_LEVEL = {
  entry: 'Entry Level (0-2 years)',
  mid: 'Mid Level (3-5 years)',
  senior: 'Senior Level (5+ years)',
  lead: 'Lead Level (7+ years)',
  manager: 'Manager Level (8+ years)',
  director: 'Director Level (10+ years)',
  executive: 'Executive Level (15+ years)',
}

const EMPLOYMENT_TYPE_BY_VALUE = {
  fulltime: 'Full-time',
  parttime: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
}

const toDetailUrl = (slug) => new URL(`/career/${slug}`, HOMEPAGE_URL).toString()

const isIndiaWorkSite = (workSite) => ['kochi', 'thiruvananthapuram'].includes(normalizeWhitespace(workSite).toLowerCase())

const toLocation = (workSite) => LOCATION_BY_WORKSITE[normalizeWhitespace(workSite).toLowerCase()] || {
  location: null,
  city: null,
  country: null,
}

const toEmploymentType = (employmentType) =>
  EMPLOYMENT_TYPE_BY_VALUE[normalizeWhitespace(employmentType).toLowerCase()] || null

const toExperienceRequired = (experienceLevel) =>
  EXPERIENCE_LABEL_BY_LEVEL[normalizeWhitespace(experienceLevel).toLowerCase()] || null

const extractRichTextParagraphs = (documentNodes) => {
  if (!Array.isArray(documentNodes)) return []

  return documentNodes
    .flatMap((node) => Array.isArray(node?.children) ? node.children : [])
    .map((child) => normalizeWhitespace(child?.text))
    .filter(Boolean)
}

const buildDescription = ({ jobDescription, niceToHaveDocument }) => {
  const parts = []
  const summary = normalizeWhitespace(jobDescription)
  const niceToHave = extractRichTextParagraphs(niceToHaveDocument)

  if (summary) {
    parts.push(summary)
  }

  if (niceToHave.length > 0) {
    parts.push(`Nice to have: ${niceToHave.join(' ')}`)
  }

  return parts.join(' ') || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Lektik\s*\|\s*Launch Faster,\s*Grow Smarter,\s*Build with Intent\s*<\/title>/i.test(page)
    && text.includes('Lektik is a venture studio that helps founders launch faster, grow smarter, and build with intent.')
    && text.includes('From Idea to Market In Weeks, Not Quarters')
    && /href=["']\/careers["'][^>]*>\s*<span[^>]*>\s*Careers\s*<\/span>/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Careers at Lektik - Join Our Venture Studio Team \|\s*Lektik\s*<\/title>/i.test(page)
    && text.includes('Stand Out – Join Our Elite Team of Innovators')
    && text.includes('Explore Exciting Career Opportunities')
    && text.includes('All Experience Levels')
    && text.includes('All Work Sites')
    && text.includes('All Employment Types')
}

export const extractCareerListings = (payload) => {
  const careers = payload?.data?.careers
  if (!Array.isArray(careers)) {
    throw new Error('Lektik public careers api no longer matches the verified payload')
  }

  return careers.map((career) => {
    const id = normalizeWhitespace(career?.id)
    const title = normalizeWhitespace(career?.jobTitle)
    const summary = normalizeWhitespace(career?.jobDescription)
    const experienceLevel = normalizeWhitespace(career?.experienceLevel).toLowerCase()
    const workSite = normalizeWhitespace(career?.workSite).toLowerCase()
    const employmentType = normalizeWhitespace(career?.employmentType).toLowerCase()
    const slug = normalizeWhitespace(career?.slug)
    const createdAt = normalizeWhitespace(career?.createdAt)

    if (!id || !title || !summary || !experienceLevel || !workSite || !employmentType || !slug || !createdAt) {
      throw new Error('Lektik public careers api no longer matches the verified payload')
    }

    return {
      id,
      title,
      summary,
      experienceLevel,
      workSite,
      employmentType,
      slug,
      createdAt,
    }
  })
}

export const extractCareerDetail = (payload, expectedSlug) => {
  const career = payload?.data?.career
  const slug = normalizeWhitespace(career?.slug)
  const title = normalizeWhitespace(career?.jobTitle)
  const summary = normalizeWhitespace(career?.jobDescription)

  if (!career || !slug || slug !== expectedSlug || !title || !summary) {
    throw new Error(`Lektik career detail contract drifted for slug ${expectedSlug}`)
  }

  return {
    title,
    summary,
    minimumQualification: normalizeWhitespace(career?.education) || null,
    preferredQualification: normalizeWhitespace(career?.preferredQualifications) || null,
    jobDescription: buildDescription({
      jobDescription: career?.jobDescription,
      niceToHaveDocument: career?.niceToHave?.document,
    }),
  }
}

export const extractPublicJobs = (careersPayload, detailPayloadBySlug = new Map()) => {
  const listings = extractCareerListings(careersPayload)
    .filter((career) => isIndiaWorkSite(career.workSite))
    .sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
      || left.title.localeCompare(right.title)
      || left.id.localeCompare(right.id),
    )

  return listings.map((listing) => {
    if (!detailPayloadBySlug.has(listing.slug)) {
      throw new Error(`Missing verified Lektik detail payload for slug ${listing.slug}`)
    }

    const detail = extractCareerDetail(detailPayloadBySlug.get(listing.slug), listing.slug)
    const location = toLocation(listing.workSite)

    if (detail.title !== listing.title || !location.location || location.country !== 'India') {
      throw new Error(`Lektik detail payload no longer matches the verified India listing for slug ${listing.slug}`)
    }

    return {
      title: listing.title,
      company: COMPANY,
      department: null,
      location: location.location,
      city: location.city,
      country: location.country,
      jobId: listing.id,
      requisitionId: listing.id,
      sourceUrl: toDetailUrl(listing.slug),
      applyUrl: toDetailUrl(listing.slug),
      employmentType: toEmploymentType(listing.employmentType),
      experienceRequired: toExperienceRequired(listing.experienceLevel),
      minimumQualification: detail.minimumQualification,
      preferredQualification: detail.preferredQualification,
      requiredSkills: [],
      postingDate: listing.createdAt,
      closingDate: null,
      jobDescription: detail.jobDescription || detail.summary,
    }
  })
}

export const createLektikScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Lektik verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Lektik verified first-party careers shell no longer matches the known public surface')
    }

    const careersPayload = await fetchJson(CAREERS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(LIST_CAREERS_REQUEST_BODY),
    })

    const listings = extractCareerListings(careersPayload)
      .filter((career) => isIndiaWorkSite(career.workSite))
      .sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
        || left.title.localeCompare(right.title)
        || left.id.localeCompare(right.id),
      )

    const detailPayloadBySlug = new Map()
    await Promise.all(listings.map(async (listing) => {
      const detailPayload = await fetchJson(CAREERS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildCareerDetailRequestBody(listing.slug)),
      })

      detailPayloadBySlug.set(listing.slug, detailPayload)
    }))

    const jobs = extractPublicJobs(careersPayload, detailPayloadBySlug)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'lektik.com',
      atsPlatform: 'official-first-party-graphql-api',
    }))
  },
})

export const run = async (options = {}) => createLektikScraper().run(options)

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
