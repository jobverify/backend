import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { farmVisibleText, visibleFarmCareersHandoff, readFarmOpeningEvidence, readFarmNativeRole } from './nativeRoleContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const listingUrlEvidence = new WeakMap()

export const SOURCE = 'farmtoplate'
export const COMPANY = 'Farm To Plate'
export const HOMEPAGE_URL = 'https://www.farmtoplate.io/'
export const CAREERS_URL = 'https://www.farmtoplate.io/about-us/careers-and-joining-the-team/'
export const PAGE_SITEMAP_URL = 'https://www.farmtoplate.io/page-sitemap.xml'

export const EXPECTED_OPENINGS = [
  {
    title: 'Data Engineer',
    vacancy: 1,
    detailUrl: 'https://www.farmtoplate.io/data-engineer/',
    detailStartMarker: 'Data engineer job description',
    requiredDetailSignals: [
      'Objectives of this role',
      'Required skills and qualifications',
      'mailto:sakshi.verma@farmtoplate.io',
    ],
  },
  {
    title: 'Sr. Devops Engineer',
    vacancy: 2,
    detailUrl: 'https://www.farmtoplate.io/devops-engineer/',
    detailStartMarker: 'Job Title: DevOps Engineer - Associate',
    requiredDetailSignals: [
      'Exp: 7+ Years',
      'FarmtoPlate is setting up a blockchain product research and development team',
      "Bachelor's degree in Computer Science, Engineering, or a related field.",
      'mailto:sakshi.verma@farmtoplate.io',
    ],
  },
  {
    title: 'Jr Devops Engineer',
    vacancy: 1,
    detailUrl: 'https://www.farmtoplate.io/devops-engineer-associate/',
    detailStartMarker: 'DevOps Engineer - Associate',
    requiredDetailSignals: [
      'Job Title: DevOps Engineer - Associate',
      'Exp: 2-3 Years',
      'FarmtoPlate is setting up a blockchain product research and development team',
      'mailto:sakshi.verma@farmtoplate.io',
    ],
  },
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const END_OF_DESCRIPTION_MARKERS = [
  'Submit your CV here',
  'Book a free consultation',
  'Connect With Us And See What Our Product Can Do',
  'Customer Care',
  'Copyright',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;|&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsToLines = (value) => decodeHtmlEntities(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<(p|div|section|article|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractTextLines = (html) => stripTagsToLines(html)
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const defaultFetchPage = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: options.signal,
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const normalizeUrl = (value) => {
  const parsed = new URL(value, HOMEPAGE_URL)

  if (!parsed.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(parsed.pathname)) {
    parsed.pathname = `${parsed.pathname}/`
  }

  parsed.hash = ''
  return parsed.toString()
}

const extractLastMatch = (html, pattern) => {
  const normalizedPattern = pattern.global
    ? pattern
    : new RegExp(pattern.source, `${pattern.flags}g`)
  const matches = [...String(html ?? '').matchAll(normalizedPattern)]
  return matches.at(-1)?.[1] ?? null
}

const findExpectation = (title) =>
  EXPECTED_OPENINGS.find((opening) => opening.title === title) || null

const normalizeVisibleText = (html) =>
  normalizeWhitespace(extractTextLines(html).join(' '))?.toLowerCase() || ''

const extractRelevantDetailLines = ({ title, html }) => {
  const expectation = findExpectation(title)
  if (!expectation) {
    throw new Error(`Farm To Plate role mapping drifted for "${title}"`)
  }

  const rawPage = String(html ?? '')
  const lines = extractTextLines(rawPage)
  const matchingStartIndices = lines
    .map((line, index) => (line.includes(expectation.detailStartMarker) ? index : -1))
    .filter((index) => index >= 0)
  const startIndex = matchingStartIndices.find(
    (index) => !/- Farm to Plate %$/i.test(lines[index]),
  ) ?? matchingStartIndices.at(-1) ?? -1

  if (startIndex < 0) {
    throw new Error(`Farm To Plate role detail page no longer matches the verified first-party jobs surface for "${title}"`)
  }

  for (const signal of expectation.requiredDetailSignals) {
    const normalizedSignal = normalizeWhitespace(signal)
    const inLines = lines.some((line) => line.includes(normalizedSignal))
    const inHtml = normalizeWhitespace(rawPage)?.includes(normalizedSignal)

    if (!inLines && !inHtml) {
      throw new Error(`Farm To Plate role detail page no longer matches the verified first-party jobs surface for "${title}"`)
    }
  }

  const endIndex = lines.findIndex(
    (line, index) => index > startIndex && END_OF_DESCRIPTION_MARKERS.some((marker) => line.includes(marker)),
  )

  return lines
    .slice(startIndex, endIndex >= 0 ? endIndex : lines.length)
    .filter((line) => !END_OF_DESCRIPTION_MARKERS.includes(line))
}

const normalizeExperience = (value) => normalizeWhitespace(value)
  ?.replace(/\bYears\b/i, 'years')
  .replace(/\bYear\b/i, 'year') || null

const extractExperienceRequired = (lines) => {
  const explicitExperience = lines
    .map((line) => line.match(/^Exp:\s*(.+)$/i)?.[1] ?? null)
    .find(Boolean)

  if (explicitExperience) {
    return normalizeExperience(explicitExperience)
  }

  const description = lines.join(' ')

  if (/three or more years of experience/i.test(description)) {
    return '3+ years'
  }

  const rangedYears = description.match(/\b(\d+)\s*-\s*(\d+)\s*years\b/i)
  if (rangedYears) {
    return `${rangedYears[1]}-${rangedYears[2]} years`
  }

  const plusYears = description.match(/\b(\d+)\s*\+\s*years\b/i)
  if (plusYears) {
    return `${plusYears[1]}+ years`
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  // Keep the existing literal drift marker; the visible career anchor supplies
  // the public handoff, independent of animated marketing copy.
  const text = normalizeVisibleText(page)

  return /<title>\s*Supply chain track and trace \| Blockchain \| Farm To Plate\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.farmtoplate\.io\/["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Farm to Plate["']/i.test(page)
    && text.includes('build a transparent, tech-driven, food supply chain of tomorrow')
    && page.includes('/about-us/careers-and-joining-the-team')
    && visibleFarmCareersHandoff(page)
}

export const hasVerifiedPageSitemapSignal = (xml) => {
  const sitemap = String(xml ?? '')

  return EXPECTED_OPENINGS.every((opening) => sitemap.includes(`<loc>${opening.detailUrl}</loc>`))
    && sitemap.includes(`<loc>${CAREERS_URL}</loc>`)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = farmVisibleText(page).toLowerCase()

  return /<title>\s*Careers\s*&amp;\s*Joining the Team\s*-\s*Farm to Plate\s*<\/title>/i.test(page)
    && text.includes('careers & joining the team')
    && text.includes('discover our current openings and find your place in our dynamic team')
    && text.includes('openings at farm to plate')
    && page.includes('mailto:sushma.ganapathi@farmtoplate.io')
}

export const extractOpeningCards = (html) => {
  const page = String(html ?? '')
  const { visibleUrls, headerLinks } = readFarmOpeningEvidence(page)
  const cardMatches = [...page.matchAll(
    /<h2\b[^>]*>\s*(?:<a\b[^>]*>)?\s*Position:\s*([\s\S]*?)<br\s*\/?>\s*Vacancy:\s*(\d+)(?:<\/a>)?\s*<\/h2>/gi,
  )]

  return cardMatches.map((match, index) => {
    const nextMatch = cardMatches[index + 1]
    const block = page.slice(match.index, nextMatch?.index ?? page.length)
    const detailUrl = extractLastMatch(
      block,
      /<a\b[^>]*class=["'][^"']*elementor-button-link[^"']*["'][^>]*href=["']([^"']+)["']/i,
    )
      || extractLastMatch(block, /href=["']([^"']+)["']/i)

    if (!visibleUrls.has(normalizeUrl(detailUrl))) throw new Error('Farm To Plate active opening URL is unavailable')
    const card = {
      title: normalizeWhitespace(match[1]),
      vacancy: Number.parseInt(match[2], 10),
      detailUrl: normalizeUrl(detailUrl),
    }
    listingUrlEvidence.set(card, [detailUrl, ...(headerLinks.get(card.title) || [])]
      .map(href => ({ href, absoluteUrl: normalizeUrl(href) })))
    return card
  })
}

const cardsMatchExpected = (cards) =>
  cards.length === EXPECTED_OPENINGS.length
  && cards.every((card, index) => {
    const expected = EXPECTED_OPENINGS[index]
    return expected
      && card.title === expected.title
      && card.vacancy === expected.vacancy
      && card.detailUrl === expected.detailUrl
  })

export const extractRoleDetail = ({ title, detailUrl, html }) => {
  const native = readFarmNativeRole({ title, detailUrl: normalizeUrl(detailUrl), html })
  return { title, requisitionId: null, sourceUrl: normalizeUrl(detailUrl), employmentType: null,
    experienceRequired: native.rawNativeRoleEvidence.identityQualified ? extractExperienceRequired(native.lines) : null,
    ...Object.fromEntries(Object.entries(native).filter(([key]) => key !== 'lines')) }
}

const extractLegacyRoleDetail = ({ title, detailUrl, html }) => {
  const relevantLines = extractRelevantDetailLines({ title, html })
  const applyUrl = normalizeWhitespace(
    extractLastMatch(
      html,
      /<a\b[^>]*class=["'][^"']*qwords-button[^"']*["'][^>]*href=["'](mailto:[^"']+)["']/i,
    ) || extractLastMatch(html, /href=["'](mailto:[^"']+)["']/i),
  )

  if (!applyUrl) {
    throw new Error(`Farm To Plate role detail page no longer exposes the verified apply flow for "${title}"`)
  }

  return {
    title,
    requisitionId: null,
    sourceUrl: normalizeUrl(detailUrl),
    applyUrl,
    employmentType: null,
    experienceRequired: extractExperienceRequired(relevantLines),
    jobDescription: relevantLines.join('\n'),
  }
}

const buildJob = ({ card, detail }) => {
  const jobId = SOURCE + '-' + new URL(detail.sourceUrl).pathname.split('/').filter(Boolean).at(-1)

  if (!jobId) {
    throw new Error(`Farm To Plate role could not be normalized: "${card.title}"`)
  }

  const listingUrls = listingUrlEvidence.get(card) || []
  const listingIdentityQualified = listingUrls.every(url => url.absoluteUrl === card.detailUrl)
  const identityQualified = listingIdentityQualified && detail.rawNativeRoleEvidence.identityQualified
  return {
    title: card.title,
    company: COMPANY,
    department: null,
    location: null,
    city: null,
    country: null,
    jobId,
    requisitionId: detail.requisitionId,
    sourceUrl: detail.sourceUrl,
    applyUrl: detail.applyUrl,
    employmentType: detail.employmentType,
    experienceRequired: detail.experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: listingIdentityQualified ? detail.jobDescription : null,
    remoteStatus: null,
    sourceDetailComplete: listingIdentityQualified && detail.sourceDetailComplete,
    publicExperienceChecked: listingIdentityQualified && detail.publicExperienceChecked,
    ...(!listingIdentityQualified ? { sourceDetailFailureKind: 'identity-mismatch' }
      : detail.sourceDetailFailureKind ? { sourceDetailFailureKind: detail.sourceDetailFailureKind } : {}),
    rawNativeRoleEvidence: { ...detail.rawNativeRoleEvidence, listingUrls, listingIdentityQualified, identityQualified },
  }
}

export const createFarmToPlateScraper = ({ now = () => new Date().toISOString(), maxJobs: factoryCap = Infinity } = {}) => ({
  async run(options = {}) {
    const { fetchPage = defaultFetchPage, now: overrideNow, signal } = options
    signal?.throwIfAborted()
    const cap = Object.hasOwn(options, 'maxJobs') && options.maxJobs !== undefined ? options.maxJobs ?? Infinity : factoryCap ?? Infinity
    if (!(cap === Infinity || Number.isSafeInteger(cap) && cap >= 0)) throw new RangeError('Farm To Plate invalid result cap')
    if (options.maxPages != null && options.maxPages !== Infinity) throw new RangeError('Farm To Plate finite source-page limits are unsupported')
    let pagesFetched = 0
    const finish = (jobs, cards = []) => {
      signal?.throwIfAborted()
      attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: cards.length,
        observedVacancyCount: cards.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
      return attachInventoryEvidence(jobs, { status: 'discovery-only', surface: CAREERS_URL, firstParty: pagesFetched > 0,
        listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null, verifiedAt: null,
        reason: 'farm-native-vacancy-observations'
          + (cap === 0 ? ';zero-result-limit' : '')
          + (jobs.some(job => !job.rawNativeRoleEvidence.identityQualified) ? ';native-identity-conflict' : '')
          + ';workplace-country-company-scope-unconfirmed;closing-not-read' })
    }
    if (cap === 0) return finish([])
    const read = async url => {
      signal?.throwIfAborted()
      const deadline = AbortSignal.timeout(20000), requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline
      let listener
      const cancelled = new Promise((_, reject) => {
        listener = () => reject(requestSignal.reason)
        requestSignal.addEventListener('abort', listener, { once: true })
      })
      try {
        const page = await Promise.race([Promise.resolve().then(() => {
          requestSignal.throwIfAborted()
          pagesFetched++
          return fetchPage(url, { signal: requestSignal })
        }), cancelled])
        signal?.throwIfAborted()
        requestSignal.throwIfAborted()
        return page
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      } finally {
        requestSignal.removeEventListener('abort', listener)
      }
    }
    const homepage = await read(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Farm To Plate official homepage no longer matches the verified first-party surface')
    }

    const pageSitemap = await read(PAGE_SITEMAP_URL)
    if (pageSitemap.status !== 200 || !hasVerifiedPageSitemapSignal(pageSitemap.html)) {
      throw new Error('Farm To Plate page sitemap no longer advertises the verified careers surface')
    }

    const careersPage = await read(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Farm To Plate verified careers page no longer matches the known first-party jobs surface')
    }

    const cards = extractOpeningCards(careersPage.html)
    if (!cardsMatchExpected(cards)) {
      throw new Error('Farm To Plate opening cards changed materially')
    }

    let scrapedAt
    try {
      scrapedAt = (overrideNow || now)()
    } catch (error) {
      signal?.throwIfAborted()
      throw error
    }
    signal?.throwIfAborted()
    const jobs = []

    for (const card of cards.slice(0, cap)) {
      const detailPage = await read(card.detailUrl)

      if (detailPage.status !== 200) {
        throw new Error(`Farm To Plate role detail page failed to load for "${card.title}"`)
      }

      const detail = extractRoleDetail({
        title: card.title,
        vacancy: card.vacancy,
        detailUrl: card.detailUrl,
        html: detailPage.html,
      })

      jobs.push({
        ...buildJob({ card, detail }),
        source: SOURCE,
        link: detail.applyUrl,
        scrapedAt,
        companyCareerPage: CAREERS_URL,
        companyDomain: 'farmtoplate.io',
        atsPlatform: 'official-company-careers',
      })
    }

    return finish(jobs, cards)
  },
})

export const run = async (options = {}) => createFarmToPlateScraper().run(options)

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
