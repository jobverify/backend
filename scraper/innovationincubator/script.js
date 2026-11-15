import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { normalizeNativeAttributeBoundaries } from '../../scraper-support/utils/nativeHtmlAttributes.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'innovationincubator'
export const COMPANY = 'Innovation Incubator'
export const CAREERS_PAGE_URL = 'https://innovationincubator.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const buildAbsoluteUrl = (value) => new URL(String(value ?? ''), CAREERS_PAGE_URL).toString()

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractJobId = (url) => {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, '')
    return pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const normalizeLocation = (value) => normalizeWhitespace(value)

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  return normalized
    .replace(/,?\s*India$/i, '')
    .replace(/\s+Remote$/i, '')
    .split(/[\/,]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)[0] || null
}

const hasClass = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const within = (node, predicate) => node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => within(child, predicate)),
]
const visible = html => readVisibleNativeDocument(normalizeNativeAttributeBoundaries(String(html ?? '')))
const ownRoleScope = doc => {
  const scopes = doc.nodes(node => node.attrs['data-elementor-type'] === 'single-post'
    && ['job', 'type-job', 'status-publish'].every(value => hasClass(node, value)))
  return scopes.length === 1 ? scopes[0] : null
}
const extractDescriptionBlock = (html) => {
  const doc = visible(html), scope = ownRoleScope(doc)
  if (!scope) return null
  const descriptions = within(scope, node => hasClass(node, 'section_content'))
  if (descriptions.length !== 1) return null
  const description = normalizeWhitespace(doc.text(descriptions[0]))
  return description?.length >= 200 && extractActiveDescription(description) ? description : null
}

export const inspectCareersSurface = html => {
  const page = normalizeNativeAttributeBoundaries(String(html ?? '')), native = readNativeDocument(page), doc = visible(page)
  const titles = native.nodes(node => node.tag === 'title')
  const canonicals = native.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
  const officialPublisherObserved = titles.length === 1 && /^Careers\s*-\s*Innovation Incubator$/.test(normalizeWhitespace(titles[0].raw) || '')
    && canonicals.length === 1 && canonicals[0].attrs.href === CAREERS_PAGE_URL
    && /We empower everyone to embark on their own career growth/i.test(doc.text(doc.nodes(node => node.tag === 'root')[0]))
  const widgets = doc.nodes(node => node.attrs.id === 'job-openings--grid' && node.attrs['data-widget_type'] === 'posts.custom')
  const widget = widgets.length === 1 ? widgets[0] : null
  const ownLinks = doc.nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
    try { const url = new URL(node.attrs.href, CAREERS_PAGE_URL);return url.origin === 'https://innovationincubator.com' && /^\/job\/[^/]+\/?$/.test(url.pathname) && !url.search && !url.hash ? [url.href] : [] } catch { return [] }
  })
  const pagination = widget ? within(widget, node => hasClass(node, 'ecs-posts')).map(node => {
    try { return JSON.parse(node.attrs['data-settings']) } catch { return null }
  }) : []
  return { officialPublisherObserved, visibleWidgetCount: widgets.length,
    emptyWidgetStateObserved: Boolean(widget && within(widget, node => hasClass(node, 'elementor-posts-nothing-found')).length === 1),
    widgetPagination: pagination, unreadJobURLs: [...new Set(ownLinks)],
    sourceScopeComplete: false, companyReportedTotal: null, indiaReportedTotal: null, lifecycleCleanupAllowed: false }
}

const extractMinimumQualification = (html) => {
  const block = extractFirst(
    /<h3><strong>Required Qualifications(?:\s*&amp;\s*Skills)?<\/strong><\/h3>\s*<ul>([\s\S]*?)<\/ul>/i,
    html,
  )
  const blockText = stripTags(block)
  if (!blockText) return null

  const educationMatch = /Education:\s*([^:]+?)(?=\s+[A-Z][a-z]+:|$)/.exec(blockText)
  return normalizeWhitespace(educationMatch?.[1] || blockText)
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers\s*-\s*Innovation Incubator\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/innovationincubator\.com\/careers\/"/i.test(page)
    && /We empower everyone to embark on their own career growth/i.test(normalized)
    && /<article id="post-\d+" class="[^"]*\bjob type-job status-publish\b/i.test(page)
    && /Scan QR code to apply/i.test(normalized)
  }

