import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readJoshNativeRoleFields } from './nativeRoleFields.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'joshtechnologygroup'
export const COMPANY = 'Josh Technology Group'
export const HOMEPAGE_URL = 'https://www.joshtechnologygroup.com/'
export const CAREERS_URL = 'https://www.joshtechnologygroup.com/careers/'

const COMPANY_DOMAIN = 'joshtechnologygroup.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8217;|&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(
    String(value ?? '')
      .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const absoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const cleanBulletText = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/^[•●\-]+\s*/u, '')
    .replace(/(\d)\s*-\s*(\d)/g, '$1-$2')
    .replace(/\s*\(WFO\)\s*$/i, '')
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeLocation = (value) => {
  const cleaned = cleanBulletText(value)
    .replace(/\s*[-–]\s*work\s+from\s+office\s*$/i, '')
    .replace(/\s*work\s+from\s+office\s*$/i, '')
    .replace(/\s*remote\s*$/i, ' Remote')
    .trim()

  if (!cleaned) return { location: null, city: null }

  const baseLocation = cleaned.endsWith(', India') ? cleaned : `${cleaned}, India`
  const city = cleaned
    .replace(/\s+Remote$/i, '')
    .split(/[\/,]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)[0] || null

  return {
    location: baseLocation,
    city,
  }
}

const buildJobId = (title) => `${SOURCE}-${slugify(title)}`

const extractCurrentOpeningsSection = (html) => {
  const match = String(html ?? '').match(
    /<section id="current-openings">([\s\S]*?)<\/section>/i,
  )
  return match?.[1] || ''
}

const extractDetailOpeningsSection = (html) => {
  const match = String(html ?? '').match(
    /<div class="career-list__openings">([\s\S]*?)<a class="btn--solid apply-now-clone-btn"/i,
  )
  return match?.[1] || ''
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => cleanBulletText(stripTags(match[1])))
  .filter(Boolean)

const extractParagraphs = (html) => [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((match) => cleanBulletText(stripTags(match[1])))
  .filter(Boolean)

const extractLabeledValue = (html, labels) => {
  for (const label of labels) {
    const inlinePattern = new RegExp(
      `<p>\\s*<strong>\\s*${escapeRegExp(label)}(?:[:\\s]|&nbsp;)*<\\/strong>\\s*([\\s\\S]*?)<\\/p>`,
      'i',
    )
    const inlineMatch = inlinePattern.exec(String(html ?? ''))
    if (inlineMatch) {
      const value = cleanBulletText(stripTags(inlineMatch[1]))
      if (value) return value
    }

    const blockPattern = new RegExp(
      `<p>\\s*<strong>\\s*${escapeRegExp(label)}(?:[:\\s]|&nbsp;)*<\\/strong>\\s*<\\/p>\\s*<p>([\\s\\S]*?)<\\/p>`,
      'i',
    )
    const blockMatch = blockPattern.exec(String(html ?? ''))
    if (blockMatch) {
      const value = cleanBulletText(stripTags(blockMatch[1]))
      if (value) return value
    }
  }

  return null
}

const extractSectionBlock = (html, labels) => {
  for (const label of labels) {
    const pattern = new RegExp(
      `<p>\\s*<strong>${escapeRegExp(label)}:?\\s*<\\/strong>\\s*<\\/p>([\\s\\S]*?)(?=<p>\\s*<strong>|$)`,
      'i',
    )
    const match = pattern.exec(String(html ?? ''))
    if (match) return match[1]
  }

  return ''
}

const extractParagraphSectionValues = (html, labels) =>
  extractParagraphs(extractSectionBlock(html, labels))

const extractDescription = (html) => {
  const descriptionItems = extractParagraphSectionValues(html, ['Job Description'])
  const responsibilityItems = extractListItems(
    extractSectionBlock(html, ['Core Responsibilities']),
  )
  const items = [...descriptionItems, ...responsibilityItems].filter(Boolean)

  return items.length > 0 ? items.join(' ') : null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Home\s*-\s*Josh Technology Group\s*<\/title>/i.test(page)
    && /Creating and Transforming Companies/i.test(text)
    && /Pioneers of Modern Development/i.test(text)
    && /href="https:\/\/www\.joshtechnologygroup\.com\/careers\/"/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Career Openings Archive\s*-\s*Josh Technology Group\s*<\/title>/i.test(page)
    && /<section id="current-openings">/i.test(page)
    && /<h2 class="career-list__department">JTGxPOD Hirings<\/h2>/i.test(page)
    && /<h2 class="career-list__department">Technical Delivery<\/h2>/i.test(page)
    && /Inside Sales Strategist @PODxJTG/i.test(page)
    && /Software Developer \(PHP &#038; Magento\)/i.test(page)
}

export const extractListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Josh Technology Group verified official careers surface changed or disappeared')
  }

  const sectionHtml = extractCurrentOpeningsSection(html)
  const items = []
  let currentDepartment = null
  const tokenPattern = /<h2 class="career-list__department">([\s\S]*?)<\/h2>|<a href="([^"]+)" class="career-list__opening flex space-between"><p>([\s\S]*?)<\/p>\s*<span>Apply<\/span>\s*<\/a>/gi

  for (const match of sectionHtml.matchAll(tokenPattern)) {
    if (match[1]) {
      currentDepartment = stripTags(match[1])
      continue
    }

    const sourceUrl = absoluteUrl(match[2])
    const title = cleanBulletText(stripTags(match[3]))
    if (!currentDepartment || !sourceUrl || !title) {
      throw new Error('Josh Technology Group verified official careers surface changed or disappeared')
    }

    // The exact advertised URL supplies a stable observation key, not a native requisition.
    const jobId = SOURCE + '-' + new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1)
    items.push({
      title,
      company: COMPANY,
      department: currentDepartment,
      location: null,
      city: null,
      country: null,
      jobId,
      requisitionId: null,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    })
  }

  if (items.length === 0) {
    throw new Error('Josh Technology Group verified official careers surface changed or disappeared')
  }

  return items
}

