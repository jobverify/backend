import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cosgridnetworks'
export const COMPANY = 'COSGrid Networks'
export const HOMEPAGE_URL = 'https://www.cosgrid.com/'
export const CAREERS_URL = 'https://www.cosgrid.com/company/careers'
export const OPENINGS_URL = 'https://www.cosgrid.com/company/careers/openings'
export const COMPANY_DOMAIN = 'cosgrid.com'
export const VERIFIED_ON = '2026-11-03'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified November 3, 2026 against the current public homepage, careers landing, eight advertised role pages, and their native detail criteria. Four roles have complete visible descriptions; one returns 404 and three lack usable role criteria. Missing details retain partial inventory and prohibit cleanup; transport failure never proves empty inventory.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const UNAVAILABLE_ERROR_PATTERN =
  /fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to|getaddrinfo|enotfound/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const titleCaseEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const compact = normalized.replace(/_/g, '-').toLowerCase()
  if (compact === 'full-time' || compact === 'full time') return 'Full-time'
  if (compact === 'part-time' || compact === 'part time') return 'Part-time'
  if (compact === 'internship') return 'Internship'
  if (compact === 'contract') return 'Contract'

  return normalized
}

const normalizeCountry = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^(in|india)$/i.test(normalized)) return 'India'
  return normalized
}

const appendCountryToLocation = (value, country = 'India') => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (new RegExp(`${country}$`, 'i').test(normalized)) return normalized
  return `${normalized}, ${country}`
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const extractMetaDescription = (html) => {
  const match = String(html ?? '').match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
  return normalizeWhitespace(match?.[1] ?? null)
}