export const extractJobCards = (html) => {
  const cards = []
  const articlePattern = /<article id="post-\d+" class="[^"]*\bjob type-job status-publish\b[\s\S]*?<\/article>/gi

  for (const articleMatch of String(html ?? '').matchAll(articlePattern)) {
    const articleHtml = articleMatch[0]
    const sourceUrl = buildAbsoluteUrl(
      extractFirst(/<a[^>]+href="(https:\/\/innovationincubator\.com\/job\/[^"]+\/?)"/i, articleHtml),
    )
    const jobId = extractJobId(sourceUrl)
    const title = stripTags(
      extractFirst(/<h1 class="elementor-heading-title elementor-size-default">([\s\S]*?)<\/h1>/i, articleHtml),
    )
    const headings = [...articleHtml.matchAll(
      /<div class="elementor-heading-title elementor-size-default">([\s\S]*?)<\/div>/gi,
    )].map((match) => stripTags(match[1]))
    const employmentType = normalizeWhitespace(headings[0])
    const location = normalizeLocation(headings[1])
    const rawSkills = stripTags(extractFirst(
      /Key Skills<\/span>\s*<\/div>\s*<\/div>\s*<div[^>]*elementor-widget-text-editor[^>]*>[\s\S]*?<div class="elementor-widget-container">\s*([\s\S]*?)\s*<\/div>/i,
      articleHtml,
    ))
    const experienceRequired = stripTags(extractFirst(
      /Experience<\/span>\s*<\/div>\s*<\/div>\s*<div[^>]*elementor-widget-text-editor[^>]*>[\s\S]*?<div class="elementor-widget-container">\s*([\s\S]*?)\s*<\/div>/i,
      articleHtml,
    ))
    const requiredSkills = (rawSkills || '')
      .split(',')
      .map((skill) => normalizeWhitespace(skill))
      .filter(Boolean)

    if (!title || !sourceUrl || !jobId || !location) continue

    cards.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: extractCity(location),
      // This legacy free-text location is an observation, not an own-role
      // country field. Keep it verbatim until a native contract proves it.
      country: null,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: rawSkills ? `Key Skills: ${rawSkills}` : null,
    })
  }

  return cards
}

export const extractJobDetail = (html, listing = {}) => {
  const title = stripTags(
    extractFirst(/<h2 class="elementor-heading-title elementor-size-default">([\s\S]*?)<\/h2>/i, html),
  ) || listing.title || null
  const detailDescription = extractDescriptionBlock(html)
  const minimumQualification = detailDescription ? extractMinimumQualification(html) : null

  return {
    ...listing,
    title,
    minimumQualification,
    jobDescription: detailDescription,
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

export const createInnovationIncubatorScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    const careers = inspectCareersSurface(careersHtml)
    if (!careers.officialPublisherObserved) throw Object.assign(new Error('Innovation Incubator current careers publisher is unproved'), {
      softFailure: true, abortRetries: true, failureKind: 'coverage_gap', sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    })
    const listings = extractJobCards(careersHtml).filter(listing => careers.unreadJobURLs.includes(listing.sourceUrl))
    const selectedListings = listings.slice(0, Number.isInteger(maxJobs) && maxJobs >= 0 ? Math.min(maxJobs, 32) : 32)
    const jobs = [], heldRoles = [], responses = [{ url: CAREERS_PAGE_URL, bodySHA256: createHash('sha256').update(careersHtml).digest('hex'), body: careersHtml }]

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      responses.push({ url: listing.sourceUrl, bodySHA256: createHash('sha256').update(detailHtml).digest('hex'), body: detailHtml })
      // Neither the current widget nor this legacy card/detail layout declares
      // an own-role country and employer contract. Preserve the observations;
      // their city labels and teasers cannot authorize publishing a vacancy.
      heldRoles.push({ listing, detail, reason: 'own-native-role-country-and-employer-unproved', sourceScopeComplete: false, lifecycleCleanupAllowed: false })
    }
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: { source: SOURCE, recordKind: 'unqualified-careers-observations',
      careers, heldRoles, responses, observedRecordCount: listings.length, observedUnreadLinkCount: careers.unreadJobURLs.length,
      sourceScopeComplete: false, companyReportedTotal: null, indiaReportedTotal: null, lifecycleCleanupAllowed: false }, configurable: true })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CAREERS_PAGE_URL, firstParty: true,
      listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: responses.length, reportedTotal: null,
      indiaFacetCount: null, verifiedAt: now(), reason: 'innovationincubator-current-widget-query-country-and-company-scope-unproved;cleanup-forbidden' })
  },
})

export const run = async (options = {}) => createInnovationIncubatorScraper().run(options)

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
