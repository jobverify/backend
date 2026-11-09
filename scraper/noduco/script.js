import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readNoducoRoleWorksite, visibleNoducoRoleIds } from './roleWorksite.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'noduco'
export const COMPANY = 'Noduco'
export const COMPANY_DOMAIN = 'noduco.com'
export const HOMEPAGE_URL = 'https://noduco.com/'
export const CAREERS_URL = 'https://noduco.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#039;|&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
) || ''

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const extractText = (pattern, html) => normalizeWhitespace((String(html ?? '').match(pattern) || [])[1])

const extractCardSegments = (html) => {
  const page = String(html ?? '')
  const marker = '<div class="reveal job-card"'
  const startIndexes = []
  let searchIndex = 0

  while (true) {
    const startIndex = page.indexOf(marker, searchIndex)
    if (startIndex === -1) break
    startIndexes.push(startIndex)
    searchIndex = startIndex + marker.length
  }

  if (startIndexes.length === 0) return []

  return startIndexes.map((startIndex, index) => {
    const endIndex = index + 1 < startIndexes.length
      ? startIndexes[index + 1]
      : page.length

    return page.slice(startIndex, endIndex)
  })
}

const extractMetaValue = (label, html) => {
  const pattern = new RegExp(
    `<div class="job-meta-item">[\\s\\S]*?<span class="job-sidebar-label">${escapeRegex(label)}<\\/span><span class="job-sidebar-value">([\\s\\S]*?)<\\/span>`,
    'i',
  )

  return extractText(pattern, html)
}

const extractSectionItems = (html) =>
  [...String(html ?? '').matchAll(
    /<h3 class="job-section-title">([\s\S]*?)<\/h3>\s*<ul class="job-section-list">([\s\S]*?)<\/ul>/gi,
  )]
    .map((match) => ({
      title: normalizeWhitespace(match[1]),
      items: [...match[2].matchAll(/<li>([\s\S]*?)<\/li>/gi)]
        .map((itemMatch) => stripTags(itemMatch[1]))
        .filter(Boolean),
    }))
    .filter((section) => section.title && section.items.length > 0)

const buildJobDescription = ({ summary, sections }) => {
  const parts = []

  if (summary) {
    parts.push(summary)
  }

  for (const section of sections) {
    parts.push(
      `${section.title.toUpperCase()}:\n${section.items.map((item) => `- ${item}`).join('\n')}`,
    )
  }

  return parts.join('\n\n') || null
}

export const decodeCloudflareEmail = (value) => {
  const encoded = normalizeWhitespace(value)
  if (!encoded || !/^[0-9a-f]+$/i.test(encoded) || encoded.length < 4) return null

  const key = Number.parseInt(encoded.slice(0, 2), 16)
  let email = ''
  for (let index = 2; index < encoded.length; index += 2) {
    email += String.fromCharCode(Number.parseInt(encoded.slice(index, index + 2), 16) ^ key)
  }

  return email || null
}

const extractApplyUrl = (html) => {
  const encoded = String(html ?? '').match(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/i)?.[1]
  const email = decodeCloudflareEmail(encoded)
  return email ? `mailto:${email}` : null
}

