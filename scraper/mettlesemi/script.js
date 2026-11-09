import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mettlesemi'
export const COMPANY = 'Mettlesemi systems & technologies'
export const HOMEPAGE_URL = 'https://www.mettlesemi.com/'
export const CAREERS_URL = 'https://www.mettlesemi.com/careers/'
export const CAREERS_ALIAS_URL = 'https://www.mettlesemi.com/career'
export const SITEMAP_URL = 'https://www.mettlesemi.com/sitemap.xml'
export const JOBS_SITEMAP_URL = 'https://www.mettlesemi.com/awsm_job_openings-sitemap.xml'
export const MISSING_ROUTE_URLS = [
  'https://www.mettlesemi.com/jobs',
  'https://www.mettlesemi.com/join-us',
  'https://www.mettlesemi.com/openings',
  'https://www.mettlesemi.com/current-openings',
]

export const EXPECTED_PUBLIC_OPENINGS = [
  {
    roleId: '5141',
    title: 'SENIOR CHIP DESIGN ENGINEER',
    detailUrl: 'https://www.mettlesemi.com/jobs/senior-chip-design-engineer/',
  },
  {
    roleId: '5140',
    title: 'DFT ENGINEER',
    detailUrl: 'https://www.mettlesemi.com/jobs/dft-engineer/',
  },
  {
    roleId: '5139',
    title: 'SR. SOC DESIGN VERIFICATION ENGINEERS',
    detailUrl: 'https://www.mettlesemi.com/jobs/sr-soc-design-verification-engineers/',
  },
  {
    roleId: '5138',
    title: 'LEAD SOC DESIGN VERIFICATION/EMULATION ENGINEERS',
    detailUrl: 'https://www.mettlesemi.com/jobs/lead-soc-design-verification-emulation-engineers/',
  },
  {
    roleId: '5137',
    title: 'VALIDATION ENGINEERS',
    detailUrl: 'https://www.mettlesemi.com/jobs/validation-engineers/',
  },
  {
    roleId: '5136',
    title: 'SIGNAL AND POWER INTEGRITY (SIPI) ENGINEER',
    detailUrl: 'https://www.mettlesemi.com/jobs/signal-and-power-integrity-sipi-engineer/',
  },
  {
    roleId: '5135',
    title: 'FPGA Design & ASIC Prototyping Engineer',
    detailUrl: 'https://www.mettlesemi.com/jobs/fpga-design-asic-prototyping-engineer/',
  },
  {
    roleId: '5134',
    title: 'EMBEDDED SOFTWARE ENGINEERS',
    detailUrl: 'https://www.mettlesemi.com/jobs/embedded-software-engineers/',
  },
  {
    roleId: '5132',
    title: 'Validation and Embedded Engineers',
    detailUrl: 'https://www.mettlesemi.com/jobs/validation-and-embedded-engineers/',
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

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

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
  const match = decodeHtmlEntities(haystack).match(/(\d+\s*(?:\+\s*)?(?:-\s*\d+\s*)?\s*years?)/i)
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

const toLocationData = (cityText) => {
  const city = titleCase(cityText)

  if (!city) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  return {
    location: `${city}, India`,
    city,
    country: 'India',
  }
}

const hasVerifiedCurrentRoleCards = (cards) => {
  const roleIds = new Set()
  const detailUrls = new Set()

  return cards.length > 0 && cards.every(({ roleId, title, detailUrl }) => {
    const parsedUrl = new URL(detailUrl)
    const isVerified = /^\d+$/.test(roleId)
      && title.length > 2
      && parsedUrl.origin === new URL(HOMEPAGE_URL).origin
      && /^\/jobs\/[^/]+\/$/.test(parsedUrl.pathname)
      && !roleIds.has(roleId)
      && !detailUrls.has(detailUrl)

    roleIds.add(roleId)
    detailUrls.add(detailUrl)
    return isVerified
  })
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page)

  return /<title>\s*Mettlesemi Home - Mettlesemi\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.mettlesemi\.com\/["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Mettlesemi["']/i.test(page)
    && text.includes('productize your ideas')
    && /href=["']https:\/\/www\.mettlesemi\.com\/careers\/["']/i.test(page)
    && text.includes('mettlesemi systems and technologies private limited')
    && /mailto:info@mettlesemi\.com/i.test(page)
}

export const hasVerifiedSitemapSignal = (xml) => {
  const sitemap = String(xml ?? '')

  return /<loc>https:\/\/www\.mettlesemi\.com\/page-sitemap\.xml<\/loc>/i.test(sitemap)
    && /<loc>https:\/\/www\.mettlesemi\.com\/awsm_job_openings-sitemap\.xml<\/loc>/i.test(sitemap)
}

export const hasVerifiedJobsSitemapSignal = (xml) => {
  const sitemap = String(xml ?? '')

  return EXPECTED_PUBLIC_OPENINGS.every((opening) => sitemap.includes(`<loc>${opening.detailUrl}</loc>`))
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page)

  return /<title>\s*Careers - Mettlesemi\s*<\/title>/i.test(page)
    && text.includes('empowering talent. building the future of electronics.')
    && text.includes('explore opportunities to learn, lead, and make a difference.')
    && /action=["']https:\/\/www\.mettlesemi\.com\/wp-admin\/admin-ajax\.php["']/i.test(page)
    && /name=["']action["'][^>]+value=["']jobfilter["']/i.test(page)
    && /class=["'][^"']*awsm-job-listings awsm-row awsm-grid-col-2[^"']*["']/i.test(page)
    && text.includes('mettlesemi systems and technologies private limited')
    && /mailto:info@mettlesemi\.com/i.test(page)
}

export const isVerifiedCareersAlias = ({ status, url, html }) =>
  status === 200
  && normalizeUrl(url) === CAREERS_URL
  && hasOfficialCareersSignal(html)

export const isVerifiedMissingRoute = ({ status, html }) => {
  const page = String(html ?? '')
  const text = normalizeVisibleText(page)

  return status === 404
    && /<title>\s*Page not found - Mettlesemi\s*<\/title>/i.test(page)
    && text.includes('page not found')
    && !/awsm-job-listings/i.test(page)
  }

export const extractCurrentRoleCards = (html) => [...String(html ?? '').matchAll(
  /<div\b[^>]*class=["'][^"']*awsm-job-listing-item[^"']*["'][^>]*id=["']awsm-grid-item-(\d+)["'][^>]*>([\s\S]*?)<\/div>\s*<\/a>\s*<\/div>/gi,
)]
  .map((match) => {
    const roleId = normalizeWhitespace(match[1])
    const block = match[2]
    const title = normalizeWhitespace(
      block.match(/<h2\b[^>]*class=["'][^"']*awsm-job-post-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1],
    )
    const detailUrl = normalizeWhitespace(
      block.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*awsm-job-item[^"']*["']/i)?.[1],
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
  const normalizedDetailUrl = normalizeUrl(detailUrl)
  const visibleTitle = normalizeWhitespace(
    page.match(/<h1\b[^>]*class=["'][^"']*awsm-jobs-single-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1],
  )

  if (!visibleTitle || visibleTitle !== normalizeWhitespace(title)) {
    throw new Error(`Mettlesemi detail page no longer matches the verified public opening for "${title}"`)
  }

  if (!page.includes('Apply for this position')
    || !/id=["']awsm-applicant-name["']/i.test(page)
    || !/id=["']awsm-applicant-email["']/i.test(page)
    || !/id=["']awsm-applicant-phone["']/i.test(page)
    || !/Upload CV\/Resume/i.test(page)) {
    throw new Error(`Mettlesemi detail page no longer exposes the verified inline apply form for "${title}"`)
  }

  const categories = extractSpecificationTerms(page, 'job-category')
  const employmentType = extractSpecificationTerms(page, 'job-type').join(', ') || null
  const locationTerm = extractSpecificationTerms(page, 'job-location').at(-1) || null
  const locationData = toLocationData(locationTerm)
  const descriptionHtml = extractDescriptionHtml(page)

  if (!descriptionHtml || !locationData.location || !categories.length) {
    throw new Error(`Mettlesemi detail page no longer exposes verified metadata for "${title}"`)
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
    applyUrl: normalizedDetailUrl,
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

export const createMettlesemiScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Mettlesemi official homepage no longer matches the verified first-party surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasVerifiedSitemapSignal(sitemap.html)) {
      throw new Error('Mettlesemi sitemap no longer advertises the verified first-party careers surface')
    }

    const jobsSitemap = await fetchPage(JOBS_SITEMAP_URL)
    if (jobsSitemap.status !== 200 || !hasVerifiedJobsSitemapSignal(jobsSitemap.html)) {
      throw new Error('Mettlesemi jobs sitemap no longer contains the verified public opening detail pages')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Mettlesemi careers page no longer matches the verified first-party jobs surface')
    }

    const careersAlias = await fetchPage(CAREERS_ALIAS_URL)
    if (!isVerifiedCareersAlias(careersAlias)) {
      throw new Error('Mettlesemi careers alias no longer resolves to the verified first-party careers page')
    }

    const cards = extractCurrentRoleCards(careersPage.html)
    if (!hasVerifiedCurrentRoleCards(cards)) {
      throw new Error('Mettlesemi current public openings changed materially')
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)

      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error(`Mettlesemi missing-route validation failed for ${missingRouteUrl}`)
      }
    }

    const scrapedAt = (overrideNow || now)()
    const jobs = []

    for (const card of cards) {
      const detailPage = await fetchPage(card.detailUrl)
      if (detailPage.status !== 200) {
        throw new Error(`Mettlesemi detail page failed to load for "${card.title}"`)
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
        companyDomain: 'mettlesemi.com',
        atsPlatform: 'official-company-careers',
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createMettlesemiScraper().run(options)

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
