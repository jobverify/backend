import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'openupconstruction'
export const COMPANY = 'Open Up Construction'
export const COMPANY_DOMAIN = 'openupgroup.co.jp'
export const VERIFIED_ON = '2026-08-03'
export const CAREERS_URL = 'https://goodwork.openupgroup.co.jp/job-info/opc/'
export const MIDCAREER_URL = 'https://goodwork.openupgroup.co.jp/job-info/opc/application/'
export const NEW_GRADUATE_URL = 'https://goodwork.openupgroup.co.jp/job-info/opc/newgraduate/'
export const FIRST_PARTY_LISTING_URLS = [
  MIDCAREER_URL,
  NEW_GRADUATE_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_TITLE = 'オープンアップコンストラクション | オープンアップブランドサイト'
const DETAIL_TITLES = new Map([
  [MIDCAREER_URL, '募集要項（中途未経験） | オープンアップブランドサイト'],
  [NEW_GRADUATE_URL, '募集要項（新卒） | オープンアップブランドサイト'],
])
const MIDCAREER_LINK_TEXT = /中途未経験\s*[：:]\s*募集要項・応募フォーム/i
const NEW_GRADUATE_LINK_TEXT = /新卒採用\s*[：:]\s*募集要項・応募フォーム/i

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/main|\/tr|\/td|\/th|\/table|\/figure)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(value)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    return `${url.origin}${pathname}`.toLowerCase()
  } catch {
    return null
  }
}

const isExpectedUrl = (actualUrl, expectedUrl) =>
  normalizeComparableUrl(actualUrl) === normalizeComparableUrl(expectedUrl)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const cloneRegex = (pattern) => new RegExp(pattern.source, pattern.flags)

const matchesPattern = (value, pattern) => {
  if (pattern instanceof RegExp) {
    return cloneRegex(pattern).test(String(value ?? ''))
  }

  return normalizeWhitespace(value) === normalizeWhitespace(pattern)
}

const hasTitle = (html, title) => new RegExp(
  `<title>\\s*${escapeRegex(title)}\\s*<\\/title>`,
  'i',
).test(String(html ?? ''))

const extractAnchors = (html, baseUrl = CAREERS_URL) => Array.from(
  String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi),
).flatMap((match) => {
  try {
    return [{
      href: new URL(match[1], baseUrl).toString(),
      text: stripTags(match[2]) ?? '',
    }]
  } catch {
    return []
  }
})

const extractAnchorHref = (html, textPattern, { baseUrl = CAREERS_URL, hrefPattern = null } = {}) => {
  const anchor = extractAnchors(html, baseUrl).find(({ href, text }) =>
    matchesPattern(text, textPattern) && (!hrefPattern || matchesPattern(href, hrefPattern)),
  )

  return anchor?.href ?? null
}

