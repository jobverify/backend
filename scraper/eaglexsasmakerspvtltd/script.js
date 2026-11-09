export const SOURCE = 'eaglexsasmakerspvtltd'
export const COMPANY = 'Eaglex SAS Makers Pvt Ltd'
export const VERIFIED_AT = '2026-08-13'
export const HOMEPAGE_URL = 'https://eaglex.co.in/'
export const ABOUT_URL = 'https://eagle-x.in/about'
export const CONTACT_URL = 'https://eagle-x.in/contact'
export const CAREERS_ROUTE_URLS = [
  'https://eagle-x.in/careers',
  'https://eagle-x.in/careers/',
  'https://eagle-x.in/jobs',
  'https://eagle-x.in/jobs/',
  'https://eagle-x.in/work-with-us',
  'https://eagle-x.in/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?(?:eaglex\.co\.in|eagle-x\.in))?\/(?:careers?|jobs?|work-with-us)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bwe are hiring\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
  /freshteam/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  const lower = normalized.toLowerCase()
  const rawHtml = String(html ?? '')

  const hasLegacySurface =
    normalized.includes('Eagle X | We Engineer Dominance')
    && normalized.includes('Eagle X Systems')
    && normalized.includes('We Engineer Dominance')
    && normalized.includes('production-ready digital products in 7 days')
    && normalized.includes('Launch Initiative 2026')
    && normalized.includes('eaglexdevelopment@gmail.com')
    && normalized.includes('Indore, Madhya Pradesh, India')
    && /https:\/\/(?:www\.)?(?:eagle-x\.in|eaglex\.co\.in)/i.test(rawHtml)
  const hasCurrentSurface =
    lower.includes('eagle x | we engineer dominance')
    && lower.includes('we engineer dominance')
    && (
      lower.includes('forging high-performance digital infrastructure for the next generation of unicorn founders.')
      || lower.includes('architecting ultra-resilient digital infrastructure for the next generation of unicorn founders')
    )
    && (
      lower.includes('mvp in 7 days')
      || lower.includes('we build platforms that scale flawlessly from day one.')
    )
    && (
      lower.includes('rapid deployment')
      || lower.includes('enterprise deployment')
    )
    && (
      lower.includes('deploy unit')
      || lower.includes('elite software engineering studio systems')
    )

  const hasRebrandedHomepageSurface =
    lower.includes('eaglex | the team that builds, guards & grows')
    && rawHtml.includes('Organization')
    && rawHtml.includes('alternateName')

  return hasLegacySurface || hasCurrentSurface || hasRebrandedHomepageSurface
}

const hasOfficialRebrandedPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const lower = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Eagle X \| We Engineer Dominance\s*<\/title>/i.test(rawHtml)
    && rawHtml.includes('https://eagle-x.in/#organization')
    && lower.includes('high-performance software engineering studio')
    && lower.includes('eagle x systems')
}

export const hasOfficialAboutPageSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  const lower = normalized.toLowerCase()
  const rawHtml = String(html ?? '')

  return hasOfficialHomepageSignal(html)
    || hasOfficialRebrandedPageSignal(html)
    || (
      /<title>\s*Eagle X \| We Engineer Dominance\s*<\/title>/i.test(rawHtml)
    && lower.includes('system identity')
    && lower.includes('the architects of the new order')
    && lower.includes('we are not just a dev shop')
    && lower.includes('high-performance engineering unit dedicated to building digital dominance')
    && lower.includes('while others follow trends, we forge the infrastructure that defines them')
    && lower.includes('projects deployed')
    && lower.includes('global partners')
    )
}

export const hasOfficialContactPageSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  const lower = normalized.toLowerCase()
  const rawHtml = String(html ?? '')

  return hasOfficialHomepageSignal(html)
    || hasOfficialRebrandedPageSignal(html)
    || (
      /<title>\s*Eagle X \| We Engineer Dominance\s*<\/title>/i.test(rawHtml)
    && lower.includes('get in touch')
    && lower.includes('contact us')
    && lower.includes("we'd love to hear from you")
    && lower.includes("send us a message and we'll get back to you within 24 hours")
    && lower.includes('delhi, india')
    && lower.includes('support team')
    && lower.includes('send message')
    && lower.includes('building professional web solutions for early-stage startups')
    && lower.includes('2026 launch initiative supporting the entrepreneurial ecosystem')
    && lower.includes('eaglexdevelopment@gmail.com')
    )
}

export const hasOfficialPageSignal = (html) =>
  hasOfficialHomepageSignal(html)
  || hasOfficialAboutPageSignal(html)
  || hasOfficialContactPageSignal(html)

export const hasFirstPartyCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const lower = normalizeWhitespace(rawHtml).toLowerCase()

  const matchesLegacySoft404 = Number(page?.status) === 200
    && hasOfficialHomepageSignal(rawHtml)
    && /404:\s*This page could not be found\./i.test(rawHtml)

  const matchesCurrentHard404 = Number(page?.status) === 404
    && /<title>\s*404:\s*This page could not be found\.\s*<\/title>/i.test(rawHtml)
    && lower.includes('this page could not be found')
    && lower.includes('building professional web solutions for early-stage startups')
    && lower.includes('2026 launch initiative supporting the entrepreneurial ecosystem')
    && lower.includes('eaglexdevelopment@gmail.com')
    && (
      lower.includes('indore, madhya pradesh, india')
      || (
        lower.includes('global / remote studio')
        && hasOfficialHomepageSignal(rawHtml)
        && rawHtml.includes('https://eagle-x.in/#organization')
      )
    )

  return (matchesLegacySoft404 || matchesCurrentHard404)
    && !hasPublicJobsSignal(rawHtml)
    && !hasFirstPartyCareerLikeLink(rawHtml)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createEaglexSasMakersScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const verifiedPageUrls = [
      { url: HOMEPAGE_URL, validator: hasOfficialHomepageSignal },
      { url: ABOUT_URL, validator: hasOfficialAboutPageSignal },
      { url: CONTACT_URL, validator: hasOfficialContactPageSignal },
    ]

    for (const { url, validator } of verifiedPageUrls) {
      const page = await fetchPage(url)

      if (page.status !== 200 || !validator(page.html)) {
        throw new Error(`${COMPANY} verified first-party marketing surface no longer matches the known public site`)
      }

      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`${COMPANY} first-party marketing surface now exposes a public careers surface`)
      }

      if (hasFirstPartyCareerLikeLink(page.html)) {
        throw new Error(`${COMPANY} first-party marketing surface now links to a careers route`)
      }
    }

    const careersRoutes = await Promise.all(
      CAREERS_ROUTE_URLS.map(async (careersRouteUrl) => ({
        careersRouteUrl,
        careersRoute: await fetchPage(careersRouteUrl),
      })),
    )

    for (const { careersRouteUrl, careersRoute } of careersRoutes) {
      if (!isVerifiedMissingCareersRoute(careersRoute)) {
        throw new Error(`${COMPANY} public careers surface changed materially or now exposes jobs`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createEaglexSasMakersScraper().run(options)
