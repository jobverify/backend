import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'samsungdisplaynoida'
export const COMPANY = 'Samsung Display Noida Pvt. Ltd.'
export const COMPANY_CODE = 'C90'
export const HOMEPAGE_URL = 'https://www.samsungdisplay.com/eng/index.jsp'
export const LOCATION_PAGE_URL = 'https://www.samsungdisplay.com/eng/intro/loc-country.jsp'
export const RECRUIT_PAGE_URL = 'https://www.samsungdisplay.com/eng/career-info/recruit/junior-step.jsp'
export const COMPANY_PAGE_URL = 'https://www.samsungcareers.com/subsid/detail/C90'
export const LIST_URL = 'https://www.samsungcareers.com/hr/list.data'
export const DETAIL_URL = 'https://www.samsungcareers.com/recruit/detail.data'
export const CAREERS_DOMAIN = 'https://www.samsungcareers.com'
export const OFFICIAL_SITE_URL = 'https://www.samsungdisplay.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const BASE_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
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

const isAcceptedSamsungDisplayIdentity = (value) =>
  /^(?:Samsung Display(?: Noida Pvt\. Ltd\.)?|삼성디스플레이)$/i.test(normalizeWhitespace(value) || '')

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
  const normalized = (normalizeWhitespace(page) || '').toLowerCase()
  const visibleText = (stripTags(page) || '').toLowerCase()

  return /<title>\s*Samsung Display\s*<\/title>/i.test(page)
    && visibleText.includes('samsung display')
    && (
      (
        visibleText.includes('oled technology and innovation')
        && visibleText.includes('change the world with advanced display technology')
      )
      || (
        visibleText.includes('a window to the digital world')
        && visibleText.includes('oled finder')
      )
    )
    && (
      /\/eng\/career-info\/recruit\/junior-step\.jsp/i.test(page)
      || (
        visibleText.includes('careers')
        && visibleText.includes('hiring process')
      )
    )
}

export const hasOfficialLocationPageSignal = (html) => {
  const normalized = normalizeWhitespace(html) || ''

  return (
    normalized.includes('Samsung Display Noida (SDN)')
      && normalized.includes('Noida, Uttar Pradesh, India')
      && normalized.includes('Tel +91-120-000-0000')
      && normalized.includes('Global Network')
  ) || (
    normalized.includes('Business Place Information')
      && normalized.includes('Global Operation')
      && normalized.includes('Noida')
      && normalized.includes('India')
      && normalized.includes('SDN')
  )
}

export const hasOfficialRecruitPageSignal = (html) => {
  const visibleText = stripTags(html) || ''

  return (
    visibleText.includes('Junior Recruitment Process')
      || visibleText.includes('Entry-level Hiring Process')
      || visibleText.includes('Hiring Process (Entry-level)')
  )
    && (
      (
        visibleText.includes('Application')
        && visibleText.includes('Interview')
        && (
          visibleText.includes('Health Check')
          || visibleText.includes('Offer Acceptance')
          || visibleText.includes('Final Acceptance')
        )
      )
      || (
        visibleText.includes('Submit Application')
        && visibleText.includes('Review Application')
        && visibleText.includes('Samsung Aptitude Test')
        && visibleText.includes('Interview')
        && visibleText.includes('Medical Test')
      )
    )
}

export const hasExactCompanyPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return (
    /<h2>\s*Samsung Display(?: Noida Pvt\. Ltd\.)?\s*<\/h2>/i.test(page)
      || normalized.includes('THIS IS NOT THE END with Samsung Display')
  )
    && normalized.includes('Samsung Display')
    && normalized.includes('https://www.samsungdisplay.com')
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
  const normalized = normalizeWhitespace(page) || ''

  return /class="divCnt"[^>]+data-max="0"/i.test(page)
    && /class="noData"/i.test(page)
    && (
      normalized.includes('현재 채용중인 공고가 없습니다.')
      || normalized.includes('검색어 또는 검색 조건을 확인해주시기 바랍니다.')
    )
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
    const company = stripTags(match[3])
    if (!isAcceptedSamsungDisplayIdentity(company)) {
      throw new Error('Samsung Display Noida listing HTML no longer resolves to the exact company')
    }

    const [startDate, endDate] = String(match[6] ?? '')
      .split('~')
      .map((value) => parsePeriodDate(value))

    const seq = Number.parseInt(String(match[1]).replace(/[^\d]/g, ''), 10)
    const seqno = Number.parseInt(String(match[2]).replace(/[^\d]/g, ''), 10)

    if (!Number.isInteger(seq) || !Number.isInteger(seqno)) {
      throw new Error('Samsung Display Noida listing HTML no longer exposes stable posting identifiers')
    }

    cards.push({
      seq,
      seqno,
      company,
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
  .map((item) => normalizeWhitespace(item.replace(/^[-•·]\s*/, '')))
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
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }

  const segments = normalized.split(',').map((item) => normalizeWhitespace(item)).filter(Boolean)
  const country = segments.at(-1) || null
  const city = normalizeCity(segments[0] || null)
  const state = segments.length > 2 ? segments[1] : null

  return {
    location: [city || segments[0] || null, ...segments.slice(1)].filter(Boolean).join(', '),
    city,
    state,
    country,
  }
}

