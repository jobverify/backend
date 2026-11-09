import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'arihantmaxselltechnologiespvtltd'
export const COMPANY = 'Arihant Maxsell Technologies Pvt Ltd'
export const HOMEPAGE_URL = 'https://maxsell.co.in/'
export const CAREERS_URL = 'https://maxsell.co.in/careers/'
export const CURRENT_OPENINGS_URL = 'https://maxsell.co.in/current-openings/'
export const CURRENT_OPENINGS_SITEMAP_URL = 'https://maxsell.co.in/current-opening-sitemap.xml'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CITY_PATTERNS = Object.entries(CANONICAL_CITIES)
  .filter(([, canonical]) => canonical !== 'Remote' && canonical !== 'None')
  .map(([raw, canonical]) => ({
    canonical,
    pattern: new RegExp(`(^|[^a-z])${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^a-z]|$)`, 'i'),
  }))

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#8216;|&#8217;|&apos;|&rsquo;|&lsquo;/gi, "'")
  .replace(/&#8220;|&#8221;|&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractSurfaceHtml = (html) =>
  String(html ?? '').match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
  || String(html ?? '').match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
  || String(html ?? '')

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|a|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const htmlToTextLines = (html) =>
  decodeHtml(extractSurfaceHtml(html))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|a|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const toAbsoluteUrl = (value, baseUrl = CURRENT_OPENINGS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const slugFromUrl = (value) => {
  try {
    return new URL(value).pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const buildJobId = (sourceUrl) => {
  const slug = slugFromUrl(sourceUrl) || 'role'
  return `${SOURCE}-${slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`
}

const isOfficialCurrentOpeningUrl = (value) => {
  try {
    const url = new URL(value)
    return url.hostname.replace(/^www\./i, '').toLowerCase() === 'maxsell.co.in'
      && /^\/current-opening\/[^/?#]+\/?$/i.test(url.pathname)
  } catch {
    return false
  }
}

const isFilledRole = (value) => /vacancy filled|do not apply|filled/i.test(String(value ?? ''))

const detectCanonicalCity = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null

  for (const { canonical, pattern } of CITY_PATTERNS) {
    if (pattern.test(normalized)) return canonical
  }

  return null
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  for (const part of normalized.split(',').map((item) => item.trim()).filter(Boolean)) {
    const city = detectCanonicalCity(part)
    if (city) return city
  }

  return detectCanonicalCity(normalized)
}

const extractText = (pattern, html) => stripTags(pattern.exec(String(html ?? ''))?.[1] ?? null)

const extractCurrentOpeningsUrl = (html) => {
  const match = String(html ?? '').match(/<a[^>]+href=["']([^"']*\/current-openings\/?)["'][^>]*>[\s\S]*?Check Openings[\s\S]*?<\/a>/i)
  return toAbsoluteUrl(match?.[1], CAREERS_URL)
}

const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/maxsell\.co\.in\/["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Maxsell["']/i.test(page)
    && /Arihant Park 1st Floor/i.test(page)
}

const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers at Maxsell\b/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/maxsell\.co\.in\/careers\/["']/i.test(page)
    && /Current\s*<span[^>]*>\s*Openings\s*<\/span>/i.test(page)
}

const hasOfficialCurrentOpeningsSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Current Job Openings at Maxsell India\b/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/maxsell\.co\.in\/current-openings\/["']/i.test(page)
    && /data-elementor-type=["']loop-item["']/i.test(page)
    && /href=["']https:\/\/maxsell\.co\.in\/current-opening\/[^"']+\/["']/i.test(page)
    && /Apply Now/i.test(page)
}

const hasOfficialCurrentOpeningsShellSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Current Job Openings at Maxsell India\b/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/maxsell\.co\.in\/current-openings\/["']/i.test(page)
    && /<h1[^>]*>\s*Current Openings\s*<\/h1>/i.test(page)
}

const hasOfficialJobDetailSignal = (html, sourceUrl) => {
  const page = String(html ?? '')
  const canonicalPattern = new RegExp(
    `<link[^>]+rel=["']canonical["'][^>]+href=["']${String(sourceUrl ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
    'i',
  )

  return canonicalPattern.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Maxsell["']/i.test(page)
    && (
      (
        /<form[^>]+class=["'][^"']*\belementor-form\b[^"']*["'][^>]*name=["']Apply Now Form["']/i.test(page)
        && /<strong>\s*Position:\s*<\/strong>/i.test(page)
      )
      || /<h1[^>]+class=["'][^"']*\bentry-title\b[^"']*["'][^>]*>/i.test(page)
    )
}

const isControlLine = (value) => /^(?:Apply Now|Submit|Name|Phone Number|Email|Comments|Upload Resume|Position:|Please fill in the details below)/i.test(String(value ?? ''))

const extractLabeledValue = (lines, labels) => {
  const patterns = labels.map((label) => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:?$`, 'i'))
  const labelIndex = lines.findIndex((line) => patterns.some((pattern) => pattern.test(line)))
  if (labelIndex === -1) return null

  for (let index = labelIndex + 1; index < lines.length; index += 1) {
    const candidate = lines[index]
    if (!candidate) continue
    if (patterns.some((pattern) => pattern.test(candidate))) continue
    if (/^(?:Positions?|Locations?)[:]?$/i.test(candidate)) break
    if (isControlLine(candidate)) break
    return candidate
  }

  return null
}

const extractSectionLists = (html) => {
  const sections = []
  const page = extractSurfaceHtml(html)

  for (const match of String(page ?? '').matchAll(
    /<(?:h[1-6]|p)\b[^>]*>\s*(?:<strong>)?\s*([^<]+?)\s*:?\s*(?:<\/strong>)?\s*<\/(?:h[1-6]|p)>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/gi,
  )) {
    const label = normalizeWhitespace(match[1])?.replace(/:$/, '')
    const items = [...match[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((item) => stripTags(item[1]))
      .filter(Boolean)

    if (label && items.length > 0) {
      sections.push({ label, items })
    }
  }

  return sections
}

const buildJobDescription = ({ html, title, positions, location, sectionLists }) => {
  const lines = htmlToTextLines(html)
  const stopIndex = lines.findIndex((line) => /^Please fill in the details below/i.test(line) || /^Position:/i.test(line))
  const sectionItems = new Set(
    sectionLists
      .flatMap((section) => section.items)
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean),
  )
  const relevantLines = (stopIndex >= 0 ? lines.slice(0, stopIndex) : lines).filter((line) => {
    if (line === title || line === positions || line === location) return false
    if (/^(?:Positions?|Locations?)[:]?$/i.test(line)) return false
    if (line === 'Apply Now') return false
    if (sectionLists.some((section) => line === `${section.label}:` || line === section.label)) return false
    if (sectionItems.has(line)) return false
    return !isControlLine(line)
  })

  const summary = normalizeWhitespace(relevantLines.join(' '))
  const sectionText = sectionLists
    .map((section) => `${section.label}: ${section.items.join(' ')}`)
    .join(' ')

  return normalizeWhitespace([summary, sectionText].filter(Boolean).join(' '))
}

const extractExperience = (lines) => {
  const explicitLine = lines.find((line) => /^Experience:/i.test(line))
  if (explicitLine) {
    const value = normalizeWhitespace(explicitLine.replace(/^Experience:\s*/i, ''))

    if (value && !/\s/.test(value)) {
      return value.replace(/\.$/, '')
    }

    return value
  }

  return null
}

const extractOpenings = (html) => {
  if (!hasOfficialCurrentOpeningsSignal(html)) {
    throw new Error('verified Maxsell current openings surface no longer matches the official first-party jobs page')
  }

  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<div[^>]+data-elementor-type=["']loop-item["'][\s\S]*?(?=<div[^>]+data-elementor-type=["']loop-item["']|<\/main>|$)/gi,
  )) {
    const block = match[0]
    const title = extractText(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i, block)
    if (!title || isFilledRole(title)) continue

    const lines = htmlToTextLines(block)
    const positions = extractLabeledValue(lines, ['Positions'])
    const location = extractLabeledValue(lines, ['Locations', 'Location'])
    const sourceUrl = toAbsoluteUrl(
      block.match(/<a[^>]+href=["']([^"']*\/current-opening\/[^"']+)["'][^>]*>[\s\S]*?Apply Now[\s\S]*?<\/a>/i)?.[1],
      CURRENT_OPENINGS_URL,
    )

    if (!positions || !location || !isOfficialCurrentOpeningUrl(sourceUrl) || seen.has(sourceUrl)) {
      continue
    }

    seen.add(sourceUrl)
    const jobId = buildJobId(sourceUrl)
    jobs.push({
      title,
      positions,
      location,
      city: deriveCity(location),
      sourceUrl,
      applyUrl: sourceUrl,
      jobId,
      requisitionId: jobId,
    })
  }

  if (jobs.length === 0) {
    throw new Error('verified Maxsell current openings surface changed or no trusted active roles remain')
  }

  return jobs
}

const extractCurrentOpeningUrlsFromSitemap = (xml) => {
  const urls = [...String(xml ?? '').matchAll(
    /<loc>(https:\/\/maxsell\.co\.in\/current-opening\/[^<]+)<\/loc>/gi,
  )]
    .map((match) => toAbsoluteUrl(match[1], CURRENT_OPENINGS_SITEMAP_URL))
    .filter(isOfficialCurrentOpeningUrl)

  return [...new Set(urls)]
}

const extractJobDetail = (html, listing = {}) => {
  const lines = htmlToTextLines(html)
  const title = extractText(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i, html) || listing.title || null
  const positions = extractLabeledValue(lines, ['Positions']) || listing.positions || null
  const location = extractLabeledValue(lines, ['Locations', 'Location']) || listing.location || null
  const sectionLists = extractSectionLists(html)
  const requiredSkills = sectionLists.flatMap((section) => section.items)
  const experienceRequired = extractExperience(lines)

  return {
    title,
    positions,
    location,
    city: deriveCity(location || listing.location),
    country: 'India',
    jobId: listing.jobId || buildJobId(listing.sourceUrl || listing.applyUrl || title),
    requisitionId: listing.requisitionId || listing.jobId || buildJobId(listing.sourceUrl || listing.applyUrl || title),
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.applyUrl || listing.sourceUrl || null,
    employmentType: null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription({
      html,
      title,
      positions,
      location,
      sectionLists,
    }),
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

export const createArihantMaxsellTechnologiesPvtLtdScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('verified official homepage changed; refusing to trust Maxsell careers routing')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('verified official careers landing changed; refusing to trust Maxsell jobs handoff')
    }

    const currentOpeningsUrl = extractCurrentOpeningsUrl(careersHtml)
    if (currentOpeningsUrl !== CURRENT_OPENINGS_URL) {
      throw new Error('verified Maxsell careers handoff changed; refusing to trust public openings')
    }

    const openingsHtml = await fetchText(CURRENT_OPENINGS_URL)
    const listings = hasOfficialCurrentOpeningsSignal(openingsHtml)
      ? extractOpenings(openingsHtml)
      : hasOfficialCurrentOpeningsShellSignal(openingsHtml)
        ? extractCurrentOpeningUrlsFromSitemap(await fetchText(CURRENT_OPENINGS_SITEMAP_URL)).map((sourceUrl) => {
            const jobId = buildJobId(sourceUrl)
            return {
              title: null,
              positions: null,
              location: null,
              city: null,
              sourceUrl,
              applyUrl: sourceUrl,
              jobId,
              requisitionId: jobId,
            }
          })
        : (() => {
            throw new Error('verified Maxsell current openings surface no longer matches the official first-party jobs page')
          })()

    if (listings.length === 0) {
      throw new Error('verified Maxsell current-opening sitemap no longer exposes trusted first-party job detail URLs')
    }

    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      if (!hasOfficialJobDetailSignal(detailHtml, listing.sourceUrl)) {
        throw new Error('verified Maxsell job detail surface changed; refusing to trust public applications')
      }

      const detail = extractJobDetail(detailHtml, listing)
      if (isFilledRole(detail.title)) continue

      jobs.push({
        ...detail,
        company: COMPANY,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createArihantMaxsellTechnologiesPvtLtdScraper().run(options)

export {
  extractCurrentOpeningsUrl,
  hasOfficialHomepageSignal,
  hasOfficialCareersSignal,
  hasOfficialCurrentOpeningsSignal,
  hasOfficialJobDetailSignal,
  extractOpenings,
  extractJobDetail,
}

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
