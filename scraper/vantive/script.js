import path from 'path'
import { fileURLToPath } from 'url'

export const COMPANY_NAME = 'Vantive'
export const SOURCE = 'vantive'
export const ATS_PLATFORM = 'talentbrew-radancy'
export const BASE_URL = 'https://jobs.vantive.com'
export const INDIA_FACET_ID = '1269750'
export const CAREER_PAGE_URL = `${BASE_URL}/search-jobs?acm=ALL&alrpm=${INDIA_FACET_ID}&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D`

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const COUNTRY_CODE_TO_NAME = {
  IN: 'India',
  US: 'United States',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#43;/gi, '+')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0|\u200b|\u2011|\u2013|\u2014/g, (match) => {
      if (match === '\u200b') return ''
      return match
    })
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const htmlToText = (value) => stripTags(value)

const extractFirst = (pattern, value) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? match[1] : null
}

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, BASE_URL).toString()
  } catch {
    return null
  }
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const normalizeIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return normalized

  const [, year, month, day] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const normalizeCountry = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  const upper = normalized.toUpperCase()
  return COUNTRY_CODE_TO_NAME[upper] || normalized
}

const normalizeEmploymentType = (employmentType, workHours) => {
  const explicit = normalizeWhitespace(employmentType)?.toLowerCase()
  if (explicit === 'full time' || explicit === 'full-time') return 'Full-time'
  if (explicit === 'part time' || explicit === 'part-time') return 'Part-time'
  if (explicit === 'contract') return 'Contract'

  const numericHours = Number.parseFloat(normalizeWhitespace(workHours) || '')
  if (Number.isFinite(numericHours) && numericHours > 0) return 'Full-time'

  return null
}

const extractJsonLd = (html) => {
  const script = extractFirst(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i, html)
  if (!script) return null

  try {
    return JSON.parse(script)
  } catch {
    return null
  }
}

const extractSectionKey = (label) => {
  const normalized = normalizeWhitespace(label)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'required skills' || normalized === 'required qualifications') return 'required'
  if (normalized === 'preferred qualifications') return 'preferred'
  if (normalized === 'education' || normalized === 'experience and education') return 'education'
  return null
}

const addSectionMarkers = (html) => String(html ?? '').replace(
  /<(p|h[1-6]|strong|b)[^>]*>[\s\S]*?<\/\1>/gi,
  (block) => {
    const sectionKey = extractSectionKey(stripTags(block))
    return sectionKey ? `[[SECTION:${sectionKey}]]` : block
  },
)

const extractSectionBlock = (html, sectionKey) => extractFirst(
  new RegExp(`\\[\\[SECTION:${sectionKey}\\]\\]([\\s\\S]*?)(?=\\[\\[SECTION:|$)`, 'i'),
  addSectionMarkers(html),
)

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => htmlToText(match[1]))
  .filter(Boolean)

const extractRequiredSkills = (descriptionHtml) => extractListItems(
  extractSectionBlock(descriptionHtml, 'required'),
)

