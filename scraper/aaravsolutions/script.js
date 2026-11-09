import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aaravsolutions'
export const COMPANY = 'Aarav Solutions'
export const VERIFIED_AT = '2026-07-14'
export const HOMEPAGE_URL = 'https://www.aaravsolutions.com/'
export const CAREERS_URL = 'https://www.aaravsolutions.com/careers/'
export const CAREER_FORM_URL = 'https://www.aaravsolutions.com/careers/#career-form'
export const HUBSPOT_PORTAL_ID = '22580721'
export const HUBSPOT_FORM_ID = '5ddff43e-dbd5-41aa-ba85-e1060ab84790'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Aarav Solutions\s*<\/title>/i.test(page)
    && /href=["']https:\/\/www\.aaravsolutions\.com\/careers\/["']/i.test(page)
    && normalized.includes("Let's Shape the Future Together")
    && normalized.includes('Aarav Solutions')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return hasStructuredCareersSignal(page) || (/<title>\s*(?:Careers\s*-\s*)?Aarav Solutions\s*<\/title>/i.test(page)
    && normalized.includes('Careers')
    && (
      normalized.includes('You At Aarav')
      || normalized.includes('Life at Aarav Solutions')
    )
    && normalized.includes('Discover your new career with Aarav Solutions.')
    && /class=["'][^"']*job-board-wrapper[^"']*["']/i.test(page)
    && /class=["'][^"']*job-tabs[^"']*["']/i.test(page)
    && /href=["']#career-form["']/i.test(page)
    && /linkedin\.com\/company\/aarav-solutions-private-limited/i.test(page))
}

const hasStructuredCareersSignal = (page) => (
  /<title>\s*Careers\s*-\s*Aarav Solutions\s*<\/title>/i.test(page)
  && /<section\b[^>]*\bid=["']open-roles["']/i.test(page)
  && /<section\b[^>]*\bid=["']apply["']/i.test(page)
  && /<h2>\s*Current openings\s*<\/h2>/i.test(page)
  && /application\/ld\+json/i.test(page)
)

const extractStructuredIndiaRoles = (html, now) => {
  const page = String(html ?? '')
  const records = [...page.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        const parsed = JSON.parse(match[1])
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch {
        return []
      }
    })
    .filter((record) => record?.['@type'] === 'JobPosting')

  if (records.length === 0) {
    throw new Error('Aarav Solutions current careers page has no parseable structured job inventory')
  }

  return records.flatMap((record) => {
    const title = normalizeWhitespace(record.title)
    const organization = record.hiringOrganization
    const roleUrl = new URL(String(record.url || ''), CAREERS_URL)
    const roleId = roleUrl.hash.slice(1)
    const eligibleCountries = record.applicantLocationRequirements
    if (
      !title
      || organization?.name !== COMPANY
      || new URL(String(organization.sameAs || ''), CAREERS_URL).hostname !== 'www.aaravsolutions.com'
      || roleUrl.origin !== new URL(CAREERS_URL).origin
      || roleUrl.pathname !== '/careers/'
      || !/^[a-z0-9-]+$/i.test(roleId)
      || !page.includes(`id="${roleId}"`)
      || record.jobLocationType !== 'TELECOMMUTE'
      || !Array.isArray(eligibleCountries)
      || eligibleCountries.length === 0
    ) {
      throw new Error('Aarav Solutions structured job inventory changed and cannot establish complete India scope')
    }

    if (!eligibleCountries.some((country) => country?.name === 'India')) return []

    const jobId = `${SOURCE}-${roleId}`
    return [{
      jobId,
      requisitionId: jobId,
      title,
      company: COMPANY,
      department: record.occupationalCategory || null,
      location: 'Remote, India',
      city: 'Remote',
      country: 'India',
      link: roleUrl.href,
      applyUrl: roleUrl.href,
      sourceUrl: roleUrl.href,
      source: SOURCE,
      employmentType: record.employmentType === 'FULL_TIME' ? 'Full-time' : null,
      experienceRequired: null,
      jobDescription: normalizeWhitespace(String(record.description || '').replace(/<[^>]+>/g, ' ')) || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: record.datePosted || null,
      closingDate: null,
      remoteStatus: 'Remote',
      scrapedAt: now(),
    }]
  })
}

export const hasVerifiedHubSpotApplyForm = (html) => {
  const page = String(html ?? '')

  return /id=["']career-form["']/i.test(page)
    && new RegExp(`portalId:\\s*"${HUBSPOT_PORTAL_ID}"`, 'i').test(page)
    && new RegExp(`formId:\\s*"${HUBSPOT_FORM_ID}"`, 'i').test(page)
}

export const extractIndiaRoles = (html) => {
  const roles = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<div class=["'][^"']*job-item[^"']*["'][^>]*>[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<span class=["'][^"']*job-location[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/div>/gi,
  )) {
    const title = normalizeWhitespace(match[1])
    const location = normalizeWhitespace(match[2])

    if (!title || location !== 'India') continue

    const key = `${title}::${location}`
    if (seen.has(key)) continue

    seen.add(key)
    roles.push({ title, location })
  }

  if (roles.length === 0) {
    throw new Error('Aarav Solutions verified careers page no longer exposes India job cards on the trusted first-party surface')
  }

  return roles
}

export const normalizeRole = (role = {}, { now = () => new Date().toISOString() } = {}) => {
  const title = normalizeWhitespace(role.title)
  const location = normalizeWhitespace(role.location)

  if (!title || !location) {
    return null
  }

  const jobId = `${slugify(title)}-${slugify(location)}`

  return {
    jobId,
    requisitionId: jobId,
    title,
    company: COMPANY,
    department: null,
    location,
    city: null,
    country: 'India',
    link: CAREER_FORM_URL,
    applyUrl: CAREER_FORM_URL,
    sourceUrl: CAREERS_URL,
    source: SOURCE,
    employmentType: null,
    experienceRequired: null,
    jobDescription: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    scrapedAt: now(),
  }
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

export const createAaravSolutionsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Aarav Solutions verified official homepage no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Aarav Solutions verified careers page no longer matches the trusted first-party public job surface')
    }

    if (hasStructuredCareersSignal(careersPage.html)) {
      const jobs = extractStructuredIndiaRoles(careersPage.html, now)
      if (jobs.length === 0) {
        throw new Error('Aarav Solutions structured careers page has no verified India roles')
      }
      return jobs
    }

    if (!hasVerifiedHubSpotApplyForm(careersPage.html)) {
      throw new Error('Aarav Solutions shared first-party HubSpot application form no longer matches the verified careers surface')
    }

    const roles = extractIndiaRoles(careersPage.html)
    const jobs = roles
      .map((role) => normalizeRole(role, { now }))
      .filter(Boolean)

    if (jobs.length === 0) {
      throw new Error('Aarav Solutions verified careers page no longer yields normalized India roles')
    }

    return jobs
  },
})

export const run = async (options = {}) => createAaravSolutionsScraper(options).run()

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
