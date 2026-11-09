import { runNativeInventory } from './nativeInventory.js'

// Legacy pure helpers remain available to existing callers. The active run
// validates current native inventory in nativeInventory.js.
const BASE_URL = 'https://careers.techmahindra.com/'
const INDIA_COUNTRY_CODE = 'IND'
const DEFAULT_MAX_EXPERIENCE = '0'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#x2F;/gi, '/')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(value)
  return match ? transform(match) : null
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const extractAspNetState = (html) => {
  const state = {}

  for (const match of String(html).matchAll(/<input[^>]*type="hidden"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi)) {
    state[match[1]] = decodeHtmlEntities(match[2])
  }

  return state
}

export const extractCurrentOpportunities = (html) => {
  const page = String(html ?? '')
  const detailLinkPattern = /<a[^>]+href="([^"]*JobDetails\.aspx\?[^"]+)"[^>]*>/gi
  const cards = []

  for (const match of page.matchAll(detailLinkPattern)) {
    const cardHtml = page.slice(Math.max(0, match.index - 3500), match.index + match[0].length)
    const titleMatches = [...cardHtml.matchAll(
      /<div[^>]*style="[^"]*margin-bottom:\s*5px;[^"]*font-size:\s*13px;?[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    )]
    const titleMatch = titleMatches.at(-1)
    const beforeTitle = titleMatch ? cardHtml.slice(0, titleMatch.index) : cardHtml
    const fieldsHtml = titleMatch ? cardHtml.slice(titleMatch.index) : cardHtml
    const spanMatches = [...beforeTitle.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
    const category = normalizeWhitespace(spanMatches.at(-1)?.[1])
    const title = normalizeWhitespace(titleMatch?.[1])
    const skillSet = normalizeWhitespace(
      extractFirst(/<b>\s*Skill Set\s*<\/b>\s*:\s*([\s\S]*?)(?:<br\s*\/?>|<\/p>)/i, fieldsHtml),
    )
    const experienceRequired = normalizeWhitespace(
      extractFirst(/<b>\s*Experience\s*<\/b>\s*:\s*([\s\S]*?)(?:<br\s*\/?>|<\/p>)/i, fieldsHtml),
    )
    const location = normalizeWhitespace(
      extractFirst(/<b>\s*Location\s*<\/b>\s*:\s*([\s\S]*?)<\/p>/i, fieldsHtml),
    )
    const relativeUrl = normalizeWhitespace(match[1])
    const sourceUrl = toAbsoluteUrl(relativeUrl)
    const jobCode = sourceUrl
      ? new URL(sourceUrl).searchParams.get('JobCode')
      : null

    if (!title || !sourceUrl || !jobCode) continue

    cards.push({
      title,
      category,
      location,
      city: location,
      skillSet,
      experienceRequired,
      jobCode,
      sourceUrl,
    })
  }

  return cards
}

export const extractPagerTargets = (html) => [...String(html).matchAll(
  /<a(?: onclick="return false;")?[^>]*class="(page_disabled|page_enabled)"[^>]*href="javascript:__doPostBack\(&#39;([^']+?)&#39;,\&#39;\&#39;\)">([^<]+)<\/a>/gi,
)]
  .map((match) => ({
    label: normalizeWhitespace(match[3]),
    target: match[2],
    current: match[1] === 'page_disabled',
  }))
  .filter((item) => item.label && item.target)

export const buildPagePostbackPayload = (state = {}, options = {}) => ({
  ...state,
  __EVENTTARGET: options.target || '',
  __EVENTARGUMENT: '',
  'ctl00$ContentPlaceHolder1$ddlCountry': options.country || INDIA_COUNTRY_CODE,
  'ctl00$ContentPlaceHolder1$ddlTotExpYears': options.maxExperience || DEFAULT_MAX_EXPERIENCE,
})

const getSectionHtml = (html, heading) => extractFirst(
  new RegExp(`<h4>${heading}:<\\/h4>\\s*<ul>([\\s\\S]*?)<\\/ul>`, 'i'),
  html,
)

export const extractJobDetail = (html, listing = {}) => {
  const location = normalizeWhitespace(
    extractFirst(/<span>\s*([A-Z\s]+\[India\])\s*<\/span>/i, html),
  )
  const city = normalizeWhitespace(location?.split('[')[0] ?? null)
  const jobReferenceNo = normalizeWhitespace(
    extractFirst(/<b>\s*Job Reference No\s*:\s*<\/b>\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>/i, html),
  )
  const experienceRequired = normalizeWhitespace(
    extractFirst(/<h3>\s*Years of Experience:\s*([\s\S]*?)<\/h3>/i, html),
  )
  const summary = stripTags(extractFirst(/<h4>Job Summary:<\/h4>\s*<p>([\s\S]*?)<\/p>/i, html))
  const responsibilities = extractListItems(getSectionHtml(html, 'Responsibilities'))
  const mandatorySkills = extractListItems(getSectionHtml(html, 'Mandatory Skills'))
  const preferredSkills = extractListItems(getSectionHtml(html, 'Preferred Skills'))
  const qualifications = extractListItems(getSectionHtml(html, 'Qualifications'))
  const descriptionParts = [
    summary,
    responsibilities.length ? `Responsibilities: ${responsibilities.join(' ')}` : null,
    mandatorySkills.length ? `Mandatory Skills: ${mandatorySkills.join(' ')}` : null,
    preferredSkills.length ? `Preferred Skills: ${preferredSkills.join(' ')}` : null,
    qualifications.length ? `Qualifications: ${qualifications.join(' ')}` : null,
  ].filter(Boolean)

  return {
    location,
    city,
    jobId: jobReferenceNo,
    requisitionId: jobReferenceNo,
    employmentType: 'Full-time',
    experienceRequired,
    jobDescription: normalizeWhitespace(descriptionParts.join(' ')),
    minimumQualification: qualifications[0] ?? null,
    preferredQualification: null,
    requiredSkills: [...mandatorySkills, ...preferredSkills],
    applyUrl: listing.sourceUrl || null,
    sourceUrl: listing.sourceUrl || null,
  }
}

export const run = (options = {}) => runNativeInventory(options)
