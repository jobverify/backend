export const CAREERS_URL = 'https://smarterai.com/careers'
export const OPEN_POSITIONS_URL = `${CAREERS_URL}/open-positions`
export const SOURCE = 'smarterai'
export const COMPANY = 'SmarterAI'

const normalizeText = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const htmlToLines = (html = '') => String(html)
  .replace(/<(?:br|\/p|\/div|\/li|\/section|\/article|\/main|\/footer|\/header|\/h[1-6])[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map(normalizeText)
  .filter(Boolean)

const extractAnchors = (html = '') => Array.from(
  String(html).matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ([, href, label]) => ({ href, label: normalizeText(label) }),
)

const toSameOriginRoleUrl = (href, baseUrl) => {
  try {
    const url = new URL(href, baseUrl)
    const origin = new URL(baseUrl).origin
    const pathname = url.pathname.replace(/\/+$/, '')

    if (url.origin !== origin) return null
    if (!/^\/careers\/[^/]+$/i.test(pathname)) return null
    if (/^\/careers\/(?:open-positions)?$/i.test(pathname)) return null

    return url.toString()
  } catch {
    return null
  }
}

const dedupe = (values) => {
  const seen = new Set()
  const result = []

  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }

  return result
}

const isIndiaLocation = (value) => /\bindia\b/i.test(value || '')

const cleanLocation = (value) => normalizeText(String(value || '').replace(/^location\s*:\s*/i, ''))

const parseLocation = (value) => {
  const location = cleanLocation(value)
  if (!location) return { location: null, city: null, country: null }
  if (!isIndiaLocation(location)) return { location, city: null, country: null }

  const city = normalizeText(location.replace(/,?\s*india\b/i, ''))

  return {
    location,
    city: city && !/^india$/i.test(city) ? city : null,
    country: 'India',
  }
}

const extractRoleCards = (html, openPositionsUrl) => {
  const lines = htmlToLines(html)
  const headingIndex = lines.findIndex((line) => /^open positions$/i.test(line))
  if (headingIndex < 0) return []

  const relevantLines = lines.slice(headingIndex + 1)
  const footerIndex = relevantLines.findIndex((line) => /^(?:about smarter ai|legal|social)$/i.test(line))
  const roleLines = footerIndex >= 0 ? relevantLines.slice(0, footerIndex) : relevantLines
  const detailUrls = dedupe(
    extractAnchors(html)
      .filter(({ label }) => /^learn more$/i.test(label || ''))
      .map(({ href }) => toSameOriginRoleUrl(href, openPositionsUrl)),
  )

  if (detailUrls.length === 0) return []

  const cards = []

  for (let index = 0; index < roleLines.length; index += 1) {
    if (!/^learn more$/i.test(roleLines[index])) continue

    const location = roleLines[index - 1] || null
    const title = roleLines[index - 2] || null

    if (!title || !location) continue
    cards.push({ title, location })
  }

  if (cards.length === 0 || cards.length !== detailUrls.length) return []

  return cards.map((card, index) => ({
    ...card,
    detailUrl: detailUrls[index],
  }))
}

const extractDetailTitle = (html = '') => normalizeText(
  String(html).match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1],
)

const extractDetailLocation = (lines) => {
  const labeledLocation = lines.find((line) => /^location\s*:/i.test(line))
  if (labeledLocation) return cleanLocation(labeledLocation)

  const inlineIndiaLocation = lines.join(' ').match(/\b([A-Z][A-Za-z .-]+,\s*India|India)\b/)
  return normalizeText(inlineIndiaLocation?.[1])
}

const extractApplyUrl = (html, detailUrl) => {
  const applyAnchor = extractAnchors(html).find(({ label }) => /\bapply\b/i.test(label || ''))
  if (!applyAnchor) return null

  try {
    const url = new URL(applyAnchor.href, detailUrl)
    return /^https?:$/i.test(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

const extractExperience = (lines) => {
  const labeledExperience = lines.find((line) => /^experience\s*:/i.test(line))
  if (labeledExperience) {
    return normalizeText(labeledExperience.replace(/^experience\s*:\s*/i, ''))
  }

  return normalizeText(lines.join(' ').match(/\b\d+\+?\s*(?:years?|yrs?)\b/i)?.[0])
}

const inferRemoteStatus = (lines) => {
  const text = lines.join(' ')
  if (/\bhybrid\b/i.test(text)) return 'Hybrid'
  if (/\bremote\b/i.test(text)) return 'Remote'
  if (/\bon[ -]?site\b/i.test(text)) return 'On-site'
  return null
}

const extractDescription = (lines, title) => {
  const titleIndex = lines.findIndex((line) => line === title)
  const relevantLines = titleIndex >= 0 ? lines.slice(titleIndex + 1) : lines
  const stopIndex = relevantLines.findIndex((line) => /^(?:apply|about smarter ai|legal|social|contact|team|trust|visit)$/i.test(line))
  const descriptionLines = (stopIndex >= 0 ? relevantLines.slice(0, stopIndex) : relevantLines)
    .filter((line) => !/^(?:location|experience)\s*:/i.test(line))

  return normalizeText(descriptionLines.join(' '))
}

const parseDetailPage = ({ html, detailUrl, listingTitle, listingLocation, now }) => {
  const lines = htmlToLines(html)
  const applyUrl = extractApplyUrl(html, detailUrl)
  const detailTitle = extractDetailTitle(html)
  const detailLocation = extractDetailLocation(lines)
  const location = isIndiaLocation(detailLocation) ? detailLocation : listingLocation
  const parsedLocation = parseLocation(location)

  if (!applyUrl || !parsedLocation.country) return null

  const title = detailTitle || listingTitle
  if (!title) return null

  const experienceRequired = extractExperience(lines)

  return {
    title,
    company: COMPANY,
    location: parsedLocation.location,
    city: parsedLocation.city,
    country: parsedLocation.country,
    link: detailUrl,
    sourceUrl: detailUrl,
    applyUrl,
    source: SOURCE,
    employmentType: null,
    experienceRequired,
    seniority: experienceRequired,
    jobDescription: extractDescription(lines, title),
    requiredSkills: [],
    remoteStatus: inferRemoteStatus(lines),
    scrapedAt: now(),
  }
}

export const createSmarterAIScraper = ({
  openPositionsUrl = OPEN_POSITIONS_URL,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const openingsHtml = await fetchHtml(openPositionsUrl)
    const roleCards = extractRoleCards(openingsHtml, openPositionsUrl)

    if (roleCards.length === 0) return []

    const jobs = await Promise.all(roleCards.map(async ({ title, location, detailUrl }) => {
      const detailHtml = await fetchHtml(detailUrl)
      return parseDetailPage({
        html: detailHtml,
        detailUrl,
        listingTitle: title,
        listingLocation: location,
        now,
      })
    }))

    return jobs.filter(Boolean)
  },
})

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const run = (options) => createSmarterAIScraper().run(options)
