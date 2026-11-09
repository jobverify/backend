import path from 'node:path'
import { parseBoundedProgram, parseRemoteLiteral } from '../../scraper-support/utils/remoteScriptData.js'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { AVANTEL_CATALOG, VERIFIED_ROLE_TITLES } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AVANTEL_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_DESCRIPTION_ROUTE_URL = PROVIDER_METADATA.jobDescriptionRouteUrl
export const BUNDLE_URL = PROVIDER_METADATA.bundleUrl
export { VERIFIED_ROLE_TITLES }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const DNS_ERROR_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ERR_NAME_NOT_RESOLVED'])

const VERIFIED_JOB_TOPOLOGY = [
  {
    id: 1,
    role: 'Embedded Senior Engineer',
    location: 'Vishakhapatnam / Hyderabad',
    city: 'Hyderabad/Vishakhapatnam',
  },
  {
    id: 2,
    role: 'Design Engineer - Parabolic & Earth Station Antennas',
    location: 'Vishakhapatnam / Hyderabad',
    city: 'Hyderabad/Vishakhapatnam',
  },
  {
    id: 3,
    role: 'PCB Designer Engineer',
    location: 'Hyderabad',
    city: 'Hyderabad',
  },
  {
    id: 4,
    role: 'Quality Management System',
    location: 'E-City, Tukkuguda, Hyderabad',
    city: 'Hyderabad',
  },
  {
    id: 5,
    role: 'RF Manager / Senior Manager',
    location: 'Vishakhapatnam',
    city: 'Vishakhapatnam',
  },
  {
    id: 6,
    role: 'Project Manager',
    location: 'Hyderabad (Tukkuguda) - Near E-City (FAB CITY)',
    city: 'Hyderabad',
  },
  {
    id: 7,
    role: 'Senior Manager / DGM - Quality',
    location: 'Hyderabad (Tukkuguda) - Near E-City (FAB CITY)',
    city: 'Hyderabad',
  },
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&#8220;|&#8221;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    return new URL(String(value ?? '')).href.replace(/\/+$/, '')
  } catch {
    return String(value ?? '').replace(/\/+$/, '')
  }
}

const sameUrl = (left, right) => normalizeUrl(left) === normalizeUrl(right)

const isDnsResolutionError = (error) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    const code = typeof current.code === 'string' ? current.code : ''
    const message = String(current.message ?? '')

    if (
      DNS_ERROR_CODES.has(code)
      || /\b(?:ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED|getaddrinfo ENOTFOUND)\b/i.test(message)
    ) {
      return true
    }

    current = current.cause
  }

  return false
}

const buildDiscoveryOnlyEvidence = (now) =>
  attachInventoryEvidence([], {
    status: 'discovery-only',
    surface: HOMEPAGE_URL,
    firstParty: true,
    listingComplete: false,
    pagesFetched: 0,
    reportedTotal: null,
    indiaFacetCount: null,
    verifiedAt: now(),
    reason: 'Avantel official homepage hostname cannot be resolved; embedded careers inventory cannot be verified.',
  })

const isOfficialMainBundleUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.origin === new URL(HOMEPAGE_URL).origin
      && /^\/static\/js\/main\.[a-z0-9]+\.js$/i.test(url.pathname)
  } catch {
    return false
  }
}

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const toTextArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          return normalizeWhitespace(item.point ?? item.text ?? item.value ?? '')
        }

        return normalizeWhitespace(item)
      })
      .filter(Boolean)
  }

  const normalized = normalizeWhitespace(value)
  return normalized ? [normalized] : []
}

const buildSection = (label, value) => {
  const text = toTextArray(value).join(' ')
  return text ? `${label}: ${text}` : null
}

const extractPrimaryCity = (record = {}) => {
  const city = normalizeWhitespace(record.city)
  if (city) {
    return city.split('/')[0].trim() || null
  }

  const location = normalizeWhitespace(record.location)
  if (!location) return null
  return location.split(/[,/|-]/)[0].trim() || null
}

const normalizeLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null
  return /,\s*india$/i.test(location) ? location : `${location}, India`
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const buildStableListingId = (listing, duplicateIdCounts) => {
  const baseId = normalizeWhitespace(listing.id)
  if (!baseId) return slugify(listing.role) || 'job'

  if ((duplicateIdCounts.get(baseId) ?? 0) <= 1) {
    return baseId
  }

  const roleSlug = slugify(listing.role)
  return roleSlug ? `${baseId}-${roleSlug}` : baseId
}

