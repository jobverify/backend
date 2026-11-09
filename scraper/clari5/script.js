import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'clari5'
export const COMPANY = 'Clari5'
export const HOMEPAGE_URL = 'https://www.clari5.com/'
export const CAREERS_URL = 'https://www.clari5.com/careers/'

const SITE_ORIGIN = 'https://www.clari5.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const INDIA_LOCATION_PATTERN =
  /\b(?:india|bangalore|bengaluru|mumbai|delhi|new delhi|gurgaon|gurugram|pune|hyderabad|chennai|noida|kolkata|calcutta|ahmedabad|kochi|cochin|coimbatore|thiruvananthapuram|trivandrum)\b/i

const decodeHtml = (value) => {
  let decoded = String(value ?? '')

  for (let index = 0; index < 3; index += 1) {
    const next = decoded
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&#038;|&amp;/gi, '&')
      .replace(/&#8211;|&ndash;|\u2013/gi, '-')
      .replace(/&#8212;|&mdash;|\u2014/gi, '-')
      .replace(/&#8216;|&#8217;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
      .replace(/&#8220;|&#8221;|&quot;|&ldquo;|&rdquo;/gi, '"')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')

    if (next === decoded) break
    decoded = next
  }

  return decoded
}

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|a|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toPlainText = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/tr|\/table)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|tr|table)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()

  return normalized || null
}

const extractText = (pattern, html) => stripTags(pattern.exec(String(html ?? ''))?.[1] ?? null)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const isOfficialDetailUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === SITE_ORIGIN && !url.search && !url.hash && !url.username && !url.password
      && /^\/careers\/(?!page\/)[a-z0-9-]+\/$/i.test(url.pathname)
  } catch {
    return false
  }
}

const isIndiaLocation = (value) => INDIA_LOCATION_PATTERN.test(normalizeWhitespace(value) || '')

const deriveState = (location) => {
  const normalized = normalizeWhitespace(location)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('bangalore') || normalized.includes('bengaluru')) return 'Karnataka'
  if (normalized.includes('mumbai') || normalized.includes('pune')) return 'Maharashtra'
  if (normalized.includes('delhi')) return 'Delhi'
  if (normalized.includes('gurgaon') || normalized.includes('gurugram')) return 'Haryana'
  if (normalized.includes('hyderabad')) return 'Telangana'
  if (normalized.includes('chennai') || normalized.includes('coimbatore')) return 'Tamil Nadu'
  if (normalized.includes('noida')) return 'Uttar Pradesh'
  if (normalized.includes('kochi') || normalized.includes('cochin') || normalized.includes('thiruvananthapuram') || normalized.includes('trivandrum')) {
    return 'Kerala'
  }
  if (normalized.includes('ahmedabad')) return 'Gujarat'
  if (normalized.includes('kolkata') || normalized.includes('calcutta')) return 'West Bengal'
  return null
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const withoutCountry = normalized.replace(/,\s*India$/i, '')
  if (/[\/]|,/.test(withoutCountry)) return null

  return withoutCountry || null
}

const extractCategory = (html) =>
  extractText(
    /<h4>\s*<i[^>]*><\/i>\s*Job Category<\/h4>\s*<p>([\s\S]*?)<\/p>/i,
    html,
  )

const descriptionLines = (descriptionHtml) =>
  (Array.isArray(descriptionHtml) ? descriptionHtml.join('\n') : toPlainText(descriptionHtml) || '')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const extractValueAfterLabel = (descriptionHtml, label) => {
  const lines = descriptionLines(descriptionHtml)
  const normalizedLabel = normalizeWhitespace(label)?.replace(/:$/, '').toLowerCase()
  if (!normalizedLabel) return null

  const index = lines.findIndex((line) => line.replace(/:$/, '').toLowerCase() === normalizedLabel)
  if (index === -1) return null

  return lines[index + 1] || null
}

