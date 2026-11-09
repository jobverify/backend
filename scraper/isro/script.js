import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'isro'
export const COMPANY = 'ISRO'
export const HOMEPAGE_URL = 'https://www.isro.gov.in/'
export const CAREERS_URL = 'https://www.isro.gov.in/Careers.html'
export const CURRENT_OPPORTUNITIES_URL = 'https://www.isro.gov.in/CurrentOpportunities.html'
export const VIEW_ALL_OPPORTUNITIES_URL = 'https://www.isro.gov.in/ViewAllOpportunities.html'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeKey = (value) => normalizeWhitespace(value).replace(/\s+/g, '').toLowerCase()

const stripTags = (value) => normalizeWhitespace(String(value ?? ''))

const toAbsoluteUrl = (href, baseUrl) => {
  if (!href) return null

  try {
    return new URL(href, baseUrl).toString().replace(/^http:/i, 'https:')
  } catch {
    return null
  }
}

const parseIsoDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const numericMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (numericMatch) {
    const [, day, month, year] = numericMatch
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString().slice(0, 10)
  }

  const parsed = new Date(`${normalized} UTC`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const compareIsoDates = (left, right) => {
  if (!left || !right) return null
  if (left === right) return 0
  return left > right ? 1 : -1
}

const normalizeCity = (value) => {
  const text = stripTags(value)
  if (!text) return null

  const parts = text.split(/\s*\/\s*/).map((part) => part.trim()).filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : text
}

const normalizeDetailText = (value) => stripTags(value)

const getCurrentDateIso = (date = new Date()) => {
  const normalized = new Date(date)
  return new Date(Date.UTC(
    normalized.getUTCFullYear(),
    normalized.getUTCMonth(),
    normalized.getUTCDate(),
  )).toISOString().slice(0, 10)
}

export const hasHomepageSignal = (html) =>
  /<a[^>]+href=["'](?:https:\/\/www\.isro\.gov\.in\/)?Careers\.html["']/i.test(String(html ?? ''))
  || /CAREERS[\s\S]{0,160}prestigious space agency/i.test(String(html ?? ''))

export const hasCareersPageSignal = (html) => {
  const page = String(html ?? '')
  return /Current opportunities/i.test(page)
    && (
      /View All Current Opportunities/i.test(page)
      || /CurrentOpportunities\.html/i.test(page)
      || /CareerOpportunities\.html/i.test(page)
      || /Recruitment Notice/i.test(page)
    )
    && (
      /ViewAllOpportunities\.html/i.test(page)
      || /Read more/i.test(page)
    )
}

export const hasCurrentOpportunitiesSignal = (html) =>
  /Current Opportunities/i.test(String(html ?? ''))
  && /View All Current Opportunities/i.test(String(html ?? ''))

export const hasViewAllOpportunitiesSignal = (html) =>
  /<tbody class="list">/i.test(String(html ?? ''))
  && /Location/i.test(String(html ?? ''))
  && /Post/i.test(String(html ?? ''))
  && /Advertisement Number/i.test(String(html ?? ''))
  && /More Details/i.test(String(html ?? ''))

const CURRENT_OPPORTUNITY_ROW_PATTERN =
  /<tr>\s*<td class="location">([\s\S]*?)<\/td>\s*<td class="post">([\s\S]*?)<\/td>\s*<td class="advNo">([\s\S]*?)<\/td>\s*<td class="openDate">([\s\S]*?)<\/td>\s*<td class="closeDate">([\s\S]*?)<\/td>\s*<td class="moreDetails">[\s\S]*?<button[^>]+onclick="window\.location\.href='([^']+)'(?:;)?;"?[\s\S]*?<\/tr>/gi

const DETAIL_DIRECT_LINK_PATTERN =
  /outsideAlert\('([^']+)'\)/i

const DETAIL_PDF_LINK_PATTERN =
  /<a[^>]+href=["']([^"']+)["'][^>]*title=["']Bilingual Advertisement["']/i

export const extractCurrentOpportunityRows = (html) => [...String(html ?? '').matchAll(CURRENT_OPPORTUNITY_ROW_PATTERN)]
  .map((match) => {
    const detailPath = stripTags(match[6])
    const detailUrl = toAbsoluteUrl(detailPath, VIEW_ALL_OPPORTUNITIES_URL)
    return {
      location: stripTags(match[1]),
      post: stripTags(match[2]),
      requisitionId: stripTags(match[3]),
      postingDate: parseIsoDate(match[4]),
      closingDate: parseIsoDate(match[5]),
      detailPath,
      detailUrl,
      sourceUrl: VIEW_ALL_OPPORTUNITIES_URL,
    }
  })
  .filter((row) => row.post && row.requisitionId && row.postingDate && row.closingDate && row.detailUrl)

export const parseDetailPage = (html, detailUrl = VIEW_ALL_OPPORTUNITIES_URL) => {
  const page = String(html ?? '')
  const document = readVisibleNativeDocument(page, { strict: true })
  const fields = { advertisementNumber: [], status: [], location: [] }
  const labels = {
    advertisementNumber: /(?:^|\/)\s*Advertisement Number\s*:?\s*$/i,
    status: /(?:^|\/)\s*Status\s*:?\s*$/i,
    location: /(?:^|\/)\s*Location\s*:?\s*$/i,
  }
  for (const row of document.nodes(node => node.tag === 'tr' && !node.inert)) {
    const cells = row.children.filter(node => typeof node !== 'string' && node.tag === 'td' && !node.inert)
    for (let index = 0; index + 1 < cells.length; index++) {
      const label = document.text(cells[index])
      for (const [field, pattern] of Object.entries(labels)) {
        if (pattern.test(label)) fields[field].push(normalizeDetailText(document.text(cells[index + 1])))
      }
    }
  }
  const one = field => fields[field].length === 1 ? fields[field][0] : ''
  const advertisementNumber = one('advertisementNumber'), status = one('status'), location = one('location')
  const directLink = page.match(DETAIL_DIRECT_LINK_PATTERN)?.[1] || null
  const pdfLink = page.match(DETAIL_PDF_LINK_PATTERN)?.[1] || null

  return {
    advertisementNumber,
    status,
    location,
    directLink: directLink ? toAbsoluteUrl(directLink, detailUrl) : null,
    pdfLink: pdfLink ? toAbsoluteUrl(pdfLink, detailUrl) : null,
    isOpen: /^Open(?:\s*\/\s*खुला)?$/i.test(status),
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isActiveOpportunity = (row, asOfDateIso) =>
  compareIsoDates(row.closingDate, asOfDateIso) >= 0

const parseJobLocation = (detailLocation, rowLocation) => {
  const resolvedLocation = normalizeCity(detailLocation) || normalizeCity(rowLocation) || null
  if (!resolvedLocation) {
    return {
      city: null,
      location: 'India',
    }
  }

  return {
    city: resolvedLocation,
    location: `${resolvedLocation}, India`,
  }
}

const toJobId = (advertisementNumber) => `isro-${normalizeKey(advertisementNumber).replace(/[^a-z0-9]+/g, '-')}`

export const extractOpenOpportunities = (html, { asOfDate = new Date() } = {}) => {
  const asOfDateIso = getCurrentDateIso(asOfDate)

  return extractCurrentOpportunityRows(html)
    .filter((row) => isActiveOpportunity(row, asOfDateIso))
}

export const createIsroScraper = (options = {}) => {
  const {
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    asOfDate = new Date(),
  } = options

  return {
    async run(runOptions = {}) {
      const transport = runOptions.fetchText || defaultFetchText
      const fetchText = async url => {
        runOptions.signal?.throwIfAborted()
        const html = await transport(url, {signal:runOptions.signal})
        runOptions.signal?.throwIfAborted()
        return html
      }
      runOptions.signal?.throwIfAborted()

      const homepage = await fetchText(HOMEPAGE_URL)
      if (!hasHomepageSignal(homepage)) {
        throw new Error('ISRO verified homepage no longer links to the careers surface')
      }

      const careersPage = await fetchText(CAREERS_URL)
      if (!hasCareersPageSignal(careersPage)) {
        throw new Error('ISRO careers page no longer exposes the verified current opportunities links')
      }

      const currentOpportunitiesPage = await fetchText(CURRENT_OPPORTUNITIES_URL)
      if (!hasCurrentOpportunitiesSignal(currentOpportunitiesPage)) {
        throw new Error('ISRO current opportunities page no longer exposes the verified public careers surface')
      }

      const allOpportunitiesPage = await fetchText(VIEW_ALL_OPPORTUNITIES_URL)
      if (!hasViewAllOpportunitiesSignal(allOpportunitiesPage)) {
        throw new Error('ISRO view-all opportunities page no longer exposes the verified table surface')
      }

      const asOfDateIso = getCurrentDateIso(asOfDate)
      const rows = extractCurrentOpportunityRows(allOpportunitiesPage)
        .filter((row) => isActiveOpportunity(row, asOfDateIso))

      const jobs = []

      for (const row of rows) {
        const detailHtml = await fetchText(row.detailUrl)
        const detail = parseDetailPage(detailHtml, row.detailUrl)

        if (!detail.isOpen) {
          throw new Error(`ISRO detail page for ${row.requisitionId} no longer reports an open status`)
        }

        if (
          !detail.advertisementNumber
          || normalizeKey(detail.advertisementNumber) !== normalizeKey(row.requisitionId)
        ) {
          throw new Error(`ISRO detail page for ${row.requisitionId} no longer matches the consolidated listing`)
        }

        const { city, location } = parseJobLocation(detail.location, row.location)
        const applyUrl = detail.directLink || detail.pdfLink || row.detailUrl
        const job = {
          title: row.post,
          company: COMPANY,
          department: null,
          location,
          city,
          state: null,
          country: 'India',
          jobId: toJobId(row.requisitionId),
          requisitionId: row.requisitionId,
          sourceUrl: row.detailUrl,
          applyUrl,
          employmentType: null,
          experienceRequired: null,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: row.postingDate,
          closingDate: row.closingDate,
          jobDescription: 'Official ISRO recruitment notice. Review the advertisement for eligibility, application, and selection details.',
          sourceDetailComplete: false,
          sourceListingComplete: false,
          sourceScopeComplete: false,
          lifecycleCleanupAllowed: false,
          source: SOURCE,
          link: applyUrl,
          scrapedAt: new Date().toISOString(),
        }

        jobs.push(job)
      }

      const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
      return attachInventoryEvidence(selectedJobs, {
        status: 'discovery-only', firstParty: true, listingComplete: false,
        surface: VIEW_ALL_OPPORTUNITIES_URL, pagesFetched: 4 + rows.length,
        reportedTotal: null, indiaFacetCount: null, verifiedAt: new Date().toISOString(),
        reason: 'isro-current-recruitment-notices:full-role-criteria-require-native-advertisement-review',
      })
    },
  }
}

export const run = async (options = {}) => createIsroScraper(options).run(options)

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
