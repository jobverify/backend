import { createFailClosedSentinelScraper } from './failClosedSentinel.js'

export const SOURCE = 'cloudphysician'
export const COMPANY = 'Cloudphysician'
export const OFFICIAL_BRAND = 'Cloudphysician'
export const CAREERS_URL = 'https://www.cloudphysician.net/careers/'
export const APPLY_NOW_URL = 'mailto:careers@cloudphysician.net'
export const DISPOSITION = 'verified-first-party-careers-surface-with-dead-same-origin-jd-handoffs'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, July 26, 2026 that https://www.cloudphysician.net/careers/ was the live exact-company Cloudphysician careers page, that its Apply now CTA pointed to mailto:careers@cloudphysician.net, and that it publicly enumerated 17 role titles across Clinical, Technology, Business, and Business Enablers. Each currently linked first-party JD handoff under https://www.cloudphysician.net/careers/assets/jds/ returned 404 instead of a trustworthy role-details or application flow, so no trustworthy enumerable public jobs contract was verified and this company-local scraper stays fail-closed until Cloudphysician exposes a stable first-party openings surface.'

export const EXPECTED_OPENINGS = [
  {
    title: 'Clinical Intensivist',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20220331_Clinical-Intensivist.pdf',
  },
  {
    title: 'Specialist',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20220331_Specialist-Physician.pdf',
  },
  {
    title: 'Critical Care Registered Nurse',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20220331_Critical-Care-Registered-Nurse.pdf',
  },
  {
    title: 'Neonatal Pediatric Care Registered Nurse',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/Nicu-Nurse.pdf',
  },
  {
    title: 'Registered Nurse',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20220331_Registered-Nurse.pdf',
  },
  {
    title: 'Clinical Dietitian',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20220331_Clinical-Dietitian.pdf',
  },
  {
    title: 'Clinical Pharmacist',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20220331_Clinical-Pharmacist.pdf',
  },
  {
    title: 'Product Designer',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/Product_Designer_JD.pdf',
  },
  {
    title: 'Head of Complaince',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20250606_HeadofComplaince_JD.pdf',
  },
  {
    title: 'Engineering Manager',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20250606_EngineeringManager_JD.pdf',
  },
  {
    title: 'Data Engineer',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20220331_Data-Engineer.pdf',
  },
  {
    title: 'DevOps Engineer',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20240912_DevOpsEngineer_JD.pdf',
  },
  {
    title: 'QA Engineer',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20220919_QAEngineer-Automation-Selenium_JD.pdf',
  },
  {
    title: 'ML Engineer',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20250507_MLEngineeJD.pdf',
  },
  {
    title: 'Accounts Executive',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20220331_Accounts-Executive.pdf',
  },
  {
    title: 'Executive Assistant to CEO',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20220331_Executive-assistant-to-CEO.pdf',
  },
  {
    title: 'Marketing Associate',
    jdUrl: 'https://www.cloudphysician.net/careers/assets/jds/20250613_Marketing_Associate_JD.pdf',
  },
]

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify/1.0)'
const EXPECTED_JD_PATHS = new Set(
  EXPECTED_OPENINGS.map(({ jdUrl }) => new URL(jdUrl).pathname.replace(/\/+$/, '')),
)

const REQUIRED_SURFACE_PATTERNS = [
  /\bcareers at cloudphysician\b/i,
  /\byou can't care about people without caring about your own\b/i,
  /\bpatient care is at the center of what we do\b/i,
  /\bwe push boundaries with our cutting-edge technology\b/i,
  /\bopen positions\b/i,
  /\bclinical\b/i,
  /\btechnology\b/i,
  /\bbusiness\b/i,
  /\bbusiness enablers\b/i,
]

