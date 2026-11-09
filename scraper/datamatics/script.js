export const CAREERS_URL = 'https://www.datamatics.com/human-resources/job-openings'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&rsquo;|&#8217;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const fieldValue = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(html ?? '').match(new RegExp(
    `<td\\b[^>]*>\\s*${escapedLabel}\\s*<\\/td>\\s*<td\\b[^>]*>([\\s\\S]*?)<\\/td>`,
    'i',
  ))

  return normalizeWhitespace(match?.[1])
}

const extractCards = (html) => [...String(html ?? '').matchAll(
  /<div\b[^>]*class=["'][^"']*\baccordion-item\b[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*\baccordion-item\b|$)/gi,
)].map((match) => match[1])

export const extractDatamaticsJobs = (html) => extractCards(html)
  .map((card) => {
    const heading = normalizeWhitespace(card.match(/<div\b[^>]*class=["'][^"']*\baccordion-title\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
    const title = normalizeWhitespace(heading?.replace(/\s*\|\s*EXP\s*:\s*.*$/i, ''))
    const location = fieldValue(card, 'Job Location')
    const applyUrl = card.match(/href=["'](mailto:[^"']+)["']/i)?.[1] || null
    const requisitionId = slugify(`${title}-${location}`)

    if (!title || !location || !/\bindia\b/i.test(location) || !requisitionId) return null

    return {
      title,
      company: 'Datamatics Global Services Limited',
      location,
      city: normalizeWhitespace(location.split(',')[0]),
      country: 'India',
      jobId: `datamatics-${requisitionId}`,
      requisitionId,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired: fieldValue(card, 'Experience'),
      minimumQualification: fieldValue(card, 'Qualifications'),
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: fieldValue(card, 'Job Desc'),
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyBot/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createDatamaticsScraper = ({ fetchText = defaultFetchText } = {}) => ({
  run: async ({ fetchText: overrideFetchText } = {}) => {
    const jobs = extractDatamaticsJobs(await (overrideFetchText || fetchText)(CAREERS_URL))

    return jobs.map((job) => ({
      ...job,
      source: 'datamatics',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createDatamaticsScraper().run(options)
