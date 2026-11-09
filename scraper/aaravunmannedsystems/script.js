import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aaravunmannedsystems'
export const COMPANY = 'Aarav Unmanned Systems'
export const VERIFIED_AT = '2026-07-14'
export const ABOUT_URL = 'https://aereo.io/about/'
export const CAREERS_URL = 'https://aereo.io/careers/'
export const HIRING_BOARD_URL = 'https://hire.aereonauts.aereo.io/'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  adapter: 'script',
  modulePath: '../../scraper/aaravunmannedsystems/script.js',
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-about-page-plus-careers-landing-plus-first-party-hiring-board',
  extractionStrategy:
    'verified-aereo-rebrand-about-page+verified-careers-handoff+first-party-hiring-board-inline-job-cards',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'aereo.io',
  verifiedOn: VERIFIED_AT,
  verifiedSurfaceSummary:
    'Verified https://aereo.io/about/ identifies Aereo as formerly known as Aarav Unmanned Systems, https://aereo.io/careers/ hands job seekers to the first-party hiring board at https://hire.aereonauts.aereo.io/, and that board exposes public openings with first-party company_career detail links.',
  dryRunFile: 'aaravunmannedsystems/jobs.json',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTH_INDEX = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const STATE_BY_CITY = {
  bangalore: 'Karnataka',
  bengaluru: 'Karnataka',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&bull;/gi, '*')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')

const stripTags = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<\/li>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripTags(value)
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n+/g, '\n')
  .trim()

const firstMatch = (value, patterns) => {
  for (const pattern of patterns) {
    const match = String(value ?? '').match(pattern)
    const normalized = normalizeWhitespace(match?.[1])
    if (normalized) return normalized
  }

  return null
}

const toAbsoluteUrl = (value, baseUrl = HIRING_BOARD_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeCityToken = (value) => normalizeWhitespace(value)
  ?.replace(/\bwork from office\b|\bwfo\b|\bon-site\b|\bonsite\b/gi, '')
  ?.replace(/[():-]/g, ' ')
  ?.replace(/\s*,\s*/g, ', ')
  ?.replace(/^,\s*|\s*,$/g, '')
  ?.replace(/\s+/g, ' ')
  ?.trim()
  || null

const normalizeLocation = (value) => {
  const normalized = normalizeCityToken(value)
  if (!normalized) return 'India'

  if (normalized.includes(',')) {
    const parts = normalized
      .split(',')
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean)

    if (parts.length > 1) {
      return `${parts.join(', ')}, India`
    }
  }

  const state = STATE_BY_CITY[normalized.toLowerCase()]
  if (state) {
    return `${normalized}, ${state}, India`
  }

  return `${normalized}, India`
}

const extractCity = (value) => {
  const normalized = normalizeCityToken(value)
  if (!normalized || normalized.includes(',')) return null
  return normalized
}

const normalizeEmploymentType = (title, description) => {
  const normalized = `${normalizeWhitespace(title)} ${normalizeWhitespace(description)}`.toLowerCase()

  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('full-time') || normalized.includes('full time')) return 'Full-time'
  if (normalized.includes('part-time') || normalized.includes('part time')) return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('temporary')) return 'Temporary'

  return null
}

const parsePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (!match) return null

  const day = match[1].padStart(2, '0')
  const month = MONTH_INDEX[match[2].toLowerCase()]
  const year = match[3]

  return month ? `${year}-${month}-${day}` : null
}

const extractRequisitionId = (title) => {
  const match = normalizeWhitespace(title).match(/\(([A-Z]{2}\d+)\)\s*$/i)
  return match?.[1] ?? null
}

const extractTitle = (title) => normalizeWhitespace(title).replace(/\s*\([A-Z]{2}\d+\)\s*$/i, '')