const extractStrongValue = (html, label) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<strong[^>]*>\\s*${escapeRegex(label)}\\s*<\\/strong>\\s*<\\/p>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`,
      'i',
    ),
  )

  return stripTags(match?.[1])
}

const findFirstPatternMatch = (source, patterns, fromIndex = 0) => {
  let bestMatch = null

  for (const pattern of patterns) {
    const slice = source.slice(fromIndex)
    const match = slice.match(pattern)
    if (!match) continue

    const candidate = {
      index: fromIndex + match.index,
      text: match[0],
    }

    if (!bestMatch || candidate.index < bestMatch.index) {
      bestMatch = candidate
    }
  }

  return bestMatch
}

const createStrongLabelPattern = (label) => new RegExp(
  `<strong[^>]*>\\s*${escapeRegex(label)}\\s*<\\/strong>\\s*<\\/p>`,
  'i',
)

const createHeadingPattern = (label) => new RegExp(
  `<h[1-6][^>]*>\\s*${escapeRegex(label)}\\s*<\\/h[1-6]>`,
  'i',
)

const extractLabeledSection = (html, label, { nextLabels = [], nextPhrases = [] } = {}) => {
  const source = String(html ?? '')
  const startMatch = findFirstPatternMatch(source, [
    createStrongLabelPattern(label),
    createHeadingPattern(label),
  ])

  if (!startMatch) {
    return null
  }

  const sectionStart = startMatch.index + startMatch.text.length
  const endPatterns = [
    ...nextLabels.flatMap((nextLabel) => [
      createStrongLabelPattern(nextLabel),
      createHeadingPattern(nextLabel),
    ]),
    ...nextPhrases.map((phrase) => new RegExp(escapeRegex(phrase), 'i')),
  ]
  const endMatch = endPatterns.length > 0
    ? findFirstPatternMatch(source, endPatterns, sectionStart)
    : null
  const sectionHtml = endMatch
    ? source.slice(sectionStart, endMatch.index)
    : source.slice(sectionStart)

  return stripTags(sectionHtml)
}

const unique = (values) => {
  const seen = new Set()

  return values.filter((value) => {
    if (!value || seen.has(value)) {
      return false
    }

    seen.add(value)
    return true
  })
}

const buildJobId = (sourceUrl) => {
  if (isExpectedUrl(sourceUrl, MIDCAREER_URL)) return 'opc-midcareer'
  if (isExpectedUrl(sourceUrl, NEW_GRADUATE_URL)) return 'opc-newgraduate'
  throw new Error('Open Up Construction detail route no longer matches the verified first-party pages')
}

const buildAudienceTag = (sourceUrl) => {
  if (isExpectedUrl(sourceUrl, MIDCAREER_URL)) return 'midcareer'
  if (isExpectedUrl(sourceUrl, NEW_GRADUATE_URL)) return 'newgraduate'
  throw new Error('Open Up Construction detail route no longer matches the verified first-party pages')
}

const summarizeLocation = (locationSection) => {
  if (String(locationSection ?? '').includes('全国の各プロジェクト先が勤務地です')) {
    return 'Nationwide project sites, Japan'
  }

  return null
}

const extractPreferredQualification = (title, candidateProfile) => {
  const match = `${title || ''} ${candidateProfile || ''}`.match(/CAD[（(][^）)]+[）)]習得者尚可[。！]?/)
  return normalizeWhitespace(match?.[0])
}

const buildDescription = ({
  audience,
  candidateProfile,
  employmentType,
  workingHours,
  locationSection,
  compensation,
  allowances,
  holidays,
}) => [
  audience ? `Target: ${audience}` : null,
  candidateProfile ? `Candidate profile: ${candidateProfile}` : null,
  employmentType ? `Employment type: ${employmentType}` : null,
  workingHours ? `Working hours: ${workingHours}` : null,
  locationSection ? `Location: ${locationSection}` : null,
  compensation ? `Compensation: ${compensation}` : null,
  allowances ? `Allowances: ${allowances}` : null,
  holidays ? `Holidays: ${holidays}` : null,
].filter(Boolean).join(' ')

export const hasVerifiedCareersHub = (html) => {
  const source = String(html ?? '')
  const text = stripTags(source) || ''

  return hasTitle(source, CAREERS_TITLE)
    && text.includes('求人情報')
    && text.includes('オープンアップコンストラクション')
    && extractStrongValue(source, '募集求人') === '施工管理技術者'
    && extractStrongValue(source, '対象') === '新卒・中途未経験'
    && extractAnchorHref(source, MIDCAREER_LINK_TEXT, { baseUrl: CAREERS_URL }) !== null
    && extractAnchorHref(source, NEW_GRADUATE_LINK_TEXT, { baseUrl: CAREERS_URL }) !== null
}

export const extractFirstPartyListingLinks = (html) => unique([
  extractAnchorHref(html, MIDCAREER_LINK_TEXT, { baseUrl: CAREERS_URL }),
  extractAnchorHref(html, NEW_GRADUATE_LINK_TEXT, { baseUrl: CAREERS_URL }),
])

export const extractJobDetail = (html, { sourceUrl } = {}) => {
  const expectedTitle = Array.from(DETAIL_TITLES.entries()).find(([url]) => isExpectedUrl(sourceUrl, url))?.[1]
  if (!expectedTitle) {
    throw new Error('Open Up Construction detail route no longer matches the verified first-party pages')
  }

  const source = String(html ?? '')
  const text = stripTags(source) || ''
  const roleTitle = extractStrongValue(source, '募集求人')
  const audience = extractStrongValue(source, '対象')
  const employmentType = extractStrongValue(source, '雇用形態')
  const workingHours = extractStrongValue(source, '勤務時間')
  const locationSection = extractLabeledSection(source, '勤務地', { nextLabels: ['給与'] })
  const compensation = extractLabeledSection(source, '給与', { nextLabels: ['昇給・賞与', '諸手当'] })
  const allowances = extractLabeledSection(source, '諸手当', { nextLabels: ['休日・休暇'] })
  const holidays = extractLabeledSection(source, '休日・休暇', {
    nextLabels: ['福利厚生'],
    nextPhrases: ['応募はオープンアップコンストラクションのサイトから', 'TOP'],
  })
  const candidateProfile = extractLabeledSection(source, '対象となる方', {
    nextLabels: ['募集要項'],
    nextPhrases: ['応募はオープンアップコンストラクションのサイトから', 'TOP'],
  })
  const applyUrl = isExpectedUrl(sourceUrl, MIDCAREER_URL)
    ? extractAnchorHref(source, MIDCAREER_LINK_TEXT, {
      baseUrl: sourceUrl,
      hrefPattern: /www55\.rpm-sys\.jp/i,
    })
    : extractAnchorHref(source, NEW_GRADUATE_LINK_TEXT, {
      baseUrl: sourceUrl,
      hrefPattern: /www55\.rpm-sys\.jp/i,
    })

  if (
    !hasTitle(source, expectedTitle)
    || !text.includes('募集要項')
    || !text.includes('オープンアップコンストラクション')
    || !roleTitle
    || !audience
    || !employmentType
    || !workingHours
    || !candidateProfile
    || !locationSection?.includes('全国の各プロジェクト先が勤務地です')
    || !compensation?.includes('未経験者 給与例')
    || !holidays?.includes('年間休日120日')
    || !applyUrl?.includes('www55.rpm-sys.jp')
  ) {
    throw new Error('Open Up Construction verified first-party job detail page changed materially')
  }

  const location = summarizeLocation(locationSection)
  if (!location) {
    throw new Error('Open Up Construction verified first-party job detail page changed materially')
  }

  const audienceTag = buildAudienceTag(sourceUrl)
  const jobId = buildJobId(sourceUrl)

  return {
    title: roleTitle,
    company: COMPANY,
    department: 'Construction',
    location,
    city: null,
    country: 'Japan',
    employmentType,
    experienceRequired: audienceTag === 'midcareer' ? audience : '新卒',
    minimumQualification: audienceTag === 'midcareer' ? candidateProfile : audience,
    preferredQualification: extractPreferredQualification(roleTitle, candidateProfile),
    requiredSkills: [],
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    companyCareerPage: CAREERS_URL,
    companyDomain: COMPANY_DOMAIN,
    atsPlatform: 'rpm-sys',
    postingDate: null,
    closingDate: null,
    jobDescription: buildDescription({
      audience,
      candidateProfile,
      employmentType,
      workingHours,
      locationSection,
      compensation,
      allowances,
      holidays,
    }),
  }
}

export const createOpenUpConstructionScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (
      careersPage.status !== 200
      || !isExpectedUrl(careersPage.url, CAREERS_URL)
      || !hasVerifiedCareersHub(careersPage.html)
    ) {
      throw new Error('Open Up Construction verified first-party careers hub changed materially')
    }

    const listingLinks = extractFirstPartyListingLinks(careersPage.html)
    if (
      listingLinks.length !== FIRST_PARTY_LISTING_URLS.length
      || listingLinks.some((url, index) => !isExpectedUrl(url, FIRST_PARTY_LISTING_URLS[index]))
    ) {
      throw new Error('Open Up Construction verified first-party listing links changed materially')
    }

    const jobs = []

    for (const listingUrl of listingLinks) {
      const detailPage = await fetchPage(listingUrl)

      if (detailPage.status !== 200 || !isExpectedUrl(detailPage.url, listingUrl)) {
        throw new Error('Open Up Construction verified first-party job detail page changed materially')
      }

      jobs.push(extractJobDetail(detailPage.html, { sourceUrl: listingUrl }))
    }

    return jobs
  },
})

export const run = async (options = {}) => createOpenUpConstructionScraper().run(options)

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