const extractExperienceRequired = (descriptionHtml) => {
  const labeledExperience = extractValueAfterLabel(descriptionHtml, 'Experience')
  if (labeledExperience) return labeledExperience

  const lines = descriptionLines(descriptionHtml)
  return lines.find((line) =>
    /\b(?:\d+\s*(?:-\s*\d+)?\+?\s*years?\b|relevant experience of \d+\s*(?:-\s*\d+)?\s*years?\b)/i.test(line),
  ) || null
}

const extractMinimumQualification = (descriptionHtml) => {
  const lines = descriptionLines(descriptionHtml)
  const matchingLine = lines.find((line) => /^minimum qualification:/i.test(line))
  return normalizeWhitespace(matchingLine?.replace(/^minimum qualification:\s*/i, '') || null)
}

const extractPreferredQualification = (descriptionHtml) => {
  const lines = descriptionLines(descriptionHtml)
  return lines.find((line) => /preferred/i.test(line) && !/:$/.test(line)) || null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''

  return /<link rel="canonical" href="https:\/\/www\.clari5\.com\/"/i.test(page)
    && /(?:og:site_name" content="Clari5"|"name":"Clari5"|<title>[\s\S]*Clari5<\/title>)/i.test(page)
    && /href="https:\/\/www\.clari5\.com\/careers\/"/i.test(page)
    && normalized.includes('fraud detection')
    && normalized.includes('aml')
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const hasJobsArchiveIdentity =
    /<title>\s*Jobs(?:\s*-\s*Page\s+\d+\s+of\s+\d+)?\s*-\s*Clari5\s*<\/title>/i.test(page)
    || /<title>\s*Contact Forms\s*-\s*Clari5\s*<\/title>/i.test(page)
    || /meta name="description" content="Jobs Archive - Clari5"/i.test(page)
  const hasListingsOrEmptyState =
    /class="sjb-search-location\b/i.test(page)
    || /<div class="v2 sjb-job-\d+">/i.test(page)
    || /<div class="no-job-listing">/i.test(page)

  return hasJobsArchiveIdentity
    && /<link rel="canonical" href="https:\/\/www\.clari5\.com\/careers\/(?:page\/\d+\/)?"/i.test(page)
    && /post-type-archive-jobpost/i.test(page)
    && /<div class="sjb-listing">/i.test(page)
    && /simple-job-board-public\.js/i.test(page)
    && hasListingsOrEmptyState
    && (normalized.includes('Apply Now') || normalized.includes('No jobs found'))
}

const archiveShowsNoJobs = (html = '') =>
  /<div class="no-job-listing">/i.test(String(html ?? ''))
  && /No jobs found/i.test(String(html ?? ''))

export const extractNextPageUrl = (html) => {
  const nextUrl = String(html ?? '').match(/<link rel="next" href="([^"]+)"/i)?.[1] ?? null
  const absoluteUrl = toAbsoluteUrl(nextUrl, CAREERS_URL)

  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    return url.origin === SITE_ORIGIN && /^\/careers\/page\/\d+\/$/i.test(url.pathname)
      ? absoluteUrl
      : null
  } catch {
    return null
  }
}

export const extractArchiveListings = (html) => {
  if (!hasOfficialCareersPageSignal(html)) {
    throw new Error('verified Clari5 careers archive no longer matches the trusted first-party public surface')
  }

  if (archiveShowsNoJobs(html)) {
    return []
  }

  const listings = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<div class="v2 sjb-job-(\d+)">([\s\S]*?)<div class="job-description-list">\s*<div id="sjb_less_content_\1"><p>([\s\S]*?)<\/p><\/div>/gi,
  )) {
    const jobId = normalizeWhitespace(match[1])
    const blockHtml = match[2]
    const sourceUrl = toAbsoluteUrl(
      blockHtml.match(/<a href="([^"]+)">\s*<span class="job-title">/i)?.[1] ?? null,
      CAREERS_URL,
    )

    if (!jobId || !sourceUrl || !isOfficialDetailUrl(sourceUrl) || seen.has(sourceUrl)) {
      continue
    }

    const title = extractText(/<span class="job-title">([\s\S]*?)<\/span>/i, blockHtml)
    const employmentType = extractText(/<div class="job-type"><i[^>]*><\/i>([\s\S]*?)<\/div>/i, blockHtml)
    const location = extractText(/<div class="job-location"><i[^>]*><\/i>([\s\S]*?)<\/div>/i, blockHtml)
    const postedText = extractText(/<div class="job-date"><i[^>]*><\/i>([\s\S]*?)<\/div>/i, blockHtml)
    const category = extractCategory(blockHtml)
    const excerpt = stripTags(match[3])

    if (!title || !employmentType || !location || !excerpt) continue

    seen.add(sourceUrl)
    listings.push({
      jobId,
      title,
      sourceUrl,
      employmentType,
      location,
      postedText,
      category,
      excerpt,
    })
  }

  if (listings.length === 0) {
    throw new Error('verified Clari5 careers archive changed or no trusted public role cards remain')
  }

  return listings
}