export const extractJobDetail = (html, listing = {}) => {
  const page = String(html ?? '')
  const native = readJoshNativeRoleFields(page, listing)
  const title = cleanBulletText(stripTags(
    page.match(/<span class="career-list__title flex-align-center">\s*([\s\S]*?)\s*<\/span>/i)?.[1],
  )) || listing.title || null
  const canonicalUrl = page.match(/<link rel="canonical" href="([^"]+)"/i)?.[1] || listing.sourceUrl || null
  const hiddenCareerLink = page.match(/<input type="hidden" name="career-link" id="career_link" value="([^"]+)"/i)?.[1]
  const openingsHtml = extractDetailOpeningsSection(page)

  if (
    !title
    || !canonicalUrl
    || !hiddenCareerLink
    || normalizeWhitespace(hiddenCareerLink) !== normalizeWhitespace(canonicalUrl)
    || !openingsHtml
    || !/Apply Now/i.test(page)
  ) {
    throw new Error('Josh Technology Group verified first-party detail page changed materially')
  }

  const experienceRequired = extractLabeledValue(openingsHtml, ['Required Experience', 'Experience'])
  const minimumQualification = extractLabeledValue(openingsHtml, ['Qualifications', 'Required Qualifications'])
  const locationInfo = normalizeLocation(
    extractLabeledValue(openingsHtml, ['Work Location']),
  )
  const requiredSkillsBlock = extractSectionBlock(openingsHtml, ['What are we looking for in you?', 'Required Skill-Set'])
  const requiredSkills = [
    ...extractListItems(requiredSkillsBlock),
    ...extractParagraphs(requiredSkillsBlock),
  ].filter(Boolean)
  const jobDescription = extractDescription(openingsHtml)

  return {
    ...listing,
    title,
    sourceUrl: canonicalUrl,
    applyUrl: canonicalUrl,
    location: locationInfo.location || listing.location || null,
    city: locationInfo.city || listing.city || null,
    experienceRequired: experienceRequired || listing.experienceRequired || null,
    minimumQualification: minimumQualification || listing.minimumQualification || null,
    preferredQualification: listing.preferredQualification || null,
    requiredSkills,
    jobDescription: jobDescription || listing.jobDescription || null,
    ...native,
    experienceRequired: native.experienceRequired || experienceRequired || null,
    minimumQualification: minimumQualification || native.minimumQualification || null,
  }
}

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  attempts: 1,
  signal: options.signal,
})

export const createJoshTechnologyGroupScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString(), signal } = {}) {
    const read = async url => { signal?.throwIfAborted(); const html = await fetchText(url, { signal }); signal?.throwIfAborted(); return html }
    const homepageHtml = await read(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Josh Technology Group verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await read(CAREERS_URL)
    const listings = extractListings(careersHtml)
    const selectedListings = Number.isInteger(maxJobs) ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await read(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
        companyCareerPage: CAREERS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
      })
    }

    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: listings.length,
      observedVacancyCount: listings.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: CAREERS_URL, firstParty: true,
      listingComplete: false, pagesFetched: 2 + selectedListings.length, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: null, reason: 'josh-native-vacancy-observations-company-scope-unconfirmed;closing-not-read'
        + (selectedListings.length < listings.length ? ';output-cap' : '') })
  },
})

export const run = async (options = {}) => createJoshTechnologyGroupScraper().run(options)

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