const ATS_HOST_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /jobs\.ashbyhq\.com/i,
  /ashbyhq\.com/i,
  /myworkdayjobs\.com/i,
  /workdayjobs\.com/i,
  /smartrecruiters\.com/i,
  /jobvite\.com/i,
  /workable\.com/i,
  /bamboohr\.com/i,
  /applytojob\.com/i,
  /recruitee\.com/i,
  /zohorecruit\.in/i,
  /darwinbox/i,
  /kekahire\.com/i,
  /freshteam\.com/i,
  /teamtailor\.com/i,
]

const LINKEDIN_JOBS_PATTERN = /^https?:\/\/(?:www|in)\.linkedin\.com\/(?:company\/[^/?#]+\/jobs|jobs\/search)/i
const SAME_ORIGIN_JOB_PATH_PATTERNS = [
  /^\/jobs?(?:\/|$)/i,
  /^\/careers?(?:\/(?!assets\/jds\/)|$)/i,
  /^\/positions?(?:\/|$)/i,
  /^\/openings?(?:\/|$)/i,
  /^\/roles?(?:\/|$)/i,
  /^\/apply(?:\/|$)/i,
]

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value = '') =>
  normalizeWhitespace(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ) || ''

const looksLikeNavigableUrlValue = (value = '') => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (/^(?:https?:|mailto:|tel:|\/|\.\/|\.\.\/|[?#])/i.test(normalized)) return true
  if (/^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]+(?:[?#].*)?$/i.test(normalized)) return true
  return false
}

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (!looksLikeNavigableUrlValue(normalized)) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizePathname = (value = '') => {
  const normalized = String(value).trim().replace(/\/+$/, '')
  return normalized || '/'
}

const extractLinkedUrls = (html = '', pageUrl = CAREERS_URL) => {
  const urls = []
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''
    const absoluteUrl = toAbsoluteUrl(rawValue, pageUrl)
    if (absoluteUrl) urls.push(new URL(absoluteUrl))
  }

  return urls
}

const hasJobPostingMarkup = (html = '') => {
  const blocks = String(html).matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )

  for (const block of blocks) {
    if (/\bJobPosting\b/i.test(block[1])) return true
  }

  return false
}

const extractJobsSectionHtml = (html = '') => {
  const page = String(html)
  const startIndex = page.indexOf('Open positions')
  const endIndex = [
    page.indexOf('<app-footer', startIndex),
    page.indexOf('<footer', startIndex),
    page.indexOf('</body>', startIndex),
  ]
    .filter((candidate) => candidate > startIndex)
    .sort((left, right) => left - right)[0] ?? -1

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error(
      'Cloudphysician verified official careers surface changed; review the public contract before promoting a real parser.',
    )
  }

  return page.slice(startIndex, endIndex)
}

const extractAnchors = (html = '', pageUrl = CAREERS_URL) =>
  [...String(html).matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
  )]
    .map((match) => {
      const rawHref = match[1] || match[2] || match[3] || ''
      const url = toAbsoluteUrl(rawHref, pageUrl)
      const text = normalizeText(match[4] || '')

      if (!url || !text) return null
      return { url, text }
    })
    .filter(Boolean)

export const extractVerifiedApplyNowUrl = (html = '', pageUrl = CAREERS_URL) => {
  const jobsSectionHtml = extractJobsSectionHtml(html)

  return extractAnchors(jobsSectionHtml, pageUrl)
    .find(({ text }) => /^apply now$/i.test(text))
    ?.url || null
}

export const extractVerifiedOpeningLinks = (html = '', pageUrl = CAREERS_URL) => {
  const jobsSectionHtml = extractJobsSectionHtml(html)

  return extractAnchors(jobsSectionHtml, pageUrl)
    .filter(({ text }) => !/^apply now$/i.test(text))
    .map(({ text, url }) => ({
      title: text,
      jdUrl: url,
    }))
}

export const assertVerifiedPublicCareersSurface = (html = '') => {
  const text = normalizeText(html)

  if (!REQUIRED_SURFACE_PATTERNS.every((pattern) => pattern.test(text))) {
    throw new Error(
      'Cloudphysician verified official careers surface changed; review the public contract before promoting a real parser.',
    )
  }
}

export const assertVerifiedApplyNowHandoff = (html = '', pageUrl = CAREERS_URL) => {
  if (extractVerifiedApplyNowUrl(html, pageUrl) === APPLY_NOW_URL) return

  throw new Error(
    'Cloudphysician verified apply-now handoff changed; review the public careers contract.',
  )
}

export const assertVerifiedOpeningCatalog = (html = '', pageUrl = CAREERS_URL) => {
  const actual = extractVerifiedOpeningLinks(html, pageUrl)

  if (JSON.stringify(actual) === JSON.stringify(EXPECTED_OPENINGS)) return

  throw new Error(
    'Cloudphysician verified opening catalog changed; review the public careers contract.',
  )
}

export const assertNoUnexpectedPublicJobsSurface = (html = '', careersUrl = CAREERS_URL) => {
  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Cloudphysician public careers surface now exposes JobPosting markup; review whether a real parser should replace the fail-closed sentinel.',
    )
  }

  const careersPage = new URL(careersUrl)
  const careersPath = normalizePathname(careersPage.pathname)
  const linkedUrls = extractLinkedUrls(html, careersUrl)

  const atsBoardUrl = linkedUrls.find((url) =>
    ATS_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))
      || LINKEDIN_JOBS_PATTERN.test(url.toString()),
  )
  if (atsBoardUrl) {
    throw new Error(
      `Cloudphysician public careers surface now exposes a public jobs surface via ${atsBoardUrl.toString()}.`,
    )
  }

  const sameOriginPublicJobsUrl = linkedUrls.find((url) => {
    if (url.origin !== careersPage.origin) return false

    const pathname = normalizePathname(url.pathname)
    if (pathname === careersPath && !url.search && !url.hash) return false
    if (pathname.startsWith('/careers/assets/') && !pathname.startsWith('/careers/assets/jds/')) {
      return false
    }
    if (pathname === normalizePathname('/careers/assets/jds') || EXPECTED_JD_PATHS.has(pathname)) {
      return false
    }

    if (/^mailto:/i.test(url.toString())) return false

    return SAME_ORIGIN_JOB_PATH_PATTERNS.some((pattern) => pattern.test(pathname))
      || pathname.startsWith('/careers/assets/jds/')
  })

  if (sameOriginPublicJobsUrl) {
    throw new Error(
      `Cloudphysician public careers surface now exposes a public jobs surface via ${sameOriginPublicJobsUrl.toString()}.`,
    )
  }
}

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const defaultFetchStatus = async (url) => {
  const headResponse = await fetch(url, {
    method: 'HEAD',
    redirect: 'follow',
    headers: {
      Accept: 'application/pdf,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    },
  })

  if (headResponse.status !== 403 && headResponse.status !== 405) {
    return headResponse.status
  }

  const getResponse = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'application/pdf,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    },
  })

  return getResponse.status
}

export const assertDeadJdHandoffs = async (fetchStatus = defaultFetchStatus) => {
  for (const { jdUrl } of EXPECTED_OPENINGS) {
    const status = await fetchStatus(jdUrl)
    if (status === 404) continue

    throw new Error(
      `Cloudphysician verified JD handoff is no longer dead: ${jdUrl} returned ${status}. Review whether a trustworthy public jobs contract now exists.`,
    )
  }
}

export const createCloudphysicianScraper = () => ({
  async run({
    fetchHtml = defaultFetchHtml,
    fetchStatus = defaultFetchStatus,
  } = {}) {
    const html = await fetchHtml(CAREERS_URL)

    assertVerifiedPublicCareersSurface(html)
    assertVerifiedApplyNowHandoff(html, CAREERS_URL)
    assertVerifiedOpeningCatalog(html, CAREERS_URL)
    assertNoUnexpectedPublicJobsSurface(html, CAREERS_URL)
    await assertDeadJdHandoffs(fetchStatus)

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createCloudphysicianScraper().run(options)