const extractQualificationSentence = (descriptionText) => {
  const match = String(descriptionText ?? '').match(
    /([^.]*(?:Bachelor'?s|Master'?s|Associate'?s|B\.Tech|B\.E\.|M\.Tech|MBA)[^.]*\.)/i,
  )
  if (!match) return null

  const sentence = normalizeWhitespace(match[1])
  const degreeStart = sentence?.match(/(?:Bachelor'?s|Master'?s|Associate'?s|B\.Tech|B\.E\.|M\.Tech|MBA).*$/i)
  return degreeStart ? normalizeWhitespace(degreeStart[0]) : sentence
}

const extractExperienceRequired = (descriptionHtml) => {
  const descriptionText = htmlToText(descriptionHtml)
  const explicitExperienceMatch = descriptionText?.match(
    /(\d+\s*(?:-\s*\d+|\+)?\s*years)(?=\s+(?:of\s+)?experience\b)/i,
  )
  if (explicitExperienceMatch) return normalizeWhitespace(explicitExperienceMatch[1])

  const rangeMatch = descriptionText?.match(/(\d+\s*-\s*\d+\s*years)(?!\s*,)/i)
  if (rangeMatch && !/\bfor\s*$/i.test(descriptionText.slice(0, rangeMatch.index || 0))) {
    return normalizeWhitespace(rangeMatch[1])
  }

  const plusMatch = descriptionText?.match(/(\d+\s*\+?\s*years)/i)
  if (plusMatch && !/\bfor\s*$/i.test(descriptionText.slice(0, plusMatch.index || 0))) {
    return normalizeWhitespace(plusMatch[1])
  }

  return null
}

const extractDepartment = (html, listing = {}) => normalizeWhitespace(
  extractFirst(/<meta name="dimension6" content="([^"]+)"/i, html),
) || normalizeWhitespace(
  extractFirst(/<meta name="gtm_tbcn_jobcategory" content="([^"]+)"/i, html),
) || listing.department || null

const extractLocation = (html, jsonLd, listing = {}) => {
  const detailLocation = normalizeWhitespace(
    extractFirst(/<dd class="job-description__desc-detail job-detail-location">([\s\S]*?)<\/dd>/i, html),
  ) || normalizeWhitespace(
    extractFirst(/<span class="job-location_icon">([\s\S]*?)<\/span>/i, html),
  ) || normalizeWhitespace(
    extractFirst(/<meta name="dimension7" content="([^"]+)"/i, html),
  )?.replace(/~/g, ', ')

  if (detailLocation) return detailLocation

  const locality = normalizeWhitespace(jsonLd?.jobLocation?.[0]?.address?.addressLocality)
  const country = normalizeCountry(jsonLd?.jobLocation?.[0]?.address?.addressCountry)
  const jsonLdLocation = [locality, country].filter(Boolean).join(', ')

  return jsonLdLocation || listing.location || null
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const normalizedPage = Math.max(1, Number(page) || 1)
  if (normalizedPage === 1) return CAREER_PAGE_URL

  const url = new URL(CAREER_PAGE_URL)
  url.searchParams.set('p', String(normalizedPage))
  return url.toString()
}

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<a class="search-results-list__job-link" href="([^"]+)" data-job-id="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<li class="search-results-list__job-info job-location">\s*([\s\S]*?)\s*<\/li>/gi,
)]
  .map((match) => {
    const sourceUrl = toAbsoluteUrl(match[1])
    const jobId = normalizeWhitespace(match[2])
    const title = normalizeWhitespace(match[3])
    const location = normalizeWhitespace(match[4])

    if (!sourceUrl || !jobId || !title || !location || !/india/i.test(location)) {
      return null
    }

    return {
      title,
      company: COMPANY_NAME,
      department: null,
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => {
  const currentPage = Number.parseInt(
    normalizeWhitespace(extractFirst(/data-current-page="(\d+)"/i, html)) || '',
    10,
  )
  const totalPages = Number.parseInt(
    normalizeWhitespace(extractFirst(/data-total-pages="(\d+)"/i, html)) || '',
    10,
  )
  const totalJobCount = Number.parseInt(
    normalizeWhitespace(extractFirst(/data-total-job-results="(\d+)"/i, html)) || '',
    10,
  )

  const safeCurrentPage = Number.isFinite(currentPage) ? currentPage : null
  const safeTotalPages = Number.isFinite(totalPages) ? totalPages : null

  return {
    hasNext: Boolean(
      /<a class="next"/i.test(String(html))
      || (safeCurrentPage && safeTotalPages && safeCurrentPage < safeTotalPages)
    ),
    currentPage: safeCurrentPage,
    totalPages: safeTotalPages,
    totalJobCount: Number.isFinite(totalJobCount) ? totalJobCount : null,
  }
}

export const extractJobDetail = (html, listing = {}) => {
  const jsonLd = extractJsonLd(html)
  const descriptionHtml = jsonLd?.description || ''
  const descriptionText = htmlToText(descriptionHtml)
  const location = extractLocation(html, jsonLd, listing)
  const country = /india/i.test(location || '')
    ? 'India'
    : normalizeCountry(jsonLd?.jobLocation?.[0]?.address?.addressCountry) || listing.country || null

  return {
    title: normalizeWhitespace(jsonLd?.title) || listing.title || null,
    company: normalizeWhitespace(jsonLd?.hiringOrganization?.name) || COMPANY_NAME,
    department: extractDepartment(html, listing),
    location,
    city: normalizeWhitespace(jsonLd?.jobLocation?.[0]?.address?.addressLocality) || extractCity(location),
    country,
    jobId: normalizeWhitespace(
      extractFirst(/data-selector-name="jobdetails"[^>]*data-org-id="[^"]+"[^>]*data-job-id="([^"]+)"/i, html),
    ) || listing.jobId || null,
    requisitionId: normalizeWhitespace(
      extractFirst(/<meta name="job-ats-req-id" content="([^"]+)"/i, html),
    ) || normalizeWhitespace(jsonLd?.identifier) || listing.requisitionId || listing.jobId || null,
    sourceUrl: listing.sourceUrl || normalizeWhitespace(jsonLd?.url) || null,
    applyUrl: toAbsoluteUrl(
      extractFirst(/<meta name="search-job-apply-url" content="([^"]+)"/i, html),
    ) || listing.applyUrl || listing.sourceUrl || null,
    employmentType: normalizeEmploymentType(jsonLd?.employmentType, jsonLd?.workHours),
    experienceRequired: extractExperienceRequired(descriptionHtml),
    minimumQualification: extractQualificationSentence(descriptionText),
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: normalizeIsoDate(jsonLd?.datePosted) || null,
    closingDate: null,
    jobDescription: descriptionText,
  }
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

export const createVantiveScraper = ({
  maxPages = Number.POSITIVE_INFINITY,
  maxJobs = null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= maxPages; page += 1) {
      const listingHtml = await fetchText(buildSearchUrl({ page }))
      const listings = extractSearchResults(listingHtml)
      const summary = extractPaginationSummary(listingHtml)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailHtml = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: detail.company || COMPANY_NAME,
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          country: detail.country || listing.country,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: SOURCE,
          employmentType: detail.employmentType || listing.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      if (!summary.hasNext || (summary.totalPages && page >= summary.totalPages)) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createVantiveScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ${COMPANY_NAME} scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