const extractArrayLiteral = (bundle = '', marker = 'jobListings:') => {
  const rawBundle = String(bundle ?? '')
  const markerIndex = rawBundle.indexOf(marker)
  if (markerIndex === -1) return null

  const startIndex = rawBundle.indexOf('[', markerIndex)
  if (startIndex === -1) return null

  let depth = 0
  let quote = null
  let escaped = false

  for (let index = startIndex; index < rawBundle.length; index += 1) {
    const character = rawBundle[index]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }

    if (character === '[') {
      depth += 1
      continue
    }

    if (character === ']') {
      depth -= 1
      if (depth === 0) {
        return rawBundle.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

const buildJobDescription = (record = {}) => {
  const parts = [
    buildSection('Role Summary', record.jobdesc),
    buildSection('Company Profile', record.companyprofile),
    buildSection('Qualification', record.qualification),
    buildSection('Skills', record.skills),
    buildSection('Responsibilities', record.responsibilities),
    buildSection('Preferable', record.preferable),
    buildSection('Industry', record.industry),
    buildSection('Relevant Industry', record.relevantindustry),
    buildSection('Experience', record.experience),
    buildSection('Compensation', record.compensation),
    buildSection('Joining', record.joining),
    buildSection('Interview Process', record.interviewprocess),
    buildSection('Contact', record.contact),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' ') : null
}

const hasExactMetaDescriptionSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  return /Avantel offers innovative, customized network centric solutions/i.test(rawHtml)
    && /Aerospace and Defence Electronics/i.test(rawHtml)
}

export const hasOfficialShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<title[^>]*>\s*Avantel\s*<\/title>/i.test(rawHtml)
    && extractMainBundleUrl(rawHtml, HOMEPAGE_URL) !== null
    && hasExactMetaDescriptionSignal(rawHtml)
}

export const extractMainBundleUrl = (html = '', baseUrl = HOMEPAGE_URL) => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*\/static\/js\/main\.[^"']+\.js)["'][^>]*><\/script>/i,
  )

  if (!match?.[1]) return null
  return toAbsoluteUrl(match[1], baseUrl)
}

export const hasCareersBundleSignal = (bundle = '') => {
  const rawBundle = String(bundle ?? '')

  return rawBundle.includes('href:"careers",children:"Careers"')
    && rawBundle.includes("We're hiring")
    && rawBundle.includes('Open Positions')
    && rawBundle.includes('Search by job role')
    && rawBundle.includes('Select Department')
    && rawBundle.includes('City, State, or country/region')
    && rawBundle.includes('filteredJobListing.map')
    && rawBundle.includes('pathname:"/jobdescription"')
    && rawBundle.includes('/resume')
}