const descendants = (node, predicate) => node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)),
]
// Head metadata belongs to the document even when an element is hidden/inert.
// Template fragments and embedded fallback documents have their own scopes.
const retainedMetadata = (node, predicate) => ['template', 'object', 'iframe', 'noscript'].includes(node.tag) ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => retainedMetadata(child, predicate)),
]
const roleKey = value => normalizeWhitespace(value)?.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const visibleLines = node => {
  if (node.inert || ['script', 'style'].includes(node.tag)) return ''
  const text = node.children.map(child => typeof child === 'string' ? decodeHtml(child) : visibleLines(child)).join('')
  return /^(?:p|div|li|ul|ol|h[1-6]|section|br)$/.test(node.tag) ? '\n' + text + '\n' : text
}
const readDetailView = (html, sourceUrl, listing = {}) => {
  if (!isOfficialDetailUrl(sourceUrl)) return null
  const document = readVisibleNativeDocument(String(html), {strict:true})
  const retained = readNativeDocument(String(html)), roots = retained.nodes(node => node.tag === 'root')
  if (roots.length !== 1) return null
  const heads = retainedMetadata(roots[0], node => node.tag === 'head')
  const htmlElements = roots[0].children.filter(node => typeof node !== 'string' && node.tag === 'html')
  if (heads.length !== 1 || htmlElements.length !== 1 || !htmlElements[0].children.includes(heads[0])) return null
  const canonical = retainedMetadata(heads[0], node => node.tag === 'link' && node.attrs.rel === 'canonical')
  const titles = retainedMetadata(heads[0], node => node.tag === 'title')
  if (canonical.length !== 1 || canonical[0].attrs.href !== sourceUrl || titles.length !== 1) return null
  const pageTitle = normalizeWhitespace(titles[0].raw)
  const legacyTitle = pageTitle?.match(/^(.+)\s+-\s+Clari5$/i)?.[1]
  const currentTitle = /\sJob\s*\|\s*Clari5 Careers$/i.test(pageTitle || '')
  if (!legacyTitle && !currentTitle) return null
  const posts = document.nodes(node => document.hasClass(node, 'jobpost') && document.hasClass(node, 'type-jobpost'))
  const scope = posts.length === 1 ? posts[0] : posts.length === 0 && !currentTitle
    ? document.nodes(node => node.tag === 'body' && document.hasClass(node, 'single-jobpost'))[0] : null
  if (!scope) return null
  const forms = descendants(scope, node => node.tag === 'form' && node.attrs.id === 'sjb-application-form'
    && document.hasClass(node, 'jobpost-form'))
  if (forms.length !== 1) return null
  const form = forms[0], formId = form.attrs.class?.match(/(?:^|\s)sjb-job-detail-(\d+)(?:\s|$)/)?.[1]
  const field = name => descendants(form, node => node.tag === 'input' && node.attrs.type === 'hidden' && node.attrs.name === name)
  const ids = field('job_id'), actions = field('action')
  if (!formId || ids.length !== 1 || ids[0].attrs.value !== formId
    || listing.jobId && listing.jobId !== formId
    || actions.length !== 1 || actions[0].attrs.value !== 'process_applicant_form'
    || posts.length === 1 && !document.hasClass(scope, 'post-' + formId)) return null
  const headings = descendants(scope, node => node.tag === 'h1' && document.text(node))
  if (headings.length > 1 || currentTitle && headings.length !== 1) return null
  const title = headings.length ? normalizeWhitespace(document.text(headings[0])) : normalizeWhitespace(legacyTitle)
  if (!title || listing.title && roleKey(title) !== roleKey(listing.title)) return null
  const descriptions = descendants(scope, node => document.hasClass(node, 'job-description'))
  if (descriptions.length !== 1) return null
  const lines = descriptionLines(visibleLines(descriptions[0]))
  if (lines.join(' ').length < 40 || !/[\p{L}\p{N}]/u.test(lines.join(' '))) return null
  const skills = descendants(descriptions[0], node => node.tag === 'li').map(node => normalizeWhitespace(document.text(node))).filter(Boolean)
  const roleField = className => descendants(scope, node => document.hasClass(node, className))
  const locations = roleField('job-location'), types = roleField('job-type'), dates = roleField('job-date')
  if (locations.length !== 1 || types.length > 1 || dates.length > 1) return null
  const location = normalizeWhitespace(document.text(locations[0]))
  if (!location) return null
  return {title, jobId:formId, description:lines.join('\n'), lines, skills, location,
    employmentType:types.length ? normalizeWhitespace(document.text(types[0])) : null,
    postedText:dates.length ? normalizeWhitespace(document.text(dates[0])) : null}
}