const extractRequiredSkills = (descriptionHtml) => {
  const skills = []
  const seen = new Set()

  for (const match of String(descriptionHtml ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const skill = normalizeWhitespace(match[1])
    if (skill && !seen.has(skill)) {
      seen.add(skill)
      skills.push(skill)
    }
  }

  for (const match of String(descriptionHtml ?? '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const raw = normalizeWhitespace(match[1])
    const skill = raw.replace(/^[*-]\s*/, '').trim()
    if (!raw || raw === skill || !/^[*-]\s*/.test(raw)) continue
    if (!seen.has(skill)) {
      seen.add(skill)
      skills.push(skill)
    }
  }

  return skills
}

const extractDescriptionHtml = (cardHtml) =>
  String(cardHtml ?? '').match(/<div[^>]*class="[^"]*\bJob-Description\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ''

const extractLocationText = (cardHtml, descriptionHtml) => {
  const explicitLocation = firstMatch(cardHtml, [
    /<div[^>]*class="[^"]*\bjob-location\b[^"]*"[^>]*>[\s\S]*?<\/i>\s*([\s\S]*?)<\/div>/i,
  ])
  if (explicitLocation) return explicitLocation

  const normalizedDescription = normalizeWhitespace(descriptionHtml)

  return firstMatch(normalizedDescription, [
    /Location:\s*(?:Work From Office\s*\(WFO\),\s*)?([A-Za-z][A-Za-z\s,]+)/i,
    /Location\s*:\s*([A-Za-z][A-Za-z\s,]+)/i,
  ])
}

export const hasOfficialAboutSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Aereo/i.test(normalized)
    && /Formerly known as Aarav Unmanned Systems/i.test(normalized)
    && /founded in 2013/i.test(normalized)
    && /href=["']https:\/\/aereo\.io\/careers\/["']/i.test(page)
}

export const hasOfficialCareersLandingSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Purpose Driven Careers/i.test(normalized)
    && /Challenge-Seekers/i.test(normalized)
    && /Apply for Job/i.test(normalized)
    && /href=["']https:\/\/hire\.aereonauts\.aereo\.io\/?["']/i.test(page)
}

export const hasOfficialHiringBoardSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Aereo - Current Openings/i.test(normalized)
    && /Filter Job Opportunities/i.test(normalized)
    && /id=["']listingjob["']/i.test(page)
    && /href=["'][^"']*company_career\/[^"']+["']/i.test(page)
}

export const extractHiringBoardListings = (html) => {
  const listings = []

  for (const cardMatch of String(html ?? '').matchAll(
    /<div[^>]*class="[^"]*\brecruitcard\b[^"]*"[^>]*id=["']job-(\d+)["'][^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*\brecruitcard\b[^"]*"[^>]*id=["']job-\d+["']|<\/div>\s*<\/div>\s*<\/div>\s*<\/section>|<\/div>\s*<\/body>|<\/body>)/gi,
  )) {
    const jobId = normalizeWhitespace(cardMatch[1])
    const cardHtml = cardMatch[2]
    const rawTitle = firstMatch(cardHtml, [
      /<div[^>]*class="[^"]*\bJob-title\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ])
    const descriptionHtml = extractDescriptionHtml(cardHtml)
    const description = normalizeWhitespace(descriptionHtml)
    const applyPath = firstMatch(cardHtml, [
      /<a[^>]*class="[^"]*\bapply_btn\b[^"]*"[^>]*href=["']([^"']+)["']/i,
    ])
    const locationText = extractLocationText(cardHtml, descriptionHtml)
    const postingDateText = firstMatch(cardHtml, [
      /<div[^>]*class="[^"]*\bjob-contract-type\b[^"]*"[^>]*>[\s\S]*?<\/i>\s*([\s\S]*?)<\/div>/i,
    ])

    if (!jobId || !rawTitle || !applyPath) continue

    listings.push({
      jobId,
      requisitionId: extractRequisitionId(rawTitle),
      title: extractTitle(rawTitle),
      company: COMPANY,
      department: firstMatch(cardHtml, [
        /<div[^>]*class="[^"]*\bjob-industry\b[^"]*"[^>]*>[\s\S]*?<\/i>\s*([\s\S]*?)<\/div>/i,
      ]),
      location: normalizeLocation(locationText),
      city: extractCity(locationText),
      country: 'India',
      sourceUrl: toAbsoluteUrl(applyPath),
      applyUrl: toAbsoluteUrl(applyPath),
      employmentType: normalizeEmploymentType(rawTitle, description),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: extractRequiredSkills(descriptionHtml),
      postingDate: parsePostingDate(postingDateText),
      closingDate: null,
      jobDescription: description,
    })
  }

  return listings
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createAaravUnmannedSystemsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialAboutSignal(aboutPage.html)) {
      throw new Error('Aarav Unmanned Systems verified about page no longer matches the trusted Aereo rebrand surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersLandingSignal(careersPage.html)) {
      throw new Error('Aarav Unmanned Systems verified careers landing no longer matches the trusted first-party handoff')
    }

    const hiringBoardPage = await fetchPage(HIRING_BOARD_URL)
    if (hiringBoardPage.status !== 200 || !hasOfficialHiringBoardSignal(hiringBoardPage.html)) {
      throw new Error('Aarav Unmanned Systems verified first-party hiring board no longer matches the trusted public jobs surface')
    }

    return extractHiringBoardListings(hiringBoardPage.html).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAaravUnmannedSystemsScraper(options).run()

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

