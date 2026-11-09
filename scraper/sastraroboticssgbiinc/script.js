import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sastraroboticssgbiinc'
export const COMPANY = 'Sastra Robotics-SGBI INC'
export const HOMEPAGE_URL = 'https://sgbi.us/'
export const CAREERS_URL = 'https://sgbi.us/career/'
export const CAREERS_ARCHIVE_URL = 'https://sgbi.us/careers/'
export const SITEMAP_INDEX_URL = 'https://sgbi.us/sitemap_index.xml'
export const JOBS_SITEMAP_URL = 'https://sgbi.us/awsm_job_openings-sitemap.xml'

export const EXPECTED_PUBLIC_OPENINGS = [
  {
    roleId: '5639',
    title: 'FULL STACK DEVELOPER',
    detailUrl: 'https://sgbi.us/careers/full-stack-developer-2/',
  },
  {
    roleId: '5278',
    title: 'Embedded Software Engineer',
    detailUrl: 'https://sgbi.us/careers/embedded-software-engineer/',
  },
  {
    roleId: '4514',
    title: 'Technical Content Writer',
    detailUrl: 'https://sgbi.us/careers/technical-content-writer/',
  },
  {
    roleId: '4081',
    title: 'Quality Engineer',
    detailUrl: 'https://sgbi.us/careers/quality-engineer/',
  },
  {
    roleId: '3963',
    title: 'Fitter Machinist',
    detailUrl: 'https://sgbi.us/careers/job-summary/',
  },
  {
    roleId: '3863',
    title: 'Full Stack Developer',
    detailUrl: 'https://sgbi.us/careers/full-stack-developer/',
  },
  {
    roleId: '3678',
    title: 'Business Development Executive',
    detailUrl: 'https://sgbi.us/careers/inside-sales-executive/',
  },
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsToLines = (value) => decodeHtmlEntities(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<(p|div|section|article|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractTextLines = (html) => stripTagsToLines(html)
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(20000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const normalizeUrl = (value) => {
  const parsed = new URL(value, HOMEPAGE_URL)

  if (!parsed.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(parsed.pathname)) {
    parsed.pathname = `${parsed.pathname}/`
  }

  parsed.hash = ''
  return parsed.toString()
}

const normalizeVisibleText = (html) => normalizeWhitespace(extractTextLines(html).join(' '))?.toLowerCase() || ''

const extractLastMatch = (html, pattern) => {
  const globalPattern = pattern.global
    ? pattern
    : new RegExp(pattern.source, `${pattern.flags}g`)
  const matches = [...String(html ?? '').matchAll(globalPattern)]
  return matches.at(-1)?.[1] ?? null
}

const extractSpecificationTerms = (html, specType) => {
  const section = extractLastMatch(
    html,
    new RegExp(
      `<div\\b[^>]*class=["'][^"']*awsm-job-specification-${specType}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
      'i',
    ),
  )

  return [...String(section ?? '').matchAll(/<span\b[^>]*class=["'][^"']*awsm-job-specification-term[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

const extractDescriptionHtml = (html) => {
  const directMatch = String(html ?? '').match(
    /<div\b[^>]*class=["'][^"']*awsm-job-entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div><!--\s*\.awsm-job-entry-content\s*-->/i,
  )
  if (directMatch?.[1]) {
    return directMatch[1]
  }

  return extractLastMatch(
    html,
    /<div\b[^>]*class=["'][^"']*awsm-job-entry-content[^"']*["'][^>]*>([\s\S]*?)<div\b[^>]*class=["'][^"']*awsm-job-form[^"']*["']/i,
  )
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const extractExperienceRequired = (values) => {
  const haystack = Array.isArray(values) ? values.join(' ') : String(values ?? '')
  const match = decodeHtmlEntities(haystack).match(
    /(\d+(?:\.\d+)?\s*(?:\+\s*)?(?:-\s*\d+(?:\.\d+)?)?\s*years?)/i,
  )

  if (!match) {
    return null
  }

  return normalizeWhitespace(
    match[1]
      .replace(/\s*-\s*/g, '-')
      .replace(/\s*\+\s*/g, '+ ')
      .replace(/\s+/g, ' '),
  ) || null
}

const titleCase = (value) => normalizeWhitespace(value)
  ?.split(/\s+/)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(' ') || null

const toLocationData = (locationText) => {
  const normalized = titleCase(locationText)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  if (normalized.toLowerCase() === 'india') {
    return {
      location: 'India',
      city: null,
      country: 'India',
    }
  }

  return {
    location: `${normalized}, India`,
    city: normalized,
    country: 'India',
  }
}

const roleCardsMatchExpected = (cards) =>
  cards.length === EXPECTED_PUBLIC_OPENINGS.length
  && cards.every((card, index) => {
    const expected = EXPECTED_PUBLIC_OPENINGS[index]
    return expected
      && card.roleId === expected.roleId
      && card.title === expected.title
      && card.detailUrl === expected.detailUrl
  })

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page)

  return /<title>\s*Robotic Testing Solutions for Real Devices \| SGBI\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/sgbi\.us\/["']/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']SGBI delivers robotic testing solutions for real devices/i.test(page)
    && /href=["']https:\/\/sgbi\.us\/career\/["']/i.test(page)
    && (text.includes('trusted by') || text.includes('robot aided testing as a service'))
    && /"legalName":"SGBI Inc"/i.test(page)
    && /contact@sgbi\.us/i.test(page)
}

export const hasVerifiedSitemapIndexSignal = (xml) => {
  const sitemap = String(xml ?? '')

  return /<loc>https:\/\/sgbi\.us\/page-sitemap\.xml<\/loc>/i.test(sitemap)
    && /<loc>https:\/\/sgbi\.us\/awsm_job_openings-sitemap\.xml<\/loc>/i.test(sitemap)
}

export const hasVerifiedJobsSitemapSignal = (xml) => {
  const sitemap = String(xml ?? '')

  return sitemap.includes(`<loc>${CAREERS_ARCHIVE_URL}</loc>`)
    && EXPECTED_PUBLIC_OPENINGS.every((opening) => sitemap.includes(`<loc>${opening.detailUrl}</loc>`))
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page)

  return /<title>\s*Robotic Test Automation Careers \| AI Robotics Jobs at SGBI\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/sgbi\.us\/career\/["']/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']Explore robotic test automation careers at SGBI/i.test(page)
    && /awsm-jobs-style-css/i.test(page)
    && /class=["'][^"']*awsm-job-listings[^"']*["']/i.test(page)
    && text.includes('career opportunities')
    && text.includes('join our ai-powered robotics team')
    && text.includes('life at sgbi')
    && /contact@sgbi\.us/i.test(page)
  }

export const extractCurrentRoleCards = (html) => [...String(html ?? '').matchAll(
  /<div\b[^>]*class=["'][^"']*awsm-job-listing-item[^"']*["'][^>]*id=["']awsm-list-item-(\d+)["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
)]
  .map((match) => {
    const roleId = normalizeWhitespace(match[1])
    const block = match[2]
    const title = normalizeWhitespace(
      block.match(/<h2\b[^>]*class=["'][^"']*awsm-job-post-title[^"']*["'][^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i)?.[1],
    )
    const detailUrl = normalizeWhitespace(
      block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1],
    )

    if (!roleId || !title || !detailUrl) {
      return null
    }

    return {
      roleId,
      title,
      detailUrl: normalizeUrl(detailUrl),
    }
  })
  .filter(Boolean)

export const extractDetailPage = ({ title, detailUrl, html }) => {
  const page = String(html ?? '')
  const visibleTitle = normalizeWhitespace(
    page.match(/<h1\b[^>]*class=["'][^"']*awsm-jobs-single-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  )

  if (!visibleTitle || visibleTitle !== normalizeWhitespace(title)) {
    throw new Error(`Sastra Robotics-SGBI INC detail page no longer matches the verified public opening for "${title}"`)
  }

  if (!page.includes('Apply for this position')
    || !/id=["']awsm-applicant-name["']/i.test(page)
    || !/id=["']awsm-applicant-email["']/i.test(page)
    || !/id=["']awsm-applicant-phone["']/i.test(page)
    || !/Upload CV\/Resume/i.test(page)) {
    throw new Error(`Sastra Robotics-SGBI INC detail page no longer exposes the verified inline apply form for "${title}"`)
  }

  const categories = extractSpecificationTerms(page, 'job-category')
  const employmentType = extractSpecificationTerms(page, 'job-type').join(', ') || null
  const locationTerm = extractSpecificationTerms(page, 'job-location').at(-1) || null
  const locationData = toLocationData(locationTerm)
  const descriptionHtml = extractDescriptionHtml(page)

  if (!descriptionHtml || !locationData.location || !categories.length) {
    throw new Error(`Sastra Robotics-SGBI INC detail page no longer exposes verified metadata for "${title}"`)
  }

  const requiredSkills = extractListItems(descriptionHtml)
  const jobDescription = extractTextLines(descriptionHtml).join('\n')
  const experienceRequired = extractExperienceRequired(requiredSkills.length ? requiredSkills : jobDescription)

  return {
    title: visibleTitle,
    department: categories.join(', '),
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    employmentType,
    applyUrl: normalizeUrl(detailUrl),
    experienceRequired,
    requiredSkills,
    jobDescription,
  }
}

const buildJob = ({ card, detail }) => ({
  title: detail.title,
  company: COMPANY,
  department: detail.department,
  location: detail.location,
  city: detail.city,
  country: detail.country,
  jobId: `${SOURCE}-${card.roleId}`,
  requisitionId: card.roleId,
  sourceUrl: card.detailUrl,
  applyUrl: detail.applyUrl,
  employmentType: detail.employmentType,
  experienceRequired: detail.experienceRequired,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: detail.requiredSkills,
  postingDate: null,
  closingDate: null,
  jobDescription: detail.jobDescription,
  remoteStatus: 'On-site',
})

export const createSastraRoboticsSgbiIncScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Sastra Robotics-SGBI INC official homepage no longer matches the verified first-party surface')
    }

    const sitemapIndex = await fetchPage(SITEMAP_INDEX_URL)
    if (sitemapIndex.status !== 200 || !hasVerifiedSitemapIndexSignal(sitemapIndex.html)) {
      throw new Error('Sastra Robotics-SGBI INC sitemap index no longer advertises the verified jobs sitemap')
    }

    const jobsSitemap = await fetchPage(JOBS_SITEMAP_URL)
    if (jobsSitemap.status !== 200 || !hasVerifiedJobsSitemapSignal(jobsSitemap.html)) {
      throw new Error('Sastra Robotics-SGBI INC jobs sitemap no longer contains the verified public openings')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Sastra Robotics-SGBI INC careers page no longer matches the verified first-party jobs surface')
    }

    const cards = extractCurrentRoleCards(careersPage.html)
    if (!roleCardsMatchExpected(cards)) {
      throw new Error('Sastra Robotics-SGBI INC current public openings changed materially')
    }

    const scrapedAt = (overrideNow || now)()
    const jobs = []

    for (const card of cards) {
      const detailPage = await fetchPage(card.detailUrl)
      if (detailPage.status !== 200) {
        throw new Error(`Sastra Robotics-SGBI INC detail page failed to load for "${card.title}"`)
      }

      const detail = extractDetailPage({
        title: card.title,
        detailUrl: card.detailUrl,
        html: detailPage.html,
      })

      jobs.push({
        ...buildJob({ card, detail }),
        source: SOURCE,
        link: detail.applyUrl,
        scrapedAt,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'sgbi.us',
        atsPlatform: 'official-company-careers',
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createSastraRoboticsSgbiIncScraper().run(options)

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
