export const CAREERS_URL = 'https://www.sumup.com/careers/positions/'
export const COMPANY = 'SumUp India'
export const SOURCE = 'sumupindia'
export const EXPECTED_HEADING = 'Explore open positions at SumUp'

const normalizeText = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const htmlToLines = (html = '') => String(html)
  .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/span)[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map(normalizeText)
  .filter(Boolean)

const extractAnchors = (html = '') => Array.from(
  String(html).matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ([, href, innerHtml]) => ({ href, innerHtml }),
)

const hasVerifiedContract = (html = '') => htmlToLines(html)
  .some((line) => line.toLowerCase() === EXPECTED_HEADING.toLowerCase())

const toRoleUrl = (href, careersUrl) => {
  try {
    const url = new URL(href, careersUrl)
    const careers = new URL(careersUrl)

    if (url.origin !== careers.origin) return null
    if (!url.pathname.startsWith('/careers/positions/')) return null

    const hasGreenhouseId = /^\d+$/.test(url.searchParams.get('gh_jid') || '')
    const hasDetailPathId = /\/\d+\/?$/i.test(url.pathname)

    if (!hasGreenhouseId && !hasDetailPathId) return null

    return url.toString()
  } catch {
    return null
  }
}

const extractRoleFields = (anchorHtml = '') => {
  const lines = htmlToLines(anchorHtml)
  const title = lines[0] || null
  const location = lines.slice(1).find((line) => /,\s*|^india$/i.test(line) || /\bindia\b/i.test(line)) || null
  const department = lines.slice(1).find((line) => line !== location) || null

  return { title, location, department }
}

const toIndiaLocation = (location) => {
  if (!/\bindia\b/i.test(location || '')) return null

  const parts = (location || '')
    .split(',')
    .map((part) => normalizeText(part))
    .filter(Boolean)

  const city = parts.length > 1 ? parts[0] : null

  return {
    location: normalizeText(location),
    city,
    country: 'India',
  }
}

const readJobId = (roleUrl) => {
  try {
    const url = new URL(roleUrl)
    return normalizeText(url.searchParams.get('gh_jid') || url.pathname.match(/(\d+)\/?$/)?.[1])
  } catch {
    return null
  }
}

export const createSumUpIndiaScraper = ({
  careersUrl = CAREERS_URL,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const html = await fetchHtml(careersUrl)

    if (!hasVerifiedContract(html)) return []

    const jobs = extractAnchors(html)
      .map(({ href, innerHtml }) => {
        const sourceUrl = toRoleUrl(href, careersUrl)
        if (!sourceUrl) return null

        const fields = extractRoleFields(innerHtml)
        const indiaLocation = toIndiaLocation(fields.location)

        if (!fields.title || !indiaLocation) return null

        return {
          title: fields.title,
          company: COMPANY,
          source: SOURCE,
          location: indiaLocation.location,
          city: indiaLocation.city,
          country: indiaLocation.country,
          department: fields.department,
          link: sourceUrl,
          sourceUrl,
          applyUrl: sourceUrl,
          jobId: readJobId(sourceUrl),
          requisitionId: readJobId(sourceUrl),
          scrapedAt: now(),
        }
      })
      .filter(Boolean)

    return jobs
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

export const run = (options) => createSumUpIndiaScraper().run(options)
