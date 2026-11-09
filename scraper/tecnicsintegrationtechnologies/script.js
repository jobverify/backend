import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { TECNICS_INTEGRATION_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = TECNICS_INTEGRATION_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLY_URL = PROVIDER_METADATA.applyUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const ROBOTS_URL = 'https://tecnics.com/robots.txt'
export const SITEMAP_URL = 'https://tecnics.com/sitemap.xml'
export const ABOUT_URL = 'https://tecnics.com/company/about'
export const CONTACT_URL = 'https://tecnics.com/contact'

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)', Accept: 'text/html,application/xml,text/plain,*/*' },
  label: SOURCE, timeoutMs: 15000,
})
const normalize = (value) => String(value ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
const title = (html) => normalize(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
const discoveryError = (message) => {
  const error = new Error('Tecnics current discovery ' + message)
  error.code = 'TECNICS_DISCOVERY_UNVERIFIED'
  return error
}

export const hasOfficialHomepageSignal = (html = '') => (
  /^Identity Security & Managed IAM Services \| Tecnics$/i.test(title(html))
  && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/tecnics\.com\/?["']/i.test(html)
  && /mailto:info@tecnics\.com/i.test(html) && /mailto:sales@tecnics\.com/i.test(html)
  && /Houston.*Vaughan.*Dubai.*Hyderabad/i.test(normalize(html))
)

const hasRecruitmentHandoff = (value) => {
  let url
  try { url = new URL(value, CAREERS_URL) } catch { return false }
  if (!['https:', 'http:'].includes(url.protocol)) return false
  return /(?:^|\/)(?:careers?|jobs?|recruit(?:ment|ing)?|hiring|opportunities|talent)(?:[\/.-]|$)/i.test(url.pathname)
    || /(?:^|\.)(?:greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com|myworkdayjobs\.com|icims\.com|keka\.com|zohorecruit\.[a-z.]+|workable\.com|bamboohr\.com)$/i.test(url.hostname)
}
const assertNoRecruitmentHandoff = (html) => {
  for (const match of String(html).matchAll(/href=["']([^"']+)["']/gi)) {
    if (hasRecruitmentHandoff(match[1])) throw discoveryError('has a new careers/jobs handoff that requires inventory re-verification: ' + match[1])
  }
}

export const extractSitemapUrls = (xml = '') => {
  if (!/<urlset\b[^>]*xmlns=["']http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9["']/i.test(xml)
    || !/<\/urlset>\s*$/.test(String(xml))) throw discoveryError('sitemap surface is no longer the published complete URL set')
  const urls = [...String(xml).matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => match[1].trim())
  const rawCount = [...String(xml).matchAll(/<url>/gi)].length
  const unique = new Set()
  for (const value of urls) {
    let url
    try { url = new URL(value) } catch { throw discoveryError('sitemap contains malformed URL identity') }
    if (url.protocol !== 'https:' || url.hostname !== 'tecnics.com' || url.search || url.hash || unique.has(value)) {
      throw discoveryError('sitemap contains untrusted or duplicate URL identity')
    }
    unique.add(value)
    if (hasRecruitmentHandoff(value)) throw discoveryError('sitemap publishes a new careers/jobs route requiring inventory re-verification: ' + value)
  }
  if (urls.length !== rawCount || !unique.has('https://tecnics.com') || !unique.has(ABOUT_URL) || !unique.has(CONTACT_URL)) {
    throw discoveryError('sitemap company identity or route continuity is incomplete')
  }
  return urls
}

export const createTecnicsIntegrationTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, signal, now = () => new Date().toISOString() } = {}) {
    const getText = async (url) => {
      signal?.throwIfAborted()
      const text = await fetchText(url, { signal })
      signal?.throwIfAborted()
      return String(text)
    }
    const homepage = await getText(CAREERS_URL)
    if (!hasOfficialHomepageSignal(homepage)) throw discoveryError('homepage identity no longer matches the verified current company surface')
    assertNoRecruitmentHandoff(homepage)
    const robots = await getText(ROBOTS_URL)
    const sitemapRoutes = [...robots.matchAll(/^Sitemap:\s*(\S+)\s*$/gmi)].map((match) => match[1])
    if (sitemapRoutes.length !== 1 || sitemapRoutes[0] !== SITEMAP_URL) throw discoveryError('robots no longer declares the verified first-party sitemap')
    const urls = extractSitemapUrls(await getText(SITEMAP_URL))
    const about = await getText(ABOUT_URL)
    const contact = await getText(CONTACT_URL)
    if (!/^About Tecnics \|/i.test(title(about)) || !/identity/i.test(normalize(about))
      || !/governance/i.test(normalize(about)) || !/India/i.test(normalize(about))
      || !/^Talk to a Tecnics Expert \| Tecnics$/i.test(title(contact))
      || !/Hyderabad.{0,60}India/i.test(normalize(contact)) || !/mailto:info@tecnics\.com/i.test(contact)) {
      throw discoveryError('about/contact company identity changed materially')
    }
    assertNoRecruitmentHandoff(about)
    assertNoRecruitmentHandoff(contact)
    return attachInventoryEvidence([], {
      status: 'discovery-only', surface: CAREERS_URL, firstParty: true, listingComplete: false,
      pagesFetched: 5, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
      reason: 'Verified current Tecnics company discovery and ' + urls.length + '-URL published sitemap; these surfaces are not an authoritative job inventory. Retired APAC careers route is no longer published. Global and India job counts remain unknown; do not infer zero or authorize expiry.',
    })
  },
})
export const run = async (options = {}) => createTecnicsIntegrationTechnologiesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
