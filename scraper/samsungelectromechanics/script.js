import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'samsungelectromechanics'
export const COMPANY = 'Samsung Electro-Mechanics'
export const COMPANY_CODE = 'C40'
export const HOMEPAGE_URL = 'https://www.samsungsem.com/kr/index.do'
export const COMPANY_PAGE_URL = 'https://www.samsungcareers.com/subsid/detail/C40'
export const LIST_URL = 'https://www.samsungcareers.com/hr/list.data'
export const DETAIL_URL = 'https://www.samsungcareers.com/recruit/detail.data'
export const CAREERS_DOMAIN = 'https://www.samsungcareers.com'
export const OFFICIAL_SITE_URL = 'https://www.samsungsem.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const BASE_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
}

const LIST_HEADERS = {
  ...BASE_HEADERS,
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  Referer: COMPANY_PAGE_URL,
}

const JSON_HEADERS = {
  ...BASE_HEADERS,
  Accept: 'application/json,text/plain,*/*',
}

const SAMSUNG_ELECTRO_MECHANICS_KR = '\uC0BC\uC131\uC804\uAE30'
const SAMSUNG_GROUP_CAREERS_KR = '\uC0BC\uC131 \uD1B5\uD569 \uC778\uC7AC\uCC44\uC6A9'
const HIRING_KR = '\uC778\uC7AC\uCC44\uC6A9'
const CAREERS_INFO_KR = '\uCC44\uC6A9\uC815\uBCF4'
const NO_CURRENT_POSTINGS_KR = '\uD604\uC7AC \uCC44\uC6A9\uC911\uC778 \uACF5\uACE0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'
const CHECK_SEARCH_CONDITIONS_KR = '\uAC80\uC0C9\uC5B4 \uB610\uB294 \uAC80\uC0C9 \uC870\uAC74\uC744 \uD655\uC778\uD574\uC8FC\uC2DC\uAE30 \uBC14\uB78D\uB2C8\uB2E4.'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeMultiline = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const buildSourceUrl = (seq) => `${CAREERS_DOMAIN}/hr/?no=${seq}`

const buildApplyUrl = (seqno) => `${CAREERS_DOMAIN}/resume/create?comp=${COMPANY_CODE}&no=${seqno}`

const buildDetailUrl = (seq) => `${DETAIL_URL}?seqno=${seq}&strCode=`

const isAcceptedSamsungElectroMechanicsKr = (value) =>
  normalizeWhitespace(value) === SAMSUNG_ELECTRO_MECHANICS_KR

export const buildListRequestBody = ({
  currentPageNo = 1,
  companyCode = COMPANY_CODE,
  recruitTypes = [],
} = {}) => {
  const body = new URLSearchParams()
  body.set('currentPageNo', String(currentPageNo))
  body.set('intNo', '0')
  body.set('strVal', '')
  body.set('strTxt', '')
  body.set('strKey', '')
  body.set('strCompany', companyCode)
  body.set('strType', recruitTypes.join(','))
  body.set('strOrderBy', '')
  body.set('strEntity', '')
  return body
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const visibleText = stripTags(page) || ''

  return (
    /<title>\s*삼성전기\s*<\/title>/i.test(page)
      || /SAMSUNG ELECTRO-MECHANICS/i.test(page)
  )
    && /SAMSUNG ELECTRO-MECHANICS/i.test(page)
    && (
      /https:\/\/www\.samsungcareers\.com\//i.test(page)
      || visibleText.includes(SAMSUNG_GROUP_CAREERS_KR)
      || /Samsung Careers/i.test(visibleText)
    )
    && (
      visibleText.includes(HIRING_KR)
      || visibleText.includes(CAREERS_INFO_KR)
      || /\/kr\/career[s]?\/job-description\.do/i.test(page)
    )
}

export const hasExactCompanyPageSignal = (html) => {
  const page = String(html ?? '')
  const visibleText = stripTags(page) || ''

  return (
    /<h2>\s*삼성전기\s*<\/h2>/i.test(page)
      || visibleText.includes(SAMSUNG_ELECTRO_MECHANICS_KR)
      || /Samsung Electro-Mechanics/i.test(visibleText)
  )
    && /data-index="C40"/i.test(page)
    && /https:\/\/www\.samsungsem\.com/i.test(page)
    && /sem\.recruit@samsung\.com/i.test(page)
}

export const extractRoleCodesFromCompanyPage = (html) => [...String(html ?? '').matchAll(
  /name="btnJobDetail"[^>]+data-code="([^"]+)"/gi,
)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

export const extractMaxPage = (html) => {
  const match = String(html ?? '').match(/class="divCnt"[^>]+data-max="(\d+)"/i)
  return match ? Number.parseInt(match[1], 10) : 0
}

export const hasNoCurrentPostingsSignal = (html) => {
  const page = String(html ?? '')
  const visibleText = stripTags(page) || ''

  return /class="divCnt"[^>]+data-max="0"/i.test(page)
    && /class="noData"/i.test(page)
    && visibleText.includes(NO_CURRENT_POSTINGS_KR)
    && visibleText.includes(CHECK_SEARCH_CONDITIONS_KR)
}

const parsePeriodDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{4})\.(\d{2})\.(\d{2})$/)
  if (!match) return null

  return `${match[1]}-${match[2]}-${match[3]}`
}

const splitFlags = (html) => [...String(html ?? '').matchAll(
  /<span class="flag grey">([\s\S]*?)<\/span>/gi,
)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const extractListingCards = (html) => {
  const page = String(html ?? '')
  const cards = []

  for (const match of page.matchAll(
    /<li>\s*<div>[\s\S]*?<button[^>]+class="btnShare"[^>]+data-value="([^"]+)"[\s\S]*?<button[^>]+class="btnScrap"[^>]+data-value="([^"]+)"[\s\S]*?<p class="company">\s*([\s\S]*?)<\/p>[\s\S]*?<h3 class="title">\s*([\s\S]*?)<\/h3>[\s\S]*?<p class="info">\s*<span>\s*([\s\S]*?)<\/span>[\s\S]*?<span class="period">\s*([\s\S]*?)<\/span>[\s\S]*?<div class="flagWrap">([\s\S]*?)<\/div>[\s\S]*?<\/li>/gi,
  )) {
    const companyKr = stripTags(match[3])
    if (!isAcceptedSamsungElectroMechanicsKr(companyKr)) {
      throw new Error('Samsung Electro-Mechanics public listing HTML no longer resolves to the exact company')
    }

    const [startDate, endDate] = String(match[6] ?? '')
      .split('~')
      .map((value) => parsePeriodDate(value))

    const seq = Number.parseInt(String(match[1]).replace(/[^\d]/g, ''), 10)
    const seqno = Number.parseInt(String(match[2]).replace(/[^\d]/g, ''), 10)

    if (!Number.isInteger(seq) || !Number.isInteger(seqno)) {
      throw new Error('Samsung Electro-Mechanics public listing HTML no longer exposes stable posting identifiers')
    }

    cards.push({
      seq,
      seqno,
      companyKr,
      title: stripTags(match[4]),
      recruitType: stripTags(match[5]),
      postingDate: startDate,
      closingDate: endDate,
      sourceUrl: buildSourceUrl(seq),
      applyUrl: buildApplyUrl(seqno),
      flags: splitFlags(match[7]),
    })
  }

  return cards
}

const parseIsoDateFromCompact = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(\d{4})(\d{2})(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

const toDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return new Date(`${normalized}T00:00:00.000Z`)
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const splitBulletLines = (value) => normalizeMultiline(value)
  ?.split('\n')
  .map((item) => normalizeWhitespace(item.replace(/^[-â€¢Â·]\s*/, '')))
  .filter(Boolean) || []

const extractExperienceRequired = (...values) => {
  const haystack = values
    .map((value) => normalizeMultiline(value))
    .filter(Boolean)
    .join(' ')

  const match = haystack.match(/(\d+\+?\s*years?)/i)
  return match ? normalizeWhitespace(match[1].replace(/\s+/g, ' ')) : null
}

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(String(value ?? '').replace(/^-\s*/, ''))
  if (!normalized) {
    return {
      location: 'South Korea',
      city: null,
      state: null,
      country: 'South Korea',
    }
  }

  const segments = normalized.split(',').map((item) => normalizeWhitespace(item)).filter(Boolean)
  const city = segments[0] || null
  const state = segments[1] || null

  return {
    location: [city, state, 'South Korea'].filter(Boolean).join(', '),
    city,
    state,
    country: 'South Korea',
  }
}

const buildJobDescription = ({
  postingTitle,
  taskEn,
  qlfctEn,
  favorEn,
  memoEn,
}) => {
  const lines = []

  if (postingTitle) lines.push(`Posting: ${postingTitle}`)

  const responsibilities = splitBulletLines(taskEn)
  if (responsibilities.length > 0) {
    lines.push('Responsibilities:')
    lines.push(...responsibilities)
  }

  const qualifications = splitBulletLines(qlfctEn)
  if (qualifications.length > 0) {
    lines.push('Qualifications:')
    lines.push(...qualifications)
  }

  const preferences = splitBulletLines(favorEn)
  if (preferences.length > 0) {
    lines.push('Preferences:')
    lines.push(...preferences)
  }

  const notes = splitBulletLines(memoEn)
  if (notes.length > 0) {
    lines.push('Notes:')
    lines.push(...notes)
  }

  return lines.join('\n') || null
}

export const extractJobsFromDetailPayload = ({
  payload,
  listingCard,
  scrapedAt,
}) => {
  if (!payload?.success || !payload?.data?.result) {
    throw new Error('Samsung Electro-Mechanics public detail payload no longer returns a valid first-party posting')
  }

  const detail = payload.data.result
  if (
    detail.compCd !== COMPANY_CODE
    || detail.cmpNameEn !== COMPANY
    || !isAcceptedSamsungElectroMechanicsKr(detail.cmpNameKr)
    || normalizeWhitespace(detail.siteUrl) !== OFFICIAL_SITE_URL
  ) {
    throw new Error('Samsung Electro-Mechanics exact company detail identity could not be verified')
  }

  const items = Array.isArray(payload.data.items) ? [...payload.data.items] : []
  if (items.length === 0) {
    throw new Error('Samsung Electro-Mechanics public detail payload no longer exposes any role rows')
  }

  const postingDate = toDate(parseIsoDateFromCompact(detail.startdate) || listingCard.postingDate)
  const closingDate = toDate(parseIsoDateFromCompact(detail.enddate) || listingCard.closingDate)
  const postingTitle = normalizeWhitespace(detail.title) || listingCard.title
  const timestamp = toDate(scrapedAt) || new Date()

  return items
    .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0))
    .map((item) => {
      const locationData = parseLocation(item.workPlaceEn || item.workPlaceKr)
      const requiredSkills = splitBulletLines(item.taskEn || item.taskKr)
      const minimumQualification = splitBulletLines(item.qlfctEn || item.qlfctKr).join('\n') || null
      const preferredQualification = splitBulletLines(item.favorEn || item.favorKr).join('\n') || null
      const notes = splitBulletLines(item.memoEn || item.memoKr).join('\n') || null
      const employmentType = /full-time/i.test(notes || '') ? 'Full-time' : null

      return {
        title: normalizeWhitespace(item.titleEn || item.titleKr),
        company: COMPANY,
        location: locationData.location,
        city: locationData.city,
        state: locationData.state,
        country: locationData.country,
        jobId: `${detail.seq}-${item.taskCode}`,
        requisitionId: `${detail.seq}-${item.taskCode}`,
        sourceUrl: listingCard.sourceUrl,
        applyUrl: listingCard.applyUrl,
        employmentType,
        experienceRequired: extractExperienceRequired(item.qlfctEn, detail.qlfctEn),
        minimumQualification,
        preferredQualification,
        requiredSkills,
        postingDate,
        closingDate,
        jobDescription: buildJobDescription({
          postingTitle,
          taskEn: item.taskEn || item.taskKr,
          qlfctEn: item.qlfctEn || item.qlfctKr,
          favorEn: item.favorEn || item.favorKr,
          memoEn: item.memoEn || item.memoKr,
        }),
        remoteStatus: 'On-site',
        department: postingTitle,
        source: SOURCE,
        link: listingCard.applyUrl,
        companyCareerPage: COMPANY_PAGE_URL,
        companyDomain: 'samsungcareers.com',
        atsPlatform: 'samsung-careers',
        scrapedTimestamp: timestamp,
      }
    })
}

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: options.headers || BASE_HEADERS,
  method: options.method || 'GET',
  body: options.body,
  timeoutMs: 20000,
  label: SOURCE,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  headers: options.headers || JSON_HEADERS,
  method: options.method || 'GET',
  body: options.body,
  timeoutMs: 20000,
  label: SOURCE,
})

export const createSamsungElectroMechanicsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now: overrideNow,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL, { headers: BASE_HEADERS })
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Samsung Electro-Mechanics official homepage no longer matches the verified first-party identity')
    }

    const companyPageHtml = await fetchText(COMPANY_PAGE_URL, { headers: BASE_HEADERS })
    if (!hasExactCompanyPageSignal(companyPageHtml)) {
      throw new Error('Samsung Electro-Mechanics exact-company Samsung Careers page no longer matches the verified first-party surface')
    }

    const cardsBySeq = new Map()
    let currentPageNo = 1
    let totalPages = 1

    while (currentPageNo <= totalPages) {
      const body = buildListRequestBody({ currentPageNo })
      const listingHtml = await fetchText(LIST_URL, {
        method: 'POST',
        headers: LIST_HEADERS,
        body,
      })

      const maxPage = extractMaxPage(listingHtml)
      if (Number.isInteger(maxPage) && maxPage > 0) {
        totalPages = maxPage
      }

      for (const card of extractListingCards(listingHtml)) {
        cardsBySeq.set(card.seq, card)
      }

      if (cardsBySeq.size === 0 && hasNoCurrentPostingsSignal(listingHtml)) {
        return []
      }

      currentPageNo += 1
    }

    if (cardsBySeq.size === 0) {
      throw new Error('Samsung Electro-Mechanics listings no longer expose public postings or an official empty-state response')
    }

    const scrapedAt = (overrideNow || now)()
    const jobs = []

    for (const card of cardsBySeq.values()) {
      const payload = await fetchJson(buildDetailUrl(card.seq), { headers: JSON_HEADERS })
      jobs.push(...extractJobsFromDetailPayload({
        payload,
        listingCard: card,
        scrapedAt,
      }))
    }

    return jobs
  },
})

export const run = async (options = {}) => createSamsungElectroMechanicsScraper().run(options)

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
