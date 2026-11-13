import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AJNALENS_CATALOG } from './catalog.js'
import { createHash } from 'node:crypto'
import { activeHead, activeScripts } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AJNALENS_CATALOG.source
export const COMPANY = AJNALENS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AJNALENS_CATALOG.officialBrandName
export const VERIFIED_ON = AJNALENS_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AJNALENS_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AJNALENS_CATALOG
export const HOMEPAGE_URL = AJNALENS_CATALOG.homepageUrl
export const CAREERS_URL = AJNALENS_CATALOG.companyCareerPage
export const APPLICATION_URL = AJNALENS_CATALOG.applicationUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const EMBEDDED_ROLE_PATTERN =
  /\\"id\\":(\d+),\\"documentId\\":\\"[^"]+\\",\\"ttile\\":\\"([^"]+)\\",\\"slug\\":\\"([^"]+)\\",\\"experience\\":\\"([^"]*)\\",\\"createdAt\\":\\"([^"]+)\\"/gi

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeTextContent = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeExperience = (value) => normalizeWhitespace(value)
  ?.match(/\d+/g)
  ?.slice(0, 2)
  ?.join('-') || null

const mapRoleToJob = (role) => ({
  title: role.title,
  company: COMPANY,
  department: null,
  location: 'India',
  city: null,
  state: null,
  country: 'India',
  jobId: role.id,
  requisitionId: role.id,
  sourceUrl: CAREERS_URL,
  applyUrl: APPLICATION_URL,
  employmentType: null,
  experienceRequired: role.experience,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: role.postingDate,
  closingDate: null,
  jobDescription: `Apply via the shared first-party careers page on ${CAREERS_URL}. AjnaLens currently states its teams work from the office.`,
  remoteStatus: 'On-site',
})

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])]),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const markUpstreamOutage = (error) => {
  error.softFailure = true
  error.upstreamOutage = true
  return error
}

export const buildRoleDetailUrl = (slug) => `${CAREERS_URL}/${normalizeWhitespace(slug) || ''}`

export const isOriginUnreachableSurface = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = normalizeTextContent(html) || ''

  return Number(page?.status) === 523
    && /<title>\s*ajnalens\.com\s*\|\s*523:\s*Origin is unreachable\s*<\/title>/i.test(html)
    && /origin is unreachable/i.test(text)
}

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at AjnaLens \|\s*Join the Future of XR\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+Build a transformative career at AjnaLens/i.test(page)
    && /href=["']\/careers["']/i.test(page)
    && /openings_list/i.test(page)
    && /Start Your Journey With Us/i.test(page)
    && /Submit your resume and explore opportunities to work on meaningful and impactful projects/i.test(page)
    && /What does your hiring process look like\?/i.test(page)
    && /How can I apply for a job at AjnaLens\?/i.test(page)
    && /Our teams currently work from the office/i.test(page)
    && /Subscribe to job alert/i.test(page)
}

export const extractEmbeddedRoles = (html) => {
  const page = String(html ?? '')
  const roles = []
  const seenIds = new Set()

  for (const match of page.matchAll(EMBEDDED_ROLE_PATTERN)) {
    const id = normalizeWhitespace(match[1])
    const title = normalizeWhitespace(match[2])
    const slug = normalizeWhitespace(match[3])
    const experience = normalizeExperience(match[4])
    const postingDate = normalizeWhitespace(match[5])

    if (!id || !title || !slug || !experience || !postingDate || seenIds.has(id)) {
      continue
    }

    seenIds.add(id)
    roles.push({
      id,
      title,
      slug,
      experience,
      postingDate,
    })
  }

  return roles
}

export const isVerifiedMissingDetailRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const text = normalizeTextContent(html) || ''
  const finalUrl = normalizeWhitespace(page?.url) || ''

  return Number(page?.status) === 404
    && /^https:\/\/ajnalens\.com\/careers\/[^/?#]+$/i.test(finalUrl)
    && /<meta[^>]+name=["']robots["'][^>]+content=["']noindex["']/i.test(html)
    && /<title>\s*404:\s*This page could not be found\.\s*<\/title>/i.test(html)
    && text.includes('This page could not be found.')
}

export const extractOpenPositions = (html) => {
  if (!hasOfficialCareersSurface(html)) {
    throw new Error('AjnaLens careers page no longer matches the verified AjnaLens careers surface')
  }

  const roles = extractEmbeddedRoles(html)
  if (roles.length === 0) {
    throw new Error('AjnaLens careers page no longer exposes the verified embedded openings payload')
  }

  return roles.map(mapRoleToJob)
}

const CURRENT_CAREERS = 'https://www.ajnalens.com/careers'
const CURRENT_CLIENT = 'https://www.ajnalens.com/_next/static/chunks/86b08c738e2cae78.js'
const CURRENT_CLIENT_SHA = 'b882e3907ad51be3410791ec95004ce4605991f51870244d467454f019a3a2bb'
const needCurrent = (ok, why) => { if (!ok) throw Error('AjnaLens current native: ' + why) }
const boundedPage = (reader, url, signal) => {
  signal?.throwIfAborted()
  if (!signal) return reader(url)
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(signal.reason) }
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve().then(() => reader(url, { signal })).then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
}
const observeCurrentCareers = async (initial, reader, callerSignal) => {
  const signal = AbortSignal.any([AbortSignal.timeout(120000), ...(callerSignal ? [callerSignal] : [])])
  const inspect = async page => {
    needCurrent(page.status === 200 && page.url === CURRENT_CAREERS, 'public employer/final URL identity changed')
    const doc = readVisibleNativeDocument(page.html, { strict: true })
    needCurrent(activeHead(page.html).titles.includes("Careers at AjnaLens | Build India's XR Future")
      && doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && node.attrs.href === CURRENT_CAREERS).length === 1
      && doc.nodes(node => node.attrs.id === 'contactus').length === 1
      && doc.nodes(node => node.tag === 'h2' && doc.text(node) === 'Current Openings').length === 1,
    'current active first-party careers surface changed')
    const roles = extractEmbeddedRoles(activeScripts(page.html).join('\n'))
    needCurrent(roles.length > 0 && roles.length <= 100 && roles.every(role => doc.nodes(node => node.tag === 'h6' && doc.text(node) === role.title).length === 1),
      'current active opening titles and native IDs disagree')
    needCurrent(doc.nodes(node => node.tag === 'script' && node.attrs.src === new URL(CURRENT_CLIENT).pathname
      && !Object.hasOwn(node.attrs, 'nomodule')).length === 1, 'current public openings client missing')
    const client = await boundedPage(reader, CURRENT_CLIENT, signal)
    needCurrent(client.status === 200 && client.url === CURRENT_CLIENT
      && createHash('sha256').update(client.html).digest('hex') === CURRENT_CLIENT_SHA, 'unreviewed title-only public client contract')
    // Module75219 maps only title/experience and scrolls Apply Now to #contactus.
    // Neither a workplace country nor full per-role criteria is published there.
    return roles.map(role => ({ jobId: role.id, title: role.title, experience: role.experience,
      nativeCreatedAt: role.postingDate, sourceUrl: CURRENT_CAREERS, country: null, fullCriteria: null }))
  }
  const opening = await inspect(initial)
  const closing = await inspect(await boundedPage(reader, CAREERS_URL, signal))
  needCurrent(JSON.stringify(opening) === JSON.stringify(closing), 'current public opening membership changed at closing')
  const jobs = []
  attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CURRENT_CAREERS, firstParty: true,
    listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: 4, reportedTotal: opening.length,
    indiaFacetCount: null, verifiedAt: new Date().toISOString(),
    reason: 'Current first-party title-only openings and shared resume form; full role criteria and workplace countries are not published; native vacancies observed, no publishable India inventory established.' })
  attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: opening.length,
    observedVacancyCount: opening.length, sourceScopeComplete: false })
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: { source: SOURCE, recordKind: 'vacancy-rows',
    observedRecordCount: opening.length, observedVacancyCount: opening.length, sourceScopeComplete: false,
    companyGlobalTotal: null, companyIndiaTotal: null, lifecycleCleanupAllowed: false, observedOpenings: opening,
    closingOpenings: closing, fullCriteriaPublished: false, nativeWorkCountriesPublished: false }, configurable: true })
  signal.throwIfAborted()
  return jobs
}

export const createAjnaLensScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage: reader = defaultFetchPage, now: overrideNow, signal } = {}) {
    const fetchPage = url => boundedPage(reader, url, signal)
    const careersPage = await fetchPage(CAREERS_URL)

    if (activeHead(careersPage.html).titles.includes("Careers at AjnaLens | Build India's XR Future")) {
      return observeCurrentCareers(careersPage, reader, signal)
    }

    if (isOriginUnreachableSurface(careersPage)) {
      throw markUpstreamOutage(new Error('AjnaLens careers page is currently upstream unavailable: Origin is unreachable'))
    }

    if (Number(careersPage?.status) !== 200 || !hasOfficialCareersSurface(careersPage?.html)) {
      throw new Error('AjnaLens careers page no longer matches the verified AjnaLens careers surface')
    }

    const roles = extractEmbeddedRoles(careersPage.html)
    if (roles.length === 0) {
      throw new Error('AjnaLens careers page no longer exposes the verified embedded openings payload')
    }

    for (const role of roles) {
      const detailPage = await fetchPage(buildRoleDetailUrl(role.slug))

      if (!isVerifiedMissingDetailRoute(detailPage)) {
        throw new Error(`AjnaLens verified missing role detail route changed: ${detailPage?.url || buildRoleDetailUrl(role.slug)}`)
      }
    }

    return roles.map((role) => ({
      ...mapRoleToJob(role),
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: APPLICATION_URL,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createAjnaLensScraper().run(options)

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
