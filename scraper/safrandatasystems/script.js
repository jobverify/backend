import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'safrandatasystems'
export const COMPANY = 'Safran Data Systems'
export const OFFICIAL_BRAND_NAME = 'Safran Data Systems SAS'
export const VERIFIED_ON = '2026-10-08'
export const COMPANY_PAGE_URL = 'https://www.safran-group.com/fr/societes/safran-data-systems'
export const CAREERS_HOST = 'https://careers.safran-group.com'
export const SEARCH_KEYWORDS = 'Safran Data Systems'
export const SEARCH_URL = `${CAREERS_HOST}/offre-de-emploi/liste-toutes-offres.aspx?Keywords=Safran%20Data%20Systems`
export const SEARCH_RSS_URL = `${CAREERS_HOST}/handlers/offerRss.ashx?LCID=1036&Keywords=Safran%20Data%20Systems`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const SAFRAN_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[\u2012-\u2015]/g, '-')
  .replace(/\u00a0/g, ' ')

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<p\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(stripTags(value))
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeSearchText = (value) => normalizeWhitespace(value)
  ?.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  || ''

const normalizeFrenchDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

const toAbsoluteUrl = (value, baseUrl = SEARCH_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const extractMetaDescription = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<meta[^>]+name="Description"[^>]+content="([^"]+)"/i)?.[1])

const extractTitleText = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const extractFieldById = (html, fieldId) =>
  normalizeWhitespace(String(html ?? '').match(new RegExp(`<p id="${fieldId}">([\\s\\S]*?)<\\/p>`, 'i'))?.[1])

const extractFieldListById = (html, fieldId) => [...String(html ?? '').matchAll(
  new RegExp(`<p id="${fieldId}">([\\s\\S]*?)<\\/p>`, 'gi'),
)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const extractOfferIdFromUrl = (value) =>
  normalizeWhitespace(String(value ?? '').match(/_(\d+)\.aspx(?:\?|$)/i)?.[1])

const extractDepartmentFromAnchorTitle = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalizeWhitespace(normalized?.match(/\)\s*-\s*(.+)$/)?.[1]) || null
}

const extractLocationParts = (value) => {
  const parts = normalizeWhitespace(value)?.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean) || []
  return {
    geographicalArea: parts[0] || null,
    country: parts[1] || null,
    state: parts[2] || null,
    departmentArea: parts[3] || null,
  }
}

const extractCityFromAddress = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const postalMatch = normalized.match(/\b\d{5}\s+(.+)$/)
  return normalizeWhitespace(postalMatch?.[1]) || null
}

export const buildSearchUrl = (page = 1) => {
  const url = new URL(SEARCH_URL)
  const normalizedPage = Math.max(1, Number(page) || 1)

  if (normalizedPage > 1) {
    url.searchParams.set('page', String(normalizedPage))
  } else {
    url.searchParams.delete('page')
  }

  return url.toString()
}

