export const SOURCE = 'uniqus'
import {runCurrentZohoSource} from './currentNative.js'
export const COMPANY = 'Uniqus'
export const CAREERS_URL = 'https://uniqus.com/careers/'
export const CONTACT_EMAIL = 'careers@uniqus.com'
export const VIEW_OPPORTUNITIES_CTA = 'View Opportunities'
export const DISPOSITION = 'verified-email-handoff-careers-surface'

const CAREERS_HEADING_PATTERN = /\bcareers\b/i
const CONTACT_EMAIL_PATTERN = /\bcareers@uniqus\.com\b/i
const VIEW_OPPORTUNITIES_PATTERN = /\bview opportunities\b/i

const decodeEntities = (value) =>
  String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")

const normalizeText = (value) =>
  decodeEntities(String(value))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const hasAntiRobotBlockerSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /<title>\s*Visitor anti-robot validation\s*<\/title>/i.test(page)
    && text.includes('JavaScript must be enabled to complete the challenge.')
    && text.includes('Please enable JavaScript and reload this page to complete the verification.')
}

const normalizePathname = (value) => {
  const normalized = String(value || '').replace(/\/+$/, '')
  return normalized || '/'
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

const resolveUrl = (value) => {
  if (!value) return null

  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const extractViewOpportunitiesHref = (html = '') => {
  const anchors = String(html).matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
  )

  for (const anchor of anchors) {
    const href = anchor[1] || anchor[2] || anchor[3] || null
    const text = normalizeText(anchor[4])

    if (VIEW_OPPORTUNITIES_PATTERN.test(text)) {
      return resolveUrl(href)
    }
  }

  return null
}

const isFirstPartyListingsSurface = (value) => {
  if (!value) return false

  try {
    const target = new URL(value)
    const careersUrl = new URL(CAREERS_URL)

    if (target.origin !== careersUrl.origin) return false

    const targetPath = normalizePathname(target.pathname)
    const careersPath = normalizePathname(careersUrl.pathname)

    if (targetPath !== careersPath) return true
    if (target.search) return true
    if (/\b(job|role|opportunit)/i.test(target.hash)) return true

    return false
  } catch {
    return false
  }
}

const assertVerifiedContract = (html = '') => {
  const text = normalizeText(html)

  if (!CAREERS_HEADING_PATTERN.test(text)) {
    throw new Error('Uniqus careers contract changed: missing Careers heading.')
  }

  if (!CONTACT_EMAIL_PATTERN.test(text)) {
    throw new Error(
      'Uniqus careers contract changed: missing careers@uniqus.com email handoff.',
    )
  }

  if (!VIEW_OPPORTUNITIES_PATTERN.test(text)) {
    throw new Error(
      'Uniqus careers contract changed: missing View Opportunities call to action.',
    )
  }

  if (hasJobPostingMarkup(html)) {
    throw new Error(
      'Uniqus careers surface now exposes JobPosting markup; promote a real parser.',
    )
  }

  const viewOpportunitiesHref = extractViewOpportunitiesHref(html)
  if (isFirstPartyListingsSurface(viewOpportunitiesHref)) {
    throw new Error(
      'Uniqus careers surface now links to a first-party opportunities page; promote a real parser.',
    )
  }
}

export const createUniqusScraper = () => ({
  async run({ fetchHtml = defaultFetchHtml } = {}) {
    const response = await fetchHtml(CAREERS_URL)
    const html = typeof response === 'string' ? response : response?.html
    const status = typeof response === 'string' ? 200 : Number(response?.status || 0)

    if (status === 403 && hasAntiRobotBlockerSignal(html)) {
      return []
    }

    assertVerifiedContract(html)
    return []
  },
})

export const run = async (options = {}) => runCurrentZohoSource(SOURCE,options)

const defaultFetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    },
  })

  const html = await response.text()

  if (!response.ok && !(response.status === 403 && hasAntiRobotBlockerSignal(html))) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    status: response.status,
    html,
  }
}
