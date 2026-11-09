import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_URL = 'https://careers.soprasteria.in/jobs'
export const COMPANY = 'Sopra Steria'
export const SOURCE = 'soprasteria'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripTags = (value) => String(value ?? '')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, ' ')
  .replace(/<li\b[^>]*>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(stripTags(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const getCardStartIndexes = (html) => [...String(html ?? '').matchAll(/<div class="attrax-vacancy-tile\b/gi)]
  .map((match) => match.index)

const splitJobCards = (html) => {
  const pageHtml = String(html ?? '')
  const indexes = getCardStartIndexes(pageHtml)

  return indexes.map((start, index) => {
    const end = indexes[index + 1] ?? pageHtml.length
    return pageHtml.slice(start, end)
  })
}

const extractTitleAndUrl = (cardHtml) => {
  const match = /<a[^>]*class="[^"]*attrax-vacancy-tile__title[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(cardHtml)
  return {
    sourceUrl: toAbsoluteUrl(match?.[1]),
    title: normalizeWhitespace(match?.[2]),
  }
}

const extractLabeledValues = (cardHtml) => {
  const values = new Map()
  const pattern = /<p[^>]*class="[^"]*attrax-vacancy-tile__item-label[^"]*"[^>]*>([\s\S]*?)<\/p>[\s\S]*?<p[^>]*class="[^"]*attrax-vacancy-tile__item-value[^"]*"[^>]*>([\s\S]*?)<\/p>/gi

  for (const match of cardHtml.matchAll(pattern)) {
    const label = normalizeWhitespace(match[1])?.toLowerCase()
    const value = normalizeWhitespace(match[2])

    if (!label || !value) continue

    const existing = values.get(label) ?? []
    existing.push(value)
    values.set(label, existing)
  }

  return values
}

const getFieldValues = (fields, ...labels) => labels.flatMap((label) => fields.get(label.toLowerCase()) ?? [])

const getFirstFieldValue = (fields, ...labels) => getFieldValues(fields, ...labels).find(Boolean) ?? null

const extractJobId = (cardHtml, sourceUrl) =>
  /data-jobid="(\d+)"/i.exec(cardHtml)?.[1]
  || /vacancyId=(\d+)/i.exec(cardHtml)?.[1]
  || /jid-(\d+)/i.exec(sourceUrl ?? '')?.[1]
  || null

const normalizeClosingDate = (value) => {
  const normalized = normalizeWhitespace(value)

  if (!normalized) return null
  if (/^(?:0?1\/0?1\/0*1|jan\s+1,\s+0*1)$/i.test(normalized)) return null

  return normalized
}

const locationImpliesIndia = (value) => /\bindia\b/i.test(value ?? '')

const getNormalizedLocation = (fields, cardHtml, sourceUrl) => {
  const locationValues = getFieldValues(fields, 'location')
  const location = locationValues.find(locationImpliesIndia)
    || locationValues[0]
    || null

  if (!location) return null
  if (locationImpliesIndia(location)) return location
  if (/attrax-vacancy-tile--india\b/i.test(cardHtml) || /-india-jid-\d+/i.test(sourceUrl ?? '')) {
    return `${location}, India`
  }

  return location
}

const extractCity = (location) => normalizeWhitespace(String(location ?? '').split(',')[0])

const isIndiaCard = (cardHtml, location, sourceUrl) =>
  /attrax-vacancy-tile--india\b/i.test(cardHtml)
  || locationImpliesIndia(location)
  || /-india-jid-\d+/i.test(sourceUrl ?? '')

const hasOfficialSearchPageShape = (html) => /Sopra Steria/i.test(html)
  && /attrax-vacancy-tile/i.test(html)

const hasOfficialDetailPageShape = (html) => /Sopra Steria/i.test(html)
  && /(jobApplyBtn|\/Workflow\?workflowId=)/i.test(html)

const maskOpaqueHtml = (html) => {
  // Ignore tag-shaped script, stylesheet and comment data while preserving
  // offsets into the original HTML for the matching element boundary.
  return String(html ?? '').replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    value => ' '.repeat(value.length))
}

const getHtmlTags = (html) =>
  [...maskOpaqueHtml(html).matchAll(/<\/?([a-z][\w:-]*)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)]

const getClassNames = (tagHtml) => {
  const attributes = tagHtml.replace(/^<\/?[a-z][\w:-]*/i, '').slice(0, -1)
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/g
  for (const attribute of attributes.matchAll(pattern)) {
    if (attribute[1].toLowerCase() === 'class') {
      return (attribute[2] ?? attribute[3] ?? attribute[4] ?? '').split(/\s+/)
    }
  }
  return []
}

const extractElementAtTag = (pageHtml, tags, startIndex) => {
  if (startIndex === -1) return null
  const first = tags[startIndex]
  let depth = 1
  for (const tag of tags.slice(startIndex + 1)) {
    if (tag[1].toLowerCase() !== first[1].toLowerCase()) continue
    if (/^<\//.test(tag[0])) depth--
    else if (!/\/\s*>$/.test(tag[0])) depth++
    if (depth === 0) {
      const end = tag.index + tag[0].length
      return {
        html: pageHtml.slice(first.index, end),
        content: pageHtml.slice(first.index + first[0].length, tag.index),
        end,
      }
    }
  }
  return null
}

const extractElementByClass = (html, className) => {
  const pageHtml = String(html ?? '')
  const tags = getHtmlTags(pageHtml)
  const startIndex = tags.findIndex(tag => !/^<\//.test(tag[0])
    && getClassNames(tag[0]).includes(className))
  return extractElementAtTag(pageHtml, tags, startIndex)
}

const extractDescriptionWidgetHtml = html => extractElementByClass(html, 'description-widget')?.html ?? null

const normalizeVisibleHtml = (html) => {
  const markup = maskOpaqueHtml(html)
  const pieces = []
  let cursor = 0
  for (const tag of getHtmlTags(markup)) {
    pieces.push(markup.slice(cursor, tag.index), ' ')
    cursor = tag.index + tag[0].length
  }
  pieces.push(markup.slice(cursor))
  return decodeHtmlEntities(pieces.join('')).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() || null
}

const extractQualifications = (widgetHtml) => {
  if (!widgetHtml) return []
  const qualification = extractElementByClass(widgetHtml, 'jobad-qualifications')
  if (!qualification) return []
  let section = qualification.content
  if (/^qualifications?\s*:?\s*$/i.test(normalizeVisibleHtml(section) ?? '')) {
    // Attrax can render a heading followed by paragraphs instead of a list.
    // Stop at the next employer section rather than scanning the whole page.
    section = widgetHtml.slice(qualification.end)
    const boundary = getHtmlTags(section).find(tag => !/^<\//.test(tag[0])
      && (/^h[1-6]$/i.test(tag[1])
        || getClassNames(tag[0]).some(name => /^jobad-(?:companydescription|jobdescription|additionalinformation|additional-information|qualifications)$/i.test(name))))
    if (boundary) section = section.slice(0, boundary.index)
  }
  const tags = getHtmlTags(section)
  const items = []
  let cursor = 0
  for (const [index, tag] of tags.entries()) {
    if (tag.index < cursor || /^<\//.test(tag[0]) || !/^(li|p)$/i.test(tag[1])) continue
    const item = extractElementAtTag(section, tags, index)
    if (!item) continue
    const text = normalizeVisibleHtml(item.content)
    if (text) items.push(text)
    cursor = item.end
  }
  if (items.length) return [...new Set(items)]
  const text = normalizeVisibleHtml(section)?.replace(/^qualifications?\b\s*:?\s*/i, '').trim()
  return text ? [text] : []
}

export const buildSearchPageUrl = (page = 1) => {
  const normalizedPage = Math.max(1, Number(page) || 1)
  return `${CAREERS_URL}?page=${normalizedPage}`
}

export const extractTotalPages = (html) => {
  const pageNumbers = [...String(html ?? '').matchAll(/(?:\?|&)page=(\d+)/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite)

  if (!pageNumbers.length) {
    return splitJobCards(html).length ? 1 : 0
  }

  return Math.max(...pageNumbers)
}

export const extractSearchResults = (html) => splitJobCards(html)
  .map((cardHtml) => {
    const { title, sourceUrl } = extractTitleAndUrl(cardHtml)
    const fields = extractLabeledValues(cardHtml)
    const location = getNormalizedLocation(fields, cardHtml, sourceUrl)
    const jobId = extractJobId(cardHtml, sourceUrl)

    if (!isIndiaCard(cardHtml, location, sourceUrl)) return null
    if (!title || !sourceUrl || !location || !jobId) return null

    return {
      title,
      company: COMPANY,
      department: getFirstFieldValue(fields, 'department', 'job family'),
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: getFirstFieldValue(fields, 'reference', 'requisition id', 'req id') || jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: getFirstFieldValue(fields, 'job type', 'type of contract', 'employment type'),
      experienceRequired: getFirstFieldValue(fields, 'experience level', 'experience'),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: normalizeClosingDate(getFirstFieldValue(fields, 'expiry date', 'closing date')),
      jobDescription: getFirstFieldValue(fields, 'description'),
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const descriptionWidgetHtml = extractDescriptionWidgetHtml(html)
  const requiredSkills = extractQualifications(descriptionWidgetHtml)

  return {
    ...listing,
    applyUrl: toAbsoluteUrl(
      /<a[^>]*href="([^"]*\/Workflow\?workflowId=[^"]+)"/i.exec(html)?.[1]
        || /<a[^>]*class="[^"]*jobApplyBtn[^"]*"[^>]*href="([^"]+)"/i.exec(html)?.[1],
    ) || listing.applyUrl,
    minimumQualification: requiredSkills[0] || listing.minimumQualification || null,
    requiredSkills: requiredSkills.length ? requiredSkills : listing.requiredSkills || [],
    jobDescription: normalizeVisibleHtml(descriptionWidgetHtml) || listing.jobDescription || null,
  }
}

const defaultFetchText = async (url) => fetchTextWithRetry(url, {
  label: 'soprasteria fetch',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
})

export const createSopraSteriaScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run() {
    const firstPageHtml = await fetchText(buildSearchPageUrl(1))
    if (!hasOfficialSearchPageShape(firstPageHtml)) {
      throw new Error('Response is not the official Sopra Steria jobs page')
    }

    const totalPages = extractTotalPages(firstPageHtml)
    const pageLimit = Math.min(totalPages || 1, maxPages)
    const jobs = []
    const seenJobIds = new Set()

    for (let page = 1; page <= pageLimit; page += 1) {
      const pageHtml = page === 1
        ? firstPageHtml
        : await fetchText(buildSearchPageUrl(page))
      const listings = extractSearchResults(pageHtml)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        let job = listing

        try {
          const detailHtml = await fetchText(listing.sourceUrl)
          if (hasOfficialDetailPageShape(detailHtml)) {
            job = extractJobDetail(detailHtml, listing)
          }
        } catch {
          job = listing
        }

        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }
    }

    return jobs
  },
})

export const run = async () => createSopraSteriaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Sopra Steria scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
