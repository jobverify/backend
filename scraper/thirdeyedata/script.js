export const CAREERS_URL = 'https://thirdeyedata.ai/careers/'
export const OPENINGS_URL = 'https://thirdeyedata.ai/current-openings'
export const COMPANY = 'ThirdEyeData'
export const SOURCE = 'thirdeyedata'

const JOBPOST_PATH_PATTERN = /^\/jobpost\/[^/?#]+\/?$/i

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
  .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/main)[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map(normalizeText)
  .filter(Boolean)

const extractAnchors = (html = '') => Array.from(
  String(html).matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
  ([, href, label]) => ({
    href,
    label: normalizeText(label),
  }),
)

const toSameOriginJobpostUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    const url = new URL(value, baseUrl)
    const baseOrigin = new URL(baseUrl).origin
    if (url.origin !== baseOrigin || !JOBPOST_PATH_PATTERN.test(url.pathname)) return null
    return url.toString()
  } catch {
    return null
  }
}

const hasVerifiedOpeningsContract = (html = '') => {
  const text = normalizeText(html)
  return /list of open positions/i.test(text || '')
}

const extractRoleEntries = (html = '', openingsUrl = OPENINGS_URL) => {
  const roles = []
  const seen = new Set()

  for (const anchor of extractAnchors(html)) {
    const sourceUrl = toSameOriginJobpostUrl(anchor.href, openingsUrl)
    const title = normalizeText(anchor.label)

    if (!sourceUrl || !title || /^apply now$/i.test(title) || seen.has(sourceUrl)) continue

    seen.add(sourceUrl)
    roles.push({ title, sourceUrl })
  }

  return roles
}

const extractHeading = (html = '') => normalizeText(
  String(html).match(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1],
)

const extractLocation = (lines) => lines.find((line) => /\bindia\b/i.test(line) || /united states|canada|romania/i.test(line)) || null

const extractEmploymentType = (lines) => {
  const index = lines.findIndex((line) => /^job category$/i.test(line))
  if (index >= 0) return normalizeText(lines[index + 1])

  const employmentLine = lines.find((line) => /^employment type\s*:/i.test(line))
  if (employmentLine) return normalizeText(employmentLine.split(':').slice(1).join(':'))

  return null
}

const inferRemoteStatus = (lines) => {
  const text = lines.join(' ')
  if (/\bhybrid\b/i.test(text)) return 'Hybrid'
  if (/\bremote\b/i.test(text)) return 'Remote'
  if (/\bon-site\b|\bonsite\b/i.test(text)) return 'On-site'
  return null
}

const extractDescription = (lines) => {
  const startIndex = lines.findIndex((line) => /^(job summary|job overview|about the role)$/i.test(line))
  if (startIndex < 0) return null

  const chunks = []
  for (const line of lines.slice(startIndex + 1)) {
    if (/^(job features|apply online|posted \d+)/i.test(line)) break
    chunks.push(line)
  }

  return normalizeText(chunks.join(' '))
}

const isIndiaLocation = (location) => /\bindia\b/i.test(location || '')

const toCity = (location) => {
  if (!isIndiaLocation(location) || /^india$/i.test(location || '')) return null
  return normalizeText(String(location).replace(/,?\s*india\b/i, ''))
}

const parseDetailPage = ({ html, sourceUrl, expectedTitle, now }) => {
  const lines = htmlToLines(html)
  const title = extractHeading(html)
  const location = extractLocation(lines)
  const employmentType = extractEmploymentType(lines)
  const jobDescription = extractDescription(lines)
  const remoteStatus = inferRemoteStatus(lines)

  if (!title || !location || !isIndiaLocation(location)) return null
  if (!jobDescription || !employmentType || !remoteStatus) return null
  if (!/job features/i.test(html) || !/apply online/i.test(html)) return null
  if (normalizeText(expectedTitle)?.toLowerCase() !== title.toLowerCase()) return null

  return {
    title,
    company: COMPANY,
    location,
    city: toCity(location),
    country: 'India',
    link: sourceUrl,
    sourceUrl,
    applyUrl: sourceUrl,
    source: SOURCE,
    employmentType,
    jobDescription,
    requiredSkills: [],
    remoteStatus,
    scrapedAt: now(),
  }
}

export const createThirdEyeDataScraper = ({
  openingsUrl = OPENINGS_URL,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const openingsHtml = await fetchHtml(openingsUrl)

    if (!hasVerifiedOpeningsContract(openingsHtml)) return []

    const roles = extractRoleEntries(openingsHtml, openingsUrl)
    if (roles.length === 0) return []

    const jobs = await Promise.all(roles.map(async (role) => {
      const detailHtml = await fetchHtml(role.sourceUrl)
      return parseDetailPage({
        html: detailHtml,
        sourceUrl: role.sourceUrl,
        expectedTitle: role.title,
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

export const run = (options) => createThirdEyeDataScraper().run(options)