const isIndiaLocation = (item, locationData) => {
  const countrySignals = [
    locationData.country,
    item.country,
    item.countryEn,
    item.countryKr,
    item.workPlaceEn,
    item.workPlaceKr,
  ]
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (!countrySignals.includes('india')) {
    return false
  }

  if ((locationData.city || '').toLowerCase() === 'remote') {
    return false
  }

  return locationData.city === 'Noida' || locationData.city === 'Greater Noida'
}

const hasVerifiedNonIndiaLocation = (item) => {
  const location = normalizeWhitespace(item.workPlaceEn || item.workPlaceKr)
  if (!location || /\bindia\b/i.test(location)) return false

  return /[가-힣]/u.test(location)
    || /\b(?:south korea|korea|united states|usa|vietnam|china|japan|taiwan)\b/i.test(location)
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
    throw new Error('Samsung Display Noida detail payload no longer returns a valid first-party posting')
  }

  const detail = payload.data.result
  if (
    detail.compCd !== COMPANY_CODE
    || !isAcceptedSamsungDisplayIdentity(detail.cmpNameEn)
    || normalizeWhitespace(detail.siteUrl) !== OFFICIAL_SITE_URL
  ) {
    throw new Error('Samsung Display Noida exact company detail identity could not be verified')
  }

  const items = Array.isArray(payload.data.items) ? [...payload.data.items] : []
  if (items.length === 0) {
    throw new Error('Samsung Display Noida detail payload no longer exposes any role rows')
  }

  const postingDate = toDate(parseIsoDateFromCompact(detail.startdate) || listingCard.postingDate)
  const closingDate = toDate(parseIsoDateFromCompact(detail.enddate) || listingCard.closingDate)
  const postingTitle = normalizeWhitespace(detail.title) || listingCard.title
  const timestamp = toDate(scrapedAt) || new Date()

  const jobs = items
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
    .filter((job, index) => isIndiaLocation(items[index], job))

  if (jobs.length === 0) {
    if (items.every(hasVerifiedNonIndiaLocation)) return []
    throw new Error('Samsung Display Noida detail role location could not be verified')
  }

  return jobs
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

export const createSamsungDisplayNoidaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now: overrideNow,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL, { headers: BASE_HEADERS })
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Samsung Display official homepage no longer matches the verified first-party identity')
    }

    const locationPageHtml = await fetchText(LOCATION_PAGE_URL, { headers: BASE_HEADERS })
    if (!hasOfficialLocationPageSignal(locationPageHtml)) {
      throw new Error('Samsung Display location page no longer matches the verified Noida first-party surface')
    }

    const recruitPageHtml = await fetchText(RECRUIT_PAGE_URL, { headers: BASE_HEADERS })
    if (!hasOfficialRecruitPageSignal(recruitPageHtml)) {
      throw new Error('Samsung Display recruit page no longer matches the verified first-party surface')
    }

    const companyPageHtml = await fetchText(COMPANY_PAGE_URL, { headers: BASE_HEADERS })
    if (!hasExactCompanyPageSignal(companyPageHtml)) {
      throw new Error('Samsung Display Noida exact-company Samsung Careers page no longer matches the verified first-party surface')
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

      const cards = extractListingCards(listingHtml)
      for (const card of cards) {
        cardsBySeq.set(card.seq, card)
      }

      if (cards.length === 0 && hasNoCurrentPostingsSignal(listingHtml)) {
        return []
      }

      currentPageNo += 1
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

export const run = async (options = {}) => createSamsungDisplayNoidaScraper().run(options)

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
