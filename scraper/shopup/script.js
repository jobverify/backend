export const SOURCE = 'shopup'
export const COMPANY = 'ShopUp'
export const HOMEPAGE_URL = 'https://shopup.org/'
export const CAREERS_URL = 'https://shopup.org/career'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bsearch jobs\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview jobs\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
  /recruitcrm/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
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

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('shopup')
    && normalized.includes('small businesses')
    && normalized.includes('big impact')
    && normalized.includes('embedding commerce, logistics and financing solutions together')
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('we are building tomorrow, join us today')
    && normalized.includes('see open roles')
    && (
      normalized.includes('no available open positions at the moment')
      || (
        normalized.includes('hello@shopup.org')
        && normalized.includes('dhaka 1208, bangladesh')
      )
    )
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractPublicRoleLinks = (html) => {
  const links = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    let url
    try {
      url = new URL(match[1], CAREERS_URL)
    } catch {
      continue
    }

    if (url.protocol !== 'https:' || url.hostname.replace(/^www\./i, '') !== 'shopup.org') continue
    if (!/^\/job-postings\/[^/]+\/?$/i.test(url.pathname)) continue

    const normalizedUrl = `${url.origin}${url.pathname.replace(/\/$/, '')}`
    if (seen.has(normalizedUrl)) continue
    seen.add(normalizedUrl)
    links.push(normalizedUrl)
  }

  return links
}

export const hasVerifiedNonIndiaRoleSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('shopup')
    && normalized.includes('job description')
    && (
      normalized.includes('shopup hq (tejgaon)')
      || /\bdhaka\b[^.]{0,100}\bbangladesh\b/i.test(normalized)
      || /\bdammam\b[^.]{0,100}\b(?:saudi arabia|kingdom of saudi arabia)\b/i.test(normalized)
      || /\bdubai\b[^.]{0,100}\bunited arab emirates\b/i.test(normalized)
      || /\bsingapore\s+\d{5,6}\b/i.test(normalized)
    )
}

export const createShopUpScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('ShopUp official homepage no longer matches the known public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('ShopUp careers page changed materially or no longer matches the verified public surface')
    }

    if (/no available open positions at the moment/i.test(careersPage.html)) return []

    const roleLinks = extractPublicRoleLinks(careersPage.html)
    if (roleLinks.length === 0) {
      throw new Error('ShopUp careers page no longer exposes complete public role links')
    }

    for (const roleLink of roleLinks) {
      const rolePage = await fetchPage(roleLink)
      if (rolePage.status !== 200 || !hasVerifiedNonIndiaRoleSignal(rolePage.html)) {
        throw new Error(`ShopUp public role country could not be verified: ${roleLink}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createShopUpScraper().run(options)