export const extractEmbeddedJobListings = (bundle = '') => {
  const arrayLiteral = extractArrayLiteral(bundle)
  if (!arrayLiteral) return []

  let parsed
  try {
    const wrapped = `(${arrayLiteral})`
    const expression = parseBoundedProgram(wrapped).body[0]?.expression
    if (expression?.type !== 'ArrayExpression') return []
    // The native renderer uses Array.map: sparse slots do not render roles.
    // Parse every present entry with the strict literal reader; never execute
    // the application or relax the shared remote JavaScript grammar.
    parsed = expression.elements.filter(Boolean).map(node => parseRemoteLiteral(wrapped.slice(node.start, node.end)))
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  return Array.from(
    parsed.filter((item) => item && typeof item === 'object'),
    (item) => ({
      ...item,
      role: normalizeWhitespace(item.role),
      location: normalizeWhitespace(item.location),
      city: normalizeWhitespace(item.city),
      type: normalizeWhitespace(item.type),
      qualification: normalizeWhitespace(item.qualification),
      industry: normalizeWhitespace(item.industry),
      relevantindustry: normalizeWhitespace(item.relevantindustry),
      experience: normalizeWhitespace(item.experience),
      compensation: normalizeWhitespace(item.compensation),
      joining: normalizeWhitespace(item.joining),
      interviewprocess: normalizeWhitespace(item.interviewprocess),
      contact: normalizeWhitespace(item.contact),
      companyprofile: normalizeWhitespace(item.companyprofile),
      jobdesc: normalizeWhitespace(item.jobdesc),
      skills: toTextArray(item.skills),
      responsibilities: toTextArray(item.responsibilities),
      preferable: toTextArray(item.preferable),
    }),
  )
}

const hasVerifiedJobTopology = (listings = []) =>
  JSON.stringify(
    listings.map((job) => ({
      id: job.id,
      role: job.role,
      location: job.location,
      city: job.city,
    })),
  ) === JSON.stringify(VERIFIED_JOB_TOPOLOGY)

const mapListingToJob = (listing, stableId, now) => ({
  title: listing.role,
  company: COMPANY,
  department: null,
  location: normalizeLocation(listing.location),
  city: extractPrimaryCity(listing),
  country: 'India',
  jobId: stableId,
  requisitionId: stableId,
  sourceUrl: CAREERS_URL,
  applyUrl: CAREERS_URL,
  employmentType: listing.type || null,
  experienceRequired: listing.experience || null,
  minimumQualification: listing.qualification || null,
  preferredQualification: listing.preferable.length > 0 ? listing.preferable.join(' ') : null,
  requiredSkills: [...listing.skills],
  postingDate: null,
  closingDate: null,
  jobDescription: buildJobDescription(listing),
  source: SOURCE,
  link: CAREERS_URL,
  scrapedAt: now(),
})

const hasUsableListings = (listings = []) =>
  listings.length > 0
  && listings.every((listing) =>
    normalizeWhitespace(listing.role)
    && normalizeWhitespace(listing.location)
    && (normalizeWhitespace(listing.id) || normalizeWhitespace(listing.role)),
  )

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

export const createAvantelScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    try {
      const homepage = await fetchPage(HOMEPAGE_URL)
      if (
        Number(homepage.status) !== 200
        || !sameUrl(homepage.url, HOMEPAGE_URL)
        || !hasOfficialShellSignal(homepage.html)
      ) {
        throw new Error('Avantel verified homepage no longer matches the public surface')
      }

      const careersPage = await fetchPage(CAREERS_URL)
      if (
        Number(careersPage.status) !== 200
        || !sameUrl(careersPage.url, CAREERS_URL)
        || !hasOfficialShellSignal(careersPage.html)
      ) {
        throw new Error('Avantel verified careers shell no longer matches the public surface')
      }

      const homepageBundleUrl = extractMainBundleUrl(homepage.html, HOMEPAGE_URL)
      const careersBundleUrl = extractMainBundleUrl(careersPage.html, CAREERS_URL)
      if (
        !isOfficialMainBundleUrl(homepageBundleUrl)
        || !isOfficialMainBundleUrl(careersBundleUrl)
        || homepageBundleUrl !== careersBundleUrl
      ) {
        throw new Error('Avantel verified bundle URL changed materially')
      }

      const bundlePage = await fetchPage(careersBundleUrl)
      if (
        Number(bundlePage.status) !== 200
        || !sameUrl(bundlePage.url, careersBundleUrl)
        || !hasCareersBundleSignal(bundlePage.html)
      ) {
        throw new Error('Avantel verified careers bundle no longer matches the public surface')
      }

      const listings = extractEmbeddedJobListings(bundlePage.html)
      if (!hasUsableListings(listings)) {
        throw new Error('Avantel embedded jobListings array changed materially')
      }

      const duplicateIdCounts = new Map()
      for (const listing of listings) {
        const baseId = normalizeWhitespace(listing.id)
        if (!baseId) continue
        duplicateIdCounts.set(baseId, (duplicateIdCounts.get(baseId) ?? 0) + 1)
      }

      const jobs = listings.map((listing) =>
        mapListingToJob(listing, buildStableListingId(listing, duplicateIdCounts), now))
      return attachInventoryEvidence(jobs, { status: 'complete-inventory', surface: careersBundleUrl,
        firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: listings.length,
        indiaFacetCount: jobs.length, verifiedAt: now(), reason: 'complete-native-role-array-used-by-the-first-party-renderer' })
    } catch (error) {
      if (isDnsResolutionError(error)) return buildDiscoveryOnlyEvidence(now)
      throw error
    }
  },
})

export const run = async (options = {}) => createAvantelScraper(options).run(options)

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