const extractPreferredQualification = (sections) => {
  const preferredSection = sections.find((section) => /nice to have/i.test(section.title))
  if (!preferredSection) return null
  return normalizeWhitespace(preferredSection.items.join(' '))
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return (
    /<title>\s*Noduco Software Engineering Company \| Custom Software &amp; AI Solutions\s*<\/title>/i.test(page)
    && /SOFTWARE ENGINEERING FOR THE ENTERPRISE/i.test(text)
    && /Noduco is a software engineering company\./i.test(text)
    && /href=["']\/careers\/["']/i.test(page)
  )
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return (
    (
      /<title>\s*Join Us, Careers in Software Engineering \| Noduco \| Noduco\s*<\/title>/i.test(page)
      || /<title>\s*Software Engineering Careers\s*&(?:amp;)?\s*Open Roles\s*\|\s*Noduco\s*\|\s*Noduco\s*<\/title>/i.test(page)
    )
    && /VACANCIES/i.test(text)
    && /Open Roles/i.test(text)
    && extractCardSegments(page).length > 0
    && /href=["']\/careers\/\d+\/["']/i.test(page)
  )
}

export const extractCareerJobCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Noduco verified official careers page no longer matches the known public job shell')
  }

  const visibleIds = visibleNoducoRoleIds(html)
  const jobs = extractCardSegments(html).map((segmentHtml) => {
    const detailPath = segmentHtml.match(/href=["'](\/careers\/(\d+)\/)["']/i)
    const title = extractText(/<h3 class="type-title-lg job-title">([\s\S]*?)<\/h3>/i, segmentHtml)
    const department = extractText(/class="type-label-sm job-dept-chip">([\s\S]*?)<\/span>/i, segmentHtml)
    const employmentType = extractText(/class="type-label-sm job-type-text">([\s\S]*?)<\/span>/i, segmentHtml)
    const experienceRequired = extractText(/class="job-experience-highlight">([\s\S]*?)<\/span>/i, segmentHtml)
    const requiredSkills = [...segmentHtml.matchAll(/class="type-label-sm job-tag">([\s\S]*?)<\/span>/gi)]
      .map((match) => stripTags(match[1]))
      .filter(Boolean)
      .filter((value) => !value.startsWith('+'))

    if (!title || !department || !employmentType || !experienceRequired || !detailPath?.[1] || !detailPath?.[2]
      || !visibleIds.has(detailPath[2])) {
      return null
    }

    return {
      jobId: `${SOURCE}-${detailPath[2]}`,
      requisitionId: detailPath[2],
      title,
      company: COMPANY,
      department,
      location: null,
      city: null,
      country: null,
      sourceUrl: buildAbsoluteUrl(detailPath[1], HOMEPAGE_URL),
      applyUrl: null,
      employmentType,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    }
  }).filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Noduco verified official careers page no longer exposes public role cards')
  }

  return jobs
}

export const extractJobDetail = (html, listing) => {
  const title = extractText(/<h1 class="job-title-display[^"]*">([\s\S]*?)<\/h1>/i, html) || listing?.title
  const department = extractMetaValue('Department', html) || listing?.department || null
  const experienceRequired = extractMetaValue('Experience', html) || listing?.experienceRequired || null
  const employmentType = extractMetaValue('Type', html) || listing?.employmentType || null
  const summary = extractText(/<p class="job-section-text"[^>]*>([\s\S]*?)<\/p>/i, html)
  const sections = extractSectionItems(html)
  const applyUrl = extractApplyUrl(html)
  const { visibleCriteria, visibleContent, ...worksite } = readNoducoRoleWorksite(html, listing, summary)
  const visibleDescription = buildJobDescription(visibleContent)
  const complete = visibleCriteria && Boolean(extractActiveDescription(visibleDescription))

  if (!title) {
    throw new Error(`Noduco detail page no longer exposes a job title for ${listing?.sourceUrl || 'unknown job'}`)
  }

  if (!applyUrl) {
    throw new Error(`Noduco detail page no longer exposes an apply email for ${listing?.sourceUrl || title}`)
  }

  if (sections.length === 0) {
    throw new Error(`Noduco detail page no longer exposes sectioned content for ${listing?.sourceUrl || title}`)
  }

  return {
    ...listing,
    title,
    department,
    employmentType,
    experienceRequired,
    applyUrl,
    minimumQualification: null,
    preferredQualification: extractPreferredQualification(visibleContent.sections),
    jobDescription: visibleDescription,
    rawNativeRoleEvidence: { contentJobDescription: buildJobDescription({ summary, sections }), contentHtml: String(html) },
    ...worksite,
    sourceDetailComplete: complete,
    publicExperienceChecked: complete,
    ...(!complete ? { sourceDetailFailureKind: 'missing-content' } : {}),
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

export const createNoducoScraper = ({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) => ({
  run: async ({ fetchText: overrideFetchText, now: overrideNow, signal } = {}) => {
    const fetchImpl = overrideFetchText || fetchText
    const read = async url => { signal?.throwIfAborted(); const html = await fetchImpl(url, { signal }); signal?.throwIfAborted(); return html }

    const homepageHtml = await read(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Noduco verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await read(CAREERS_URL)
    const listings = extractCareerJobCards(careersHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await read(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        company: COMPANY,
        source: SOURCE,
        companyCareerPage: CAREERS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: 'official-company-careers',
        link: detail.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      })
    }

    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: listings.length,
      observedVacancyCount: listings.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: CAREERS_URL, firstParty: true,
      listingComplete: false, pagesFetched: 2 + jobs.length, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: null, reason: 'noduco-native-vacancy-observations-company-scope-unconfirmed;closing-not-read' })
  },
})

export const run = async (options = {}) => createNoducoScraper().run(options)

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