export const hasOfficialJobDetailSignal = (html, sourceUrl) => {
  try { return Boolean(readDetailView(html, sourceUrl)) } catch { return false }
}

export const extractJobDetail = (html, listing = {}) => {
  const sourceUrl = listing.sourceUrl || null
  let view
  try { view = sourceUrl && readDetailView(html, sourceUrl, listing) } catch { /* Unqualified markup is not a job detail. */ }
  if (!view) {
    throw new Error('verified Clari5 job detail no longer matches the trusted first-party application surface')
  }

  const descriptionHtml = view.lines
  const location = view.location
  const employmentType = view.employmentType
  const postedText = view.postedText
  const category = listing.category || null
  const jobId = view.jobId

  return {
    title: view.title,
    company: COMPANY,
    department: extractValueAfterLabel(descriptionHtml, 'Department') || category,
    location,
    city: deriveCity(location),
    state: deriveState(location),
    country: isIndiaLocation(location) ? 'India' : null,
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType,
    experienceRequired: extractExperienceRequired(descriptionHtml),
    minimumQualification: extractMinimumQualification(descriptionHtml),
    preferredQualification: extractPreferredQualification(descriptionHtml),
    requiredSkills: view.skills,
    postingDate: postedText,
    closingDate: null,
    jobDescription: view.description,
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

export const createClari5Scraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Clari5 verified homepage no longer matches the trusted first-party surface')
    }

    const archiveListings = []
    const seenPages = new Set()
    let nextPageUrl = CAREERS_URL

    while (nextPageUrl && !seenPages.has(nextPageUrl)) {
      seenPages.add(nextPageUrl)

      const archiveHtml = await fetchText(nextPageUrl)
      archiveListings.push(...extractArchiveListings(archiveHtml))
      nextPageUrl = extractNextPageUrl(archiveHtml)
    }

    const jobs = []
    const seenJobUrls = new Set()

    for (const listing of archiveListings) {
      if (!isIndiaLocation(listing.location) || seenJobUrls.has(listing.sourceUrl)) {
        continue
      }

      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)
      if (detail.country !== 'India') continue

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'clari5.com',
        atsPlatform: 'official-company-careers',
        scrapedAt: now(),
        sourceListingComplete: false,
        lifecycleCleanupAllowed: false,
      })
      seenJobUrls.add(listing.sourceUrl)
    }

    return attachInventoryEvidence(jobs, {
      status:'coverage-gap', surface:CAREERS_URL, firstParty:true, listingComplete:false,
      pagesFetched:seenPages.size + seenJobUrls.size, reportedTotal:null, indiaFacetCount:null, verifiedAt:null,
      reason:'first-party-listed-roles-recovered-company-scope-and-closing-status-unverified',
    })
  },
})

export const run = async (options = {}) => createClari5Scraper().run(options)

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