const extractJsonLdBlocks = (html) => [...String(html ?? '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .map((value) => {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  })
  .filter(Boolean)

const flattenJsonLdNodes = (nodes) => nodes.flatMap((node) => {
  if (Array.isArray(node)) return flattenJsonLdNodes(node)
  if (Array.isArray(node?.['@graph'])) return flattenJsonLdNodes(node['@graph'])
  return [node]
})

const extractJobPostingNode = (html) => flattenJsonLdNodes(extractJsonLdBlocks(html))
  .find((node) => String(node?.['@type'] ?? '').toLowerCase() === 'jobposting')

const extractHybridSignal = (html) => {
  const text = stripTags(html) || ''
  if (/\bhybrid work model\b/i.test(text) || /\bhybrid\b/i.test(text)) return 'Hybrid'
  if (/\bremote\b/i.test(text)) return 'Remote'
  return null
}

const extractSectionItems = (html, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(html ?? '').match(
    new RegExp(`<p[^>]*>\\s*${escapedHeading}\\s*<\\/p>([\\s\\S]*?)(?=<div\\b[^>]*\\sclass\\s*=\\s*["'][^"']*\\bmt-5\\b|<\\/main>)`, 'i'),
  )

  if (!match) return []

  return [...match[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((item) => stripTags(item[1]))
    .filter(Boolean)
}

const extractHeader = (html) => {
  const match = String(html ?? '').match(/<h1[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>\s*\|\s*([^<]+)<\/h1>/i)
  return {
    title: normalizeWhitespace(match?.[1] ?? null),
    department: normalizeWhitespace(match?.[2] ?? null),
  }
}

const extractLocationAndEmployment = (html) => {
  const raw = stripTags(String(html ?? '').match(/<p class="fs-6 mt-3">([\s\S]*?)<\/p>/i)?.[1] ?? null)
  if (!raw) {
    return {
      location: null,
      city: null,
      country: null,
      employmentType: null,
    }
  }

  const employmentMatch = raw.match(/\b(Full-Time|Internship|Part-Time|Contract)\b/i)
  const employmentType = titleCaseEmploymentType(employmentMatch?.[1] ?? null)
  const locationText = employmentMatch ? raw.replace(employmentMatch[0], '').trim() : raw
  const country = 'India'
  const location = appendCountryToLocation(locationText, country)

  return {
    location,
    city: extractCity(location),
    country,
    employmentType,
  }
}

const extractExperienceRequired = (values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    const match = normalized?.match(/(\d+\s*(?:\+\s*)?(?:-\s*\d+\s*)?years?)/i)
    if (match?.[1]) {
      return normalizeWhitespace(match[1])
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  const hasLegacyHero = /<h1>\s*COSGrid Networks\s*<\/h1>/i.test(page)
    && /Cyber Resiliency Simplified/i.test(text)
  const hasZ3Hero = /Endpoint Native - Unified SASE Platform/i.test(text)
    && /COSGrid Z3:\s*Cyber-Resiliency Simplified\./i.test(text)
    && /Built on Three Absolutes/i.test(text)
  const document = readNativeDocument(page)
  const hasCurrentIdentity = document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'
    && node.attrs.href === HOMEPAGE_URL).length === 1
    && document.nodes(node => node.tag === 'a' && node.attrs.href === '/company/careers').length > 0

  return /<title>\s*COSGrid \| Cyber Resiliency Simplified - Secure Access &amp; Protection\s*<\/title>/i.test(page)
    && (hasLegacyHero || hasZ3Hero || hasCurrentIdentity)
    && /href=["']\/company\/careers["']/i.test(page)
}

export const hasOfficialCareersLandingSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const document = readNativeDocument(page)

  return /<title>\s*Join the COSGrid Team: Build a Brighter Digital Future\s*<\/title>/i.test(page)
    && document.nodes(node => node.tag === 'h1'
      && /^(?:Join the COSGrid Team|Join Our Team|COSGrid Careers)$/.test(document.text(node))).length === 1
    && /Take a look at our latest job opportunities/i.test(text)
    && /(?:ng-reflect-router-link=["']openings["']|href=["']\/company\/careers\/openings["'])/i.test(page)
}

export const extractSearchResults = (html) => {
  if (!/<title>\s*COSGrid Networks \| Current Job Openings \| Join Our Team\s*<\/title>/i.test(String(html ?? ''))) {
    throw new Error('COSGrid verified openings page no longer matches the trusted first-party surface')
  }

  const cards = [...String(html ?? '').matchAll(
    /<div[^>]*class="[^"]*\bsingle-career-container\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
  )]
    .map((match) => match[1])
    .filter(Boolean)

  const listings = cards.map((cardHtml) => {
    const title = stripTags(
      cardHtml.match(/<p[^>]*class="[^"]*\bfw-bold\b[^"]*\bfs-6\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? null,
    )
    const textFields = [...cardHtml.matchAll(/<p[^>]*class="(?![^"]*\bfw-bold\b)[^"]*\bfs-6\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((match) => stripTags(match[1]))
      .filter(Boolean)
    const department = textFields[0] || null
    const employmentType = titleCaseEmploymentType(textFields[1] || null)
    const slug = normalizeWhitespace(
      cardHtml.match(/ng-reflect-router-link="([^"]+)"/i)?.[1]
        ?? cardHtml.match(/routerLink="([^"]+)"/i)?.[1]
        ?? null,
    )

    if (!title || !department || !employmentType || !slug) {
      return null
    }

    return {
      title,
      department,
      employmentType,
      slug,
      sourceUrl: `${OPENINGS_URL}/${slug}`,
    }
  }).filter(Boolean)

  if (listings.length === 0) {
    throw new Error('COSGrid verified openings page no longer exposes public job cards')
  }

  return listings
}

export const extractJobDetail = (html, { sourceUrl, fallbackListing } = {}) => {
  const page = String(html ?? '')
  const header = extractHeader(page)
  const text = stripTags(page) || ''
  const jobPosting = extractJobPostingNode(page)
  const resolvedTitle = normalizeWhitespace(jobPosting?.title ?? header.title ?? fallbackListing?.title)
  const resolvedDepartment = header.department ?? fallbackListing?.department ?? null

  if (
    !resolvedTitle
    || !resolvedDepartment
    || !/COSGrid Networks is a leading networking and cybersecurity products company/i.test(text)
  ) {
    throw new Error('COSGrid verified detail surface no longer matches the trusted first-party job page')
  }

  const requiredSkills = extractSectionItems(page, 'Required Skills')
  const requirements = extractSectionItems(page, 'Requirements')
  const metadata = extractLocationAndEmployment(page)
  const jsonLocation = jobPosting?.jobLocation?.address?.addressLocality ?? null
  const country = normalizeCountry(
    jobPosting?.applicantLocationRequirements?.name
      ?? jobPosting?.jobLocation?.address?.addressCountry
      ?? metadata.country,
  )
  const location = appendCountryToLocation(jsonLocation ?? metadata.location, country ?? 'India')
  // Current structured descriptions are short search previews. Retain the
  // actual visible role criteria before the application form instead.
  const document = readNativeDocument(page)
  const main = document.nodes(node => node.tag === 'main')[0]
  const visibleDescription = main && (requiredSkills.length || requirements.length)
    ? document.text(main).split('Submit your Application')[0].trim() : null
  const description = normalizeWhitespace(visibleDescription || jobPosting?.description || extractMetaDescription(page))
  if (jobPosting?.hiringOrganization?.name && jobPosting.hiringOrganization.name !== COMPANY) {
    throw new Error('COSGrid verified detail surface has a different employer')
  }
  if (jobPosting?.url && sourceUrl && jobPosting.url !== sourceUrl) {
    throw new Error('COSGrid verified detail surface has a different native role URL')
  }
  const experienceRequired = extractExperienceRequired([
    ...requiredSkills,
    ...requirements,
    header.title,
    fallbackListing?.title,
  ])

  return {
    title: resolvedTitle,
    department: resolvedDepartment,
    employmentType: titleCaseEmploymentType(jobPosting?.employmentType ?? fallbackListing?.employmentType ?? metadata.employmentType),
    location,
    city: normalizeWhitespace(jsonLocation ?? metadata.city),
    country: country ?? 'India',
    postingDate: normalizeWhitespace(jobPosting?.datePosted ?? null),
    closingDate: normalizeWhitespace(jobPosting?.validThrough ?? null),
    jobDescription: description,
    experienceRequired,
    minimumQualification: requirements.length > 0 ? requirements.join(' ') : null,
    preferredQualification: null,
    requiredSkills,
    remoteStatus: extractHybridSignal(page),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const isVerifiedCosgridUnavailableError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')

  return UNAVAILABLE_ERROR_PATTERN.test(message)
    || UNAVAILABLE_ERROR_PATTERN.test(causeCode)
    || UNAVAILABLE_ERROR_PATTERN.test(causeMessage)
}

const fetchTextSafely = async (fetchText, url) => {
  try {
    return {
      html: await fetchText(url),
      error: null,
    }
  } catch (error) {
    if (!isVerifiedCosgridUnavailableError(error)) throw error

    return {
      html: null,
      error,
    }
  }
}

export const createCosgridNetworksScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageResult = await fetchTextSafely(fetchText, HOMEPAGE_URL)
    const homepageHtml = homepageResult.html
    if (homepageHtml && !hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('COSGrid verified official homepage no longer matches the trusted first-party surface')
    }

    const careersResult = await fetchTextSafely(fetchText, CAREERS_URL)
    const careersHtml = careersResult.html
    if (careersHtml && !hasOfficialCareersLandingSignal(careersHtml)) {
      throw new Error('COSGrid verified careers landing no longer matches the trusted first-party surface')
    }

    const openingsResult = await fetchTextSafely(fetchText, OPENINGS_URL)
    const openingsHtml = openingsResult.html
    if (!openingsHtml) {
      throw openingsResult.error || new Error('COSGrid public inventory unavailable')
    }

    const listings = extractSearchResults(openingsHtml)
    const jobs = []
    const unavailable = []

    for (const listing of listings) {
      let detailHtml = null

      try {
        detailHtml = await fetchText(listing.sourceUrl)
      } catch (error) {
        if (/HTTP 404/i.test(String(error?.message ?? error))) {
          unavailable.push(listing.slug)
          continue
        }

        throw error
      }

      try {
        const detail = extractJobDetail(detailHtml, {
          sourceUrl: listing.sourceUrl,
          fallbackListing: listing,
        })
        if (!detail.jobDescription || detail.jobDescription.length < 150
          || (!detail.requiredSkills.length && !detail.minimumQualification)) {
          unavailable.push(listing.slug)
          continue
        }

        jobs.push({
          ...detail,
          company: COMPANY,
          source: SOURCE,
          jobId: listing.slug,
          requisitionId: listing.slug,
          sourceUrl: listing.sourceUrl,
          applyUrl: listing.sourceUrl,
          link: listing.sourceUrl,
          scrapedAt: (overrideNow || now)(),
          companyCareerPage: OPENINGS_URL,
          companyDomain: COMPANY_DOMAIN,
          atsPlatform: 'official-company-careers',
          sourceListingComplete: false,
          sourceScopeComplete: false,
          lifecycleCleanupAllowed: false,
        })
      } catch (error) {
        if (/verified detail surface/i.test(String(error?.message ?? error))) {
          unavailable.push(listing.slug)
          continue
        }

        throw error
      }
    }

    // A listed role with a missing/changed detail does not prove a complete
    // inventory. Keep independently verified roles and prohibit cleanup.
    return attachInventoryEvidence(jobs, {
      status: 'coverage-gap', surface: OPENINGS_URL, firstParty: true,
      listingComplete: false, reportedTotal: listings.length, indiaFacetCount: null,
      pagesFetched: 3 + listings.length, verifiedAt: (overrideNow || now)(),
      reason: `current-public-role-criteria;closing-inventory-not-verified;unavailable-native-roles:${unavailable.join(',') || 'none'}`,
    })
  },
})

export const run = async (options = {}) => createCosgridNetworksScraper().run(options)

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
