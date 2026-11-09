import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readEightfoldLocationScope } from '../../scraper-support/apiPortal/eightfoldLocations.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readLifeSignsNativePublicationDate } from './nativePublicationDate20261107.js'
import { readLifeSignsNativeRoleCountry } from './nativeRoleCountry20261107.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lifesigns'
export const COMPANY = 'LifeSigns'
export const HOMEPAGE_URL = 'https://www.lifesigns.us/'
export const CAREERS_URL = 'https://www.lifesigns.us/careers/'
const WIX_CLIENT_ID = '7923844b-a7b1-422f-879d-98abe62f1c0e'
const WIX_COLLECTION = 'OpenRoles'
const WIX_TOKEN_URL = 'https://www.wixapis.com/oauth2/token'
const WIX_QUERY_URL = 'https://edge.wixapis.com/wix-data/v2/items/query'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DEFAULT_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': USER_AGENT,
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const normalizePathname = (value, baseUrl = CAREERS_URL) => {
  try {
    const url = new URL(value, baseUrl)
    if (url.protocol !== 'https:' || url.origin !== new URL(HOMEPAGE_URL).origin
      || url.username || url.password) return null
    return url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`
  } catch {
    return null
  }
}

const hasPathLink = (snapshot, pathname) => (Array.isArray(snapshot?.links) ? snapshot.links : [])
  .some((href) => normalizePathname(href, snapshot?.url || HOMEPAGE_URL) === pathname)

const buildJobId = (pathname) => {
  const slug = normalizePathname(pathname)
    ?.split('/')
    .filter(Boolean)
    .at(-1)

  return slug ? `${SOURCE}-${slug}` : null
}

const buildRoleUrl = (pathname) => {
  try {
    return new URL(normalizePathname(pathname) || '', HOMEPAGE_URL).toString()
  } catch {
    return CAREERS_URL
  }
}

const stripHtml = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const extractHtmlTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const extractSnapshotLinks = (html = '') => [...String(html ?? '').matchAll(
  /<a\b[^>]*href=(["'])(.*?)\1[^>]*>/gi,
)]
  .map((match) => normalizeWhitespace(match[2]))
  .filter(Boolean)

const defaultFetchPageSnapshot = async (url) => {
  const response = await fetch(url, {
    headers: DEFAULT_HEADERS,
    redirect: 'follow',
  })
  const finalUrl = response.url || url
  const html = await response.text()

  return {
    status: response.status,
    url: finalUrl,
    html,
    contentType: response.headers?.get?.('content-type') ?? null,
    title: extractHtmlTitle(html),
    text: normalizeWhitespace(stripHtml(html)),
    links: extractSnapshotLinks(html),
  }
}

export const hasOfficialHomepageSignal = (snapshot = {}) => {
  const title = normalizeWhitespace(snapshot.title) || ''
  const text = (normalizeWhitespace(snapshot.text) || '').toLowerCase()

  return snapshot.status === 200
    && normalizePathname(snapshot.url, HOMEPAGE_URL) === '/'
    && [
      'Lifesigns | Intelligent patient monitoring for smarter decisions',
      'AI Patient Monitoring System, Ambulance to Home | Lifesigns',
    ].includes(title)
    && text.includes('ai-powered patient monitoring')
    && [
      'predictive intelligence and continuous monitoring',
      'predictive intelligence and continuous patient monitoring',
    ].some((phrase) => text.includes(phrase))
    && hasPathLink(snapshot, '/careers/')
}

export const hasOfficialCareersSignal = (snapshot = {}) => {
  const title = normalizeWhitespace(snapshot.title) || ''
  const text = normalizeWhitespace(snapshot.text) || ''
  const normalizedText = text.toLowerCase()

  return snapshot.status === 200
    && normalizePathname(snapshot.url, CAREERS_URL) === '/careers/'
    && [
      'Careers at Lifesigns | Challenge convention',
      'Careers at Lifesigns | Challenge convention | Lifesigns',
      'Careers at Lifesigns | Healthcare AI &amp; Technology Jobs',
    ].includes(title)
    && normalizedText.includes('we challenge')
    && normalizedText.includes('see open roles')
    && normalizedText.includes('explore our open roles')
    && /didn['’]t see the role you['’]re looking for\?/.test(normalizedText)
    && normalizedText.includes('leave a message')
}

export const hasVerifiedRoleDetailSignal = (snapshot = {}, pathname, expectedTitle) => {
  const title = normalizeWhitespace(snapshot.title) || ''

  return snapshot.status === 200
    && normalizePathname(snapshot.url, CAREERS_URL) === pathname
    && [expectedTitle, `${expectedTitle} | Lifesigns`].includes(title)
}

const extractBodyText = (node) => {
  if (!node || typeof node !== 'object') return ''
  return [node.textData?.text, ...(node.nodes || []).map(extractBodyText)]
    .filter(Boolean)
    .join(' ')
}

export const fetchOpenRoles = async (fetchImpl = fetch) => {
  const tokenResponse = await fetchImpl(WIX_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: WIX_CLIENT_ID, grantType: 'anonymous' }),
  })
  if (!tokenResponse.ok) throw new Error(`LifeSigns public role token returned HTTP ${tokenResponse.status}`)
  const { access_token: token } = await tokenResponse.json()
  if (!token) throw new Error('LifeSigns public role token is missing')

  const query = {
    dataCollectionId: WIX_COLLECTION,
    query: { fields: [], paging: { limit: 1000, offset: 0 }, filter: {}, sort: [] },
    referencedItemOptions: [],
  }
  const url = `${WIX_QUERY_URL}?.r=${Buffer.from(JSON.stringify(query)).toString('base64url')}`
  const response = await fetchImpl(url, { headers: { Authorization: token } })
  if (!response.ok) throw new Error(`LifeSigns public role feed returned HTTP ${response.status}`)
  const result = await response.json()
  if (!Array.isArray(result.dataItems) || result.pagingMetadata?.hasNext || result.pagingMetadata?.tooManyToCount) {
    throw new Error('LifeSigns public role feed is incomplete or changed shape')
  }
  return result.dataItems
}

// The role feed has one location string, not a separate native country field.
// Preserve only explicit country text; cities, employer addresses and the
// provider's requested country cannot supply a vacancy's missing geography.
const resolveRoleGeography = location => {
  const unknown = { country: null, location: null, city: null, state: null, nativeGeographyQualified: false }
  if (location.split(',').some(component => !component.trim())
    || /[;/|]|\b(?:and|or|global|worldwide|multiple|anywhere)\b/i.test(location)) return unknown
  const countryFor = value => {
    const scope = readEightfoldLocationScope({ locations: [value] })
    return scope.unresolved ? null : scope.country
  }
  const country = countryFor(location)
  if (!country) return unknown
  const explicitCountries = new Set(location.split(',').map(component => countryFor(component.trim())).filter(Boolean))
  if (explicitCountries.size > 1 || [...explicitCountries].some(observed => observed !== country)) return unknown
  return { ...unknown, country, location, nativeGeographyQualified: true }
}

export const extractVerifiedOpenRoles = (careersSnapshot, roleItems, roleSnapshotsByPath = {}) => {
  if (!hasOfficialCareersSignal(careersSnapshot)) {
    throw new Error('LifeSigns careers page no longer matches the verified official public surface')
  }
  if (!Array.isArray(roleItems)) throw new Error('LifeSigns public role feed is missing')

  const seen = new Set()
  return roleItems.map((item) => {
    if (item?.dataCollectionId !== WIX_COLLECTION || !item.id || !item.data) {
      throw new Error('LifeSigns public role feed changed shape')
    }
    const role = item.data
    const slug = normalizeWhitespace(role.slug)
    const title = normalizeWhitespace(role.title)
    const city = typeof role.location === 'string' ? normalizeWhitespace(role.location) : null
    if (!slug || !/^[a-z0-9-]+$/.test(slug) || !title || !city || !role.employmentType) {
      throw new Error('LifeSigns public role feed has an incomplete opening')
    }
    if (/^(remote|hybrid|anywhere)$/i.test(city)) {
      throw new Error(`LifeSigns role location needs country verification: ${slug}`)
    }
    const pathname = `/careers/${slug}/`
    if (seen.has(pathname)) throw new Error(`LifeSigns duplicate opening: ${pathname}`)
    seen.add(pathname)

    const roleSnapshot = roleSnapshotsByPath[pathname]
    const jobId = buildJobId(pathname)
    const roleUrl = buildRoleUrl(pathname)

    if (!hasVerifiedRoleDetailSignal(roleSnapshot, pathname, title)) {
      throw new Error(`LifeSigns role detail page drifted for "${pathname}"`)
    }

    const publicationDate = readLifeSignsNativePublicationDate(role._publishDate, Date.now())
    const feedGeography = resolveRoleGeography(city)
    const geography = readLifeSignsNativeRoleCountry(roleSnapshot, item, roleUrl, feedGeography) || feedGeography

    return {
      title,
      company: COMPANY,
      department: null,
      ...geography,
      rawNativeWorkplaceEvidence: { source: SOURCE, jobId, sourceUrl: roleUrl, roleLocation: role.location },
      sourceListingComplete: false,
      sourceScopeComplete: false,
      lifecycleCleanupAllowed: false,
      jobId,
      requisitionId: item.id,
      sourceUrl: roleUrl,
      applyUrl: roleUrl,
      employmentType: role.employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      ...publicationDate,
      closingDate: null,
      jobDescription: normalizeWhitespace(extractBodyText(role.body)) || null,
    }
  })
}

export const createLifeSignsScraper = () => ({
  async run({ fetchPageSnapshot = defaultFetchPageSnapshot, fetchRoleItems = fetchOpenRoles } = {}) {
    let pagesFetched = 0
    const readPageSnapshot = async url => {
      const snapshot = await fetchPageSnapshot(url)
      pagesFetched += 1
      return snapshot
    }
    const homepageSnapshot = await readPageSnapshot(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageSnapshot)) {
      throw new Error('LifeSigns homepage no longer matches the verified official public surface')
    }

    const careersSnapshot = await readPageSnapshot(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersSnapshot)) {
      throw new Error('LifeSigns careers page no longer matches the verified official public surface')
    }
    const roleItems = await fetchRoleItems()
    if (!Array.isArray(roleItems)) throw new Error('LifeSigns public role feed is missing')
    const roleSnapshots = Object.fromEntries(
      await Promise.all(
        roleItems.map(async (item) => {
          const pathname = `/careers/${item.data?.slug}/`
          return [pathname, await readPageSnapshot(buildRoleUrl(pathname))]
        }),
      ),
    )
    const jobs = extractVerifiedOpenRoles(careersSnapshot, roleItems, roleSnapshots)
    const scrapedAt = new Date().toISOString()

    return attachInventoryEvidence(jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: 'lifesigns.us',
      atsPlatform: 'official-company-careers',
    })), {
      status: 'coverage-gap', surface: CAREERS_URL, firstParty: false,
      listingComplete: false, pagesFetched, reportedTotal: null,
      indiaFacetCount: null, verifiedAt: null,
      reason: jobs.some(job => job.nativeGeographyQualified === false)
        ? 'lifesigns-native-role-workplace-unqualified;company-inventory-scope-unqualified'
        : 'lifesigns-company-inventory-scope-unqualified',
    })
  },
})

export const run = async (options = {}) => createLifeSignsScraper().run(options)

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
