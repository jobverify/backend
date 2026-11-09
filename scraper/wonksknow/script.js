import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'wonksknow'
export const COMPANY = 'Wonksknow'
export const HOMEPAGE_URL = 'https://www.wonksknow.com/'
export const CAREERS_OVERVIEW_URL = 'https://vinterview.ai/wonksknowllc/overview'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(?:br|\/div|\/p|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'part time' || normalized === 'part-time') return 'Part-time'
  if (normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const normalizeExperience = (value) => {
  const match = normalizeWhitespace(value)?.match(/(\d+\s*-\s*\d+)\s*years?/i)
  return match ? `${match[1].replace(/\s*/g, '')} years` : null
}

const normalizeTitle = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (normalized === normalized.toUpperCase()) {
    return normalized
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .replace(/\bUsa\b/g, 'USA')
      .replace(/\bCa\b/g, 'CA')
  }

  return normalized
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Wonksknow:\s*We're a technology company solving today's problems with tomorrow's solutions\.\s*<\/title>/i.test(normalizeWhitespace(page))
    && /href=["']https:\/\/vinterview\.ai\/wonksknowllc\/overview["']/i.test(page)
    && /Visit Careers page/i.test(page)
    && /divisions of WONKSKNOW LLC/i.test(text)
    && /COPYRIGHT © 2017 - 2026, WONKSKNOW LLC\. ALL RIGHTS RESERVED\./i.test(text)
}

export const hasOfficialCareersOverviewSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /WORK WITH US/i.test(text)
    && /We are always on the lookout for talented people to join our team!/i.test(text)
    && (/Search Jobs or Keywords/i.test(text) || /placeholder=["']Search Jobs or Keywords["']/i.test(page))
    && (/Filter by city/i.test(text) || /data-placeholder=["']Filter by location["']/i.test(page))
    && /class=["'][^"']*\bjob-opening\b/i.test(page)
    && /href=["']\/wonksknowllc\/view_job_description\?job_id=[^"']+["']/i.test(page)
    && /class=["'][^"']*\bapply-here\b/i.test(page)
    && />\s*Apply here\s*</i.test(page)
}

const extractHeadquartersLocation = (homepageHtml) => {
  const footerText = stripTags(homepageHtml)
  const match = footerText.match(/Pleasanton\s+CA\s+\d{5}\s+USA/i)
  if (!match) return null

  return {
    city: 'Pleasanton',
    state: 'CA',
    country: 'USA',
    location: 'Pleasanton, CA, USA',
  }
}

export const extractListings = (html, { headquarters = null } = {}) => {
  const page = String(html ?? '')
  const blocks = [...page.matchAll(
    /<div class=["'][^"']*\bjob-opening\b[^"']*["'][^>]*>([\s\S]*?)<a href=["']([^"']*\/wonksknowllc\/view_job_description\?job_id=([^"']+))["'][^>]*class=["'][^"']*\bapply-here\b[^"']*["'][^>]*>[\s\S]*?<\/a>[\s\S]*?<\/div>\s*<\/div>/gi,
  )]

  return blocks.map((match) => {
    const blockHtml = match[1]
    const titleMatch = blockHtml.match(/class=["'][^"']*\bjob-title\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)
    const cityMatch = blockHtml.match(/class=["'][^"']*\bjob-city\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    const contractMatch = blockHtml.match(/class=["'][^"']*\bjob-contract\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    const detailPath = match[2]
    const jobId = normalizeWhitespace(match[3])

    const title = normalizeTitle(stripTags(titleMatch?.[1]))
    const city = normalizeTitle(stripTags(cityMatch?.[1]))
    const employmentType = normalizeEmploymentType(stripTags(contractMatch?.[1]))
    const sourceUrl = toAbsoluteUrl(detailPath, CAREERS_OVERVIEW_URL)

    if (!title || !city || !employmentType || !sourceUrl || !jobId) {
      return null
    }

    const applyUrl = `https://vinterview.ai/user/wonksknowllc/job_application_organization_page?job_id=${jobId}`
    const matchedHeadquarters = headquarters?.city?.toLowerCase() === city.toLowerCase()
      ? headquarters
      : null

    return {
      title,
      location: matchedHeadquarters?.location || city,
      city,
      state: matchedHeadquarters?.state || null,
      country: matchedHeadquarters?.country || null,
      employmentType,
      sourceUrl,
      applyUrl,
      jobId,
    }
  }).filter(Boolean)
}

const extractSectionText = (html, heading, nextHeading = null) => {
  const page = String(html ?? '')
  const headingPattern = new RegExp(
    `<p[^>]*>\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<\\/p>`,
    'i',
  )
  const headingMatch = headingPattern.exec(page)
  if (!headingMatch) return null

  const start = headingMatch.index + headingMatch[0].length
  const remainder = page.slice(start)
  let sectionHtml = remainder

  if (nextHeading) {
    const nextHeadingPattern = new RegExp(
      `<p[^>]*>\\s*${nextHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<\\/p>`,
      'i',
    )
    const nextMatch = nextHeadingPattern.exec(remainder)
    sectionHtml = nextMatch ? remainder.slice(0, nextMatch.index) : remainder
  }

  return normalizeWhitespace(stripTags(sectionHtml).replace(/\s*•\s*/g, ' '))
}

const extractRequirementSkills = (html) => {
  const page = String(html ?? '')
  const startMatch = page.match(/<p[^>]*>\s*JOB REQUIREMENT\s*<\/p>/i)
  if (!startMatch || startMatch.index == null) return []

  const remainder = page.slice(startMatch.index + startMatch[0].length)
  const endMatch = remainder.match(/OTHER ROLES|<\/body>/i)
  const sectionHtml = endMatch ? remainder.slice(0, endMatch.index) : remainder

  return [...sectionHtml.matchAll(/<div>([\s\S]*?)<\/div>/gi)]
    .map((match) => normalizeWhitespace(stripTags(match[1])))
    .filter(Boolean)
    .filter((item) => !/^Qualifications:?$/i.test(item))
    .map((item) => item.replace(/^[•]\s*/u, ''))
}

export const hasOfficialJobDetailSignal = (html, listing) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return new RegExp(listing.jobId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(page)
    && /APPLY FOR THIS JOB/i.test(text)
    && /JOB DESCRIPTION/i.test(text)
    && /JOB REQUIREMENT/i.test(text)
    && new RegExp(listing.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)
}

export const extractJobDetail = (html, listing) => {
  if (!hasOfficialJobDetailSignal(html, listing)) {
    throw new Error('Wonksknow official Vinterview job detail surface drifted')
  }

  const detailText = stripTags(html)
  const titleMatch = String(html ?? '').match(/class=["'][^"']*\bjob-title\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)
  const locationMatch = detailText.match(/LOCATION:\s*([A-Z\s]+)\s*CONTRACT:/i)
  const contractMatch = detailText.match(/CONTRACT:\s*([A-Z\s]+)\s*WORK FROM HOME:/i)
  const remoteMatch = detailText.match(/WORK FROM HOME:\s*(YES|NO)\s*EXPERIENCE REQUIRED:/i)
  const experienceMatch = detailText.match(/EXPERIENCE REQUIRED:\s*([0-9\-\sA-Z]+)\s*JOB DESCRIPTION/i)
  const applyMatch = String(html ?? '').match(/href=["']([^"']*job_application_organization_page\?job_id=[^"']+)["']/i)

  const locationCity = normalizeTitle(locationMatch?.[1])
  const matchedListingLocation = listing.city?.toLowerCase() === locationCity?.toLowerCase()

  return {
    ...listing,
    title: normalizeTitle(stripTags(titleMatch?.[1])) || listing.title,
    location: matchedListingLocation ? listing.location : (locationCity || listing.location),
    city: matchedListingLocation ? listing.city : (locationCity || listing.city),
    state: matchedListingLocation ? listing.state : listing.state,
    country: matchedListingLocation ? listing.country : listing.country,
    applyUrl: toAbsoluteUrl(applyMatch?.[1], CAREERS_OVERVIEW_URL) || listing.applyUrl,
    employmentType: normalizeEmploymentType(contractMatch?.[1]) || listing.employmentType,
    experienceRequired: normalizeExperience(experienceMatch?.[1]),
    remoteStatus: /YES/i.test(remoteMatch?.[1] || '') ? 'Remote' : 'On-site',
    jobDescription: extractSectionText(html, 'JOB DESCRIPTION', 'JOB REQUIREMENT'),
    minimumQualification: extractSectionText(html, 'JOB REQUIREMENT'),
    preferredQualification: null,
    requiredSkills: extractRequirementSkills(html),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createWonksknowScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Response is not the verified official Wonksknow homepage')
    }

    const overviewHtml = await fetchText(CAREERS_OVERVIEW_URL)
    if (!hasOfficialCareersOverviewSignal(overviewHtml)) {
      throw new Error('Wonksknow official careers overview no longer matches the verified listing surface')
    }

    const headquarters = extractHeadquartersLocation(homepageHtml)
    const listings = extractListings(overviewHtml, { headquarters })

    if (listings.length === 0) {
      throw new Error('Wonksknow official careers overview no longer exposes the verified listing surface')
    }

    const jobs = []
    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)
      jobs.push({
        title: detail.title,
        company: COMPANY,
        location: detail.location,
        city: detail.city,
        state: detail.state,
        country: detail.country,
        source: SOURCE,
        sourceUrl: detail.sourceUrl,
        applyUrl: detail.applyUrl,
        link: detail.applyUrl,
        companyCareerPage: CAREERS_OVERVIEW_URL,
        companyDomain: 'wonksknow.com',
        atsPlatform: 'Vinterview',
        jobId: detail.jobId,
        requisitionId: detail.jobId,
        employmentType: detail.employmentType,
        experienceRequired: detail.experienceRequired,
        remoteStatus: detail.remoteStatus,
        department: null,
        postingDate: null,
        closingDate: null,
        minimumQualification: detail.minimumQualification,
        preferredQualification: detail.preferredQualification,
        requiredSkills: detail.requiredSkills,
        jobDescription: detail.jobDescription,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createWonksknowScraper().run(options)

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
