export const SOURCE = 'elanceritsolutions'
export const COMPANY = 'Elancer It Solutions'
export const HOMEPAGE_URL = 'https://elancerits.com/'
export const CAREERS_URL = 'https://elancerits.com/careers.html'
export const APPLICATION_EMAIL = 'hr@elancerits.com'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Elancer IT Solutions',
  adapter: 'script',
  modulePath: '../../scraper/elanceritsolutions/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-first-party-openings-page',
  countryFilter: 'India',
  paginationStrategy: 'single-page-accordion-list',
  extractionStrategy: 'verified-first-party-careers-page+same-page-open-positions+email-apply',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'elancerits.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://elancerits.com/careers.html was the live first-party Elancer IT Solutions careers page and that it exposed public same-page openings including Project Coordinator / Senior Team Coordinator and Business Development Executive - AI & Data Services, with resumes directed to hr@elancerits.com.',
  dryRunFile: 'elanceritsolutions/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Careers \| Elancer IT Solutions Pvt\. Ltd\s*<\/title>/i.test(page)
    && /Open Positions/i.test(page)
    && /Project Coordinator \/ Senior Team Coordinator/i.test(page)
    && /Business Development Executive/i.test(page)
    && page.includes(APPLICATION_EMAIL)
}

export const extractOpenings = (html = '') =>
  [...String(html ?? '').matchAll(
    /<span class="career-posting-title">([\s\S]*?)<\/span>[\s\S]*?<span><i class="bi bi-geo-alt"><\/i>\s*([\s\S]*?)<\/span>[\s\S]*?<span><i class="bi bi-briefcase"><\/i>\s*([\s\S]*?)<\/span>[\s\S]*?<span><i class="bi bi-clock"><\/i>\s*([\s\S]*?)<\/span>/gi,
  )]
    .map((match) => ({
      title: normalizeWhitespace(match[1]),
      location: normalizeWhitespace(match[2]),
      experienceRequired: normalizeWhitespace(match[3]),
      employmentType: normalizeWhitespace(match[4]).split(',')[0] || null,
    }))
    .filter((job) => job.title && job.location)

export const buildApplyUrl = (title) =>
  `mailto:${APPLICATION_EMAIL}?subject=${encodeURIComponent(`${title} Application`)}` 

export const run = async ({
  fetchText = async (url) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
    return response.text()
  },
  now = () => new Date().toISOString(),
} = {}) => {
  const careersHtml = await fetchText(CAREERS_URL)
  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('Elancer It Solutions verified first-party careers page changed materially')
  }

  const openings = extractOpenings(careersHtml)
  if (!openings.length) {
    throw new Error('Elancer It Solutions careers page no longer exposes trusted public openings')
  }

  return openings.map((opening) => {
    const applyUrl = buildApplyUrl(opening.title)
    return {
      title: opening.title,
      company: COMPANY,
      location: opening.location,
      country: 'India',
      experienceRequired: opening.experienceRequired,
      employmentType: opening.employmentType,
      sourceUrl: CAREERS_URL,
      applyUrl,
      link: applyUrl,
      source: SOURCE,
      scrapedAt: now(),
    }
  })
}