export const createDefaultFetchText = ({
  fetchImpl = fetch,
} = {}) => async (url, { signal } = {}) => {
  const response = await fetchImpl(url, {
    headers: SAFRAN_HEADERS,
    redirect: 'follow',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })

  if (response.url && new URL(response.url).origin !== CAREERS_HOST) {
    throw new Error('Safran careers redirect left the verified public authority: ' + response.url)
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasVerifiedSearchPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalizedTitle = normalizeSearchText(extractTitleText(rawHtml))
  const text = normalizeSearchText(rawHtml)

  return normalizedTitle.startsWith(normalizeSearchText('Safran - Résultat de votre recherche'))
    && normalizedTitle.includes(normalizeSearchText(`Mots clés : ${SEARCH_KEYWORDS}`))
    && /offerRss\.ashx\?lcid=1036&amp;Keywords=Safran%20Data%20Systems/i.test(rawHtml)
    && (/ts-offer-list-item offerlist-item/i.test(rawHtml) || extractReportedTotal(rawHtml) === 0)
    && text.includes(normalizeSearchText(SEARCH_KEYWORDS))
}

export const extractReportedTotal = (html = '') => {
  const match = extractTitleText(html)?.match(/\((\d+) offres, page \d+\)/i)
  return match ? Number(match[1]) : null
}

export const extractTotalPages = (html = '') => {
  const pageNumbers = [...String(html ?? '').matchAll(/liste-toutes-offres\.aspx\?[^"]*page=(\d+)/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite)

  if (!pageNumbers.length) {
    return extractJobCards(html).length ? 1 : 0
  }

  return Math.max(...pageNumbers)
}

export const extractJobCards = (html = '') => [...String(html ?? '').matchAll(
  /<li class="ts-offer-list-item offerlist-item [\s\S]*?<ul class="ts-offer-list-item__description [\s\S]*?<\/ul>/gi,
)]
  .map((match) => {
    const block = match[0]
    const titleAnchor = block.match(
      /<a[^>]*class="[^"]*\bts-offer-list-item__title-link\b[^"]*"[^>]*>[\s\S]*?<\/a>/i,
    )?.[0] || ''

    const sourceUrl = toAbsoluteUrl(titleAnchor.match(/href="([^"]+)"/i)?.[1], SEARCH_URL)
    const title = normalizeWhitespace(titleAnchor.match(/>([\s\S]*?)<\/a>/i)?.[1])
    const anchorTitle = normalizeWhitespace(titleAnchor.match(/title="([^"]+)"/i)?.[1])
    const detailsHtml = block.match(/<ul class="ts-offer-list-item__description [\s\S]*?<\/ul>/i)?.[0] || ''
    const details = [...detailsHtml.matchAll(/<li(?: [^>]*)?>([\s\S]*?)<\/li>/gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)
    const requisitionId = normalizeWhitespace(details[0]?.replace(/^Réf\.\s*:\s*/i, ''))
    const offerId = extractOfferIdFromUrl(sourceUrl) || normalizeWhitespace(requisitionId?.match(/(\d+)$/)?.[1])

    if (!sourceUrl || !title || !requisitionId || !offerId) {
      return null
    }

    return {
      title,
      company: COMPANY,
      department: extractDepartmentFromAnchorTitle(anchorTitle),
      location: normalizeWhitespace(details[3]),
      city: extractCityFromAddress(details[3]),
      state: null,
      country: 'France',
      jobId: offerId,
      requisitionId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeWhitespace(details[2]),
      postingDate: normalizeFrenchDate(details[1]),
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const hasVerifiedDetailSignal = (html = '', card = {}) => {
  const rawHtml = String(html ?? '')
  const normalizedTitle = normalizeSearchText(extractTitleText(rawHtml))
  const metaDescription = extractMetaDescription(rawHtml)
  const text = normalizeSearchText(rawHtml)
  const title = extractFieldById(rawHtml, 'fldjobdescription_jobtitle')
  const description = extractFieldById(rawHtml, 'fldjobdescription_description1')
  const geographicalLocation = extractFieldById(rawHtml, 'fldlocation_location_geographicalareacollection')
  const reference = metaDescription?.match(/\bRef\s*:\s*([A-Z0-9][A-Z0-9/.-]*\d)(?:\.|$|\s)/i)?.[1]
  const detailOfferId = reference?.match(/-(\d+)$/)?.[1]
  const directCompany = metaDescription?.includes("Offre d'emploi " + OFFICIAL_BRAND_NAME + ' -')
  const verifiedDivision = /Offre d'emploi (?:Space & Communication|On Board & Testing)(?: de '|\s*-)/.test(metaDescription || '')
    && /^SDS\/[A-Z0-9/.-]+-\d+$/i.test(reference || '')
    && detailOfferId === String(card.jobId ?? '')
    && /\bSafran Data Systems\b/i.test(description || '')
  return normalizedTitle.startsWith(normalizeSearchText('Safran -'))
    && (directCompany || verifiedDivision)
    && Boolean(title && description)
    && (!card.title || title === normalizeWhitespace(card.title))
    && (!card.jobId || detailOfferId === String(card.jobId))
    && (!card.requisitionId || reference === String(card.requisitionId))
    && extractLocationParts(geographicalLocation).country === 'France'
    && /value="Je postule à cette offre"/i.test(rawHtml)
    && text.includes(normalizeSearchText('Description du poste'))
    && text.includes(normalizeSearchText('Localisation du poste'))
}

export const extractJobDetail = (html, card = {}) => {
  const rawHtml = String(html ?? '')
  const title = extractFieldById(rawHtml, 'fldjobdescription_jobtitle') || card.title || null
  const contract = extractFieldById(rawHtml, 'fldjobdescription_contract') || card.employmentType || null
  const descriptionBlocks = [
    ...extractFieldListById(rawHtml, 'fldjobdescription_description1'),
    ...extractFieldListById(rawHtml, 'fldjobdescription_longtext2'),
    ...extractFieldListById(rawHtml, 'fldjobdescription_description2'),
  ]
  const geographicalLocation = extractFieldById(rawHtml, 'fldlocation_location_geographicalareacollection')
  const jobLocation = extractFieldById(rawHtml, 'fldlocation_joblocation')
  const locationParts = extractLocationParts(geographicalLocation)
  const city = extractCityFromAddress(jobLocation) || card.city || null
  const location = normalizeWhitespace(
    jobLocation
      ? `${jobLocation}, France`
      : geographicalLocation || card.location || 'France',
  )

  return {
    title,
    company: COMPANY,
    department: card.department || null,
    location,
    city,
    state: locationParts.state || locationParts.departmentArea || null,
    country: 'France',
    jobId: card.jobId || null,
    requisitionId: card.requisitionId || null,
    sourceUrl: card.sourceUrl || null,
    applyUrl: card.applyUrl || card.sourceUrl || null,
    employmentType: contract,
    experienceRequired: extractFieldById(rawHtml, 'fldapplicantcriteria_experiencelevel'),
    minimumQualification: extractFieldById(rawHtml, 'fldapplicantcriteria_educationlevel'),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: card.postingDate || null,
    closingDate: null,
    jobDescription: normalizeWhitespace(descriptionBlocks.join('\n\n')),
  }
}

export const createSafranDataSystemsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText, signal } = {}) {
    const fetchTextImpl = fetchText || createDefaultFetchText()
    const getText = async (url) => {
      signal?.throwIfAborted()
      const html = await fetchTextImpl(url, { signal })
      signal?.throwIfAborted()
      return html
    }
    const firstPageHtml = await getText(buildSearchUrl(1))
    if (!hasVerifiedSearchPageSignal(firstPageHtml)) {
      throw new Error('Safran Data Systems verified keyword search page no longer matches the accessible first-party careers surface')
    }
    const reportedTotal = extractReportedTotal(firstPageHtml)
    const totalPages = extractTotalPages(firstPageHtml)
    if (!Number.isInteger(reportedTotal) || reportedTotal < 0 || (reportedTotal > 0 && totalPages < 1)
      || (reportedTotal === 0 && totalPages > 1)) throw new Error('Safran Data Systems keyword inventory count or pagination is inconsistent')
    const jobs = []
    const seenJobIds = new Set()
    for (let page = 1; page <= Math.max(1, totalPages); page += 1) {
      const pageHtml = page === 1 ? firstPageHtml : await getText(buildSearchUrl(page))
      if (!hasVerifiedSearchPageSignal(pageHtml)) {
        throw new Error('Safran Data Systems verified keyword search page no longer matches the accessible first-party careers surface on page ' + page)
      }
      if (extractReportedTotal(pageHtml) !== reportedTotal || extractTotalPages(pageHtml) !== totalPages) {
        throw new Error('Safran Data Systems keyword listing count or pagination changed on page ' + page)
      }
      const cards = extractJobCards(pageHtml)
      const rawCardCount = [...String(pageHtml).matchAll(/<li class="ts-offer-list-item offerlist-item /gi)].length
      if (cards.length !== rawCardCount || (cards.length === 0 && reportedTotal > 0)) {
        throw new Error('Safran Data Systems keyword listing contains missing or malformed job cards')
      }
      for (const card of cards) {
        if (seenJobIds.has(card.jobId)) throw new Error('Safran Data Systems keyword inventory contains duplicate job identity ' + card.jobId)
        seenJobIds.add(card.jobId)
        const detailHtml = await getText(card.sourceUrl)
        if (!hasVerifiedDetailSignal(detailHtml, card)) {
          throw new Error('Safran Data Systems detail page no longer matches the accessible first-party careers surface for ' + card.sourceUrl)
        }
        const job = extractJobDetail(detailHtml, card)
        jobs.push({ ...job, source: SOURCE, link: job.applyUrl || job.sourceUrl, scrapedAt: now(), sourceListingComplete: false })
      }
    }
    if (jobs.length !== reportedTotal) throw new Error('Safran Data Systems keyword inventory count does not reconcile: expected ' + reportedTotal + ', received ' + jobs.length)
    jobs.sort((left, right) => (left.postingDate || '').localeCompare(right.postingDate || '') * -1)
    // This keyword surface is a France subset. Its count, including zero, cannot authorize global India expiry.
    return attachInventoryEvidence(jobs, {
      status: 'coverage-gap', surface: SEARCH_URL, firstParty: true, listingComplete: false,
      pagesFetched: Math.max(1, totalPages), reportedTotal, indiaFacetCount: null, verifiedAt: now(),
      reason: 'Complete validated France keyword-search inventory only; broader global company inventory and India completeness are unverified. Do not infer India zero or expire jobs from this subset.',
    })
  },
})


// The portal publishes this stateless group-wide India search URL; it is not a
// count of Safran Data Systems or its global openings.
export const INDIA_SEARCH_URL = CAREERS_HOST + '/offre-de-emploi/liste-offres.aspx?lcid=1036&facet_Country=81'
export const INDIA_VERIFIED_ON = '2026-10-09'
const INDIA_EMPLOYERS = new Set([
  'Safran Data Systems India (Captronic)',
  'Safran Data Systems India - Hoodi (Captronic)',
  'Safran Data Systems India - West Shenoy Nagar (Captronic)',
])
const INDIA_PAGE_SIZE = 20

export const buildIndiaSearchUrl = (page = 1) => {
  if (!Number.isInteger(page) || page < 1) throw new Error('Safran India country-search page must be a positive integer')
  const url = new URL(INDIA_SEARCH_URL)
  if (page > 1) url.searchParams.set('page', String(page))
  return url.toString()
}

const readIndiaListing = (html, page, expectedTotal = null) => {
  const title = normalizeSearchText(extractTitleText(html))
  const titleMatch = title.match(/^safran - resultat de votre recherche \((\d+) offres, page (\d+)\) \/ (?:pays|country) : asie-->inde$/)
  const total = titleMatch ? Number(titleMatch[1]) : null
  const visibleTotal = String(html).match(/id="ctl00_ctl00_corpsRoot_corps_Pagination_TotalOffers"[^>]*>\s*(\d+)\s+offre\(s\)/i)
  if (!titleMatch || Number(titleMatch[2]) !== page || !visibleTotal || Number(visibleTotal[1]) !== total
    || !/offerRss\.ashx\?lcid=1036&amp;Rss_Country=81(?:["&])/i.test(String(html))
    || (expectedTotal != null && total !== expectedTotal)) {
    throw new Error('Safran India country listing identity, count or page changed on page ' + page)
  }
  const totalPages = Math.max(1, Math.ceil(total / INDIA_PAGE_SIZE))
  if (totalPages > 50 || page > totalPages) throw new Error('Safran India country inventory pagination exceeds verified bounds')
  const paginationTotals = [...String(html).matchAll(/title="Résultat de votre recherche - page \d+ \/ (\d+)"/gi)].map((match) => Number(match[1]))
  if ((totalPages > 1 && paginationTotals.length === 0)
    || paginationTotals.some((lastPage) => lastPage !== totalPages)) {
    throw new Error('Safran India country listing pagination does not reconcile')
  }
  const rawCardCount = [...String(html).matchAll(/<li class="ts-offer-list-item offerlist-item /gi)].length
  const cards = extractJobCards(html)
  const expectedCards = Math.min(INDIA_PAGE_SIZE, Math.max(0, total - (page - 1) * INDIA_PAGE_SIZE))
  if (cards.length !== rawCardCount || cards.length !== expectedCards) {
    throw new Error('Safran India country listing contains truncated or malformed cards on page ' + page)
  }
  for (const card of cards) {
    const url = new URL(card.sourceUrl)
    if (url.origin !== CAREERS_HOST || url.username || url.password || url.search || url.hash
      || !/^\/offre-de-emploi\/emploi-[^/]+_\d+\.aspx$/.test(url.pathname)
      || card.jobId !== extractOfferIdFromUrl(url.href)
      || card.requisitionId.match(/-(\d+)$/)?.[1] !== card.jobId || !card.postingDate) {
      throw new Error('Safran India country listing has an unverified job identity')
    }
    // Country is established below from the native workplace field; the legacy
    // France keyword extractor's assignment must not leak into this adapter.
    card.country = null
    card.city = null
  }
  return { total, totalPages, cards }
}


// ICU names unknown/pseudo regions too; use only ISO countries and territories.
const ISO_COUNTRY_CODES = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ')
const foreignCountryNames = new Set(['united states of america', 'usa', 'u.s.a', 'u.s', 'uk', 'u.k', 'great britain'])
for (const language of ['en', 'fr']) {
  const names = new Intl.DisplayNames([language], { type: 'region', fallback: 'none' })
  for (const code of ISO_COUNTRY_CODES) {
    if (code !== 'IN') foreignCountryNames.add(normalizeSearchText(names.of(code)))
  }
}
const hasExplicitForeignAddressCountry = (address) => {
  const parts = String(address).split(/[,;\n]/).map((part) => normalizeSearchText(part).replace(/[.]+$/, ''))
  return parts.some((part) => [...foreignCountryNames].some((country) => (
    part === country || part.endsWith(' ' + country)
  )))
}

const listingFingerprint = (cards) => JSON.stringify(cards.map((card) => ({
  jobId: card.jobId, requisitionId: card.requisitionId, title: card.title,
  sourceUrl: card.sourceUrl, postingDate: card.postingDate,
  department: card.department, employmentType: card.employmentType, location: card.location,
})))

const readNativeIndiaIdentity = (html, card) => {
  const meta = extractMetaDescription(html)
  const identity = meta?.match(/^Offre d'emploi (.+?) de '([\s\S]+)'\. Lieu : ([\s\S]*?)\. Date : (\d{2}\/\d{2}\/\d{4})\. Ref : ([A-Z0-9/ .-]{1,200})\.$/i)
  const title = extractFieldById(html, 'fldjobdescription_jobtitle')
  const geography = extractLocationParts(extractFieldById(html, 'fldlocation_location_geographicalareacollection'))
  if (!identity || title !== card.title || normalizeWhitespace(identity[2]) !== card.title
    || extractTitleText(html) !== 'Safran - ' + card.title
    || identity[5] !== card.requisitionId || normalizeFrenchDate(identity[4]) !== card.postingDate
    || !['Asia', 'Asie'].includes(geography.geographicalArea)
    || !['India', 'Inde'].includes(geography.country)
    || !/value="Je postule à cette offre"/i.test(html)) {
    throw new Error('Safran India detail identity or workplace country conflicts with listing for ' + card.sourceUrl)
  }
  const employer = normalizeWhitespace(identity[1])
  if (/Safran Data Systems/i.test(employer) && !INDIA_EMPLOYERS.has(employer)) {
    throw new Error('Safran India native employer alias is unverified: ' + employer)
  }
  return { employer, geography }
}

const readSdsIndiaDetail = (html, card, identity) => {
  const jobLocation = extractFieldById(html, 'fldlocation_joblocation')
  if (jobLocation && hasExplicitForeignAddressCountry(jobLocation)) {
    throw new Error('Safran SDS India native workplace location country conflicts with India geography for ' + card.sourceUrl)
  }
  const contract = extractFieldById(html, 'fldjobdescription_contract')
  const experience = extractFieldById(html, 'fldapplicantcriteria_experiencelevel')
  const education = extractFieldById(html, 'fldapplicantcriteria_educationlevel')
  const blocks = [
    ...extractFieldListById(html, 'fldjobdescription_description1'),
    ...extractFieldListById(html, 'fldjobdescription_longtext2'),
    ...extractFieldListById(html, 'fldjobdescription_description2'),
  ]
  const description = normalizeWhitespace(blocks.join('\n\n'))
  const headings = [...String(html).matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map((match) => normalizeSearchText(match[1]))
  if (!jobLocation || !contract || !experience || !education || !description || description.length < 200
    || !headings.some((heading) => ['job description', 'description du poste'].includes(heading))
    || !headings.some((heading) => ['job location', 'localisation du poste'].includes(heading))) {
    throw new Error('Safran SDS India detail is missing native workplace, description or role fields for ' + card.sourceUrl)
  }
  return {
    title: card.title, company: COMPANY, employerLegalName: identity.employer,
    department: card.department, location: jobLocation + ', India', city: null,
    state: identity.geography.state || null, country: 'India',
    jobId: card.jobId, requisitionId: card.requisitionId,
    sourceUrl: card.sourceUrl, applyUrl: card.sourceUrl, employmentType: contract,
    experienceRequired: experience, minimumQualification: education,
    preferredQualification: null, requiredSkills: [], postingDate: card.postingDate,
    closingDate: null, jobDescription: description,
  }
}

const isUnavailableDetail = (error) => (
  error?.name === 'TimeoutError'
  || /^HTTP (?:401|403|404|408|429|5\d\d) for /.test(error?.message || '')
  || /^(?:fetch failed|Request timed out|connect ETIMEDOUT)/i.test(error?.message || '')
)

export const createSafranDataSystemsIndiaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText, signal, detailConcurrency = 6 } = {}) {
    if (!Number.isInteger(detailConcurrency) || detailConcurrency < 1 || detailConcurrency > 8) {
      throw new Error('Safran India detail concurrency must be between 1 and 8')
    }
    const fetchTextImpl = fetchText || createDefaultFetchText()
    const getText = async (url) => {
      signal?.throwIfAborted()
      const html = await fetchTextImpl(url, { signal })
      signal?.throwIfAborted()
      return html
    }
    const firstHtml = await getText(buildIndiaSearchUrl(1))
    const first = readIndiaListing(firstHtml, 1)
    const cards = []
    const seen = new Set()
    for (let page = 1; page <= first.totalPages; page += 1) {
      const listing = page === 1 ? first : readIndiaListing(await getText(buildIndiaSearchUrl(page)), page, first.total)
      for (const card of listing.cards) {
        if (seen.has(card.jobId)) throw new Error('Safran India country inventory has duplicate identity ' + card.jobId)
        seen.add(card.jobId)
        cards.push(card)
      }
    }
    if (cards.length !== first.total) throw new Error('Safran India country inventory count does not reconcile')
    const jobs = []
    const unavailable = []
    let nextCard = 0
    let fatal = null
    const worker = async () => {
      while (nextCard < cards.length && !fatal) {
        const card = cards[nextCard++]
        try {
          let html
          try {
            html = await getText(card.sourceUrl)
          } catch (error) {
            signal?.throwIfAborted()
            if (!isUnavailableDetail(error)) throw error
            unavailable.push(card.jobId)
            continue
          }
          const identity = readNativeIndiaIdentity(html, card)
          if (!INDIA_EMPLOYERS.has(identity.employer)) continue
          const job = readSdsIndiaDetail(html, card, identity)
          jobs.push({ ...job, source: SOURCE, link: job.applyUrl, scrapedAt: now(), sourceListingComplete: false })
        } catch (error) {
          fatal ||= error
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(detailConcurrency, cards.length) }, worker))
    if (fatal) throw fatal
    signal?.throwIfAborted()
    const recheck = readIndiaListing(await getText(buildIndiaSearchUrl(1)), 1, first.total)
    if (listingFingerprint(recheck.cards) !== listingFingerprint(first.cards)) {
      throw new Error('Safran India country listing snapshot changed during detail audit')
    }
    jobs.sort((left, right) => (right.postingDate || '').localeCompare(left.postingDate || '') || left.jobId.localeCompare(right.jobId))
    // This group-country subset cannot establish a complete company inventory.
    return attachInventoryEvidence(jobs, {
      status: 'coverage-gap', surface: INDIA_SEARCH_URL, firstParty: true, listingComplete: false,
      pagesFetched: first.totalPages, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
      reason: 'Native group India search reconciled ' + first.total + ' cards across ' + first.totalPages
        + ' pages; ' + jobs.length + ' exact SDS India employer jobs validated; ' + unavailable.length
        + ' detail(s) unavailable' + (unavailable.length ? ' (IDs: ' + unavailable.sort().join(', ') + ')' : '')
        + '. Company global and India inventory totals/completeness remain unknown. This partial subset cannot establish India zero or authorize expiry.',
    })
  },
})

export const run = async (options = {}) => createSafranDataSystemsIndiaScraper().run(options)

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
