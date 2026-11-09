import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ACULIFE_PROVIDER } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = ACULIFE_PROVIDER.source
export const COMPANY = ACULIFE_PROVIDER.companyName
export const VERIFIED_SURFACE_SUMMARY = ACULIFE_PROVIDER.verifiedSurfaceSummary
export const HOMEPAGE_URL = 'https://www.aculife.co.in/resource/home.aspx'
export const CAREER_PAGE_URL = ACULIFE_PROVIDER.companyCareerPage
// Historical probes retained for compatibility; they are not published vacancy routes.
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://www.aculife.co.in/careers', 'https://www.aculife.co.in/career',
  'https://www.aculife.co.in/jobs', 'https://www.aculife.co.in/openings',
  'https://www.aculife.co.in/current-openings', 'https://www.aculife.co.in/join-us',
  'https://www.aculife.co.in/work-with-us',
]
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const normalizeWhitespace = value => String(value ?? '').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'").replace(/\s+/g, ' ').trim()
const matchesOfficialPage = (actual, expected) => {
  try {
    const a = new URL(actual), e = new URL(expected)
    return a.origin === e.origin && a.pathname.toLowerCase() === e.pathname.toLowerCase()
      && a.search === e.search && a.hash === e.hash
  } catch { return false }
}
const defaultFetchPage = async (url, { signal, requestTimeoutMs = 20000 } = {}) => {
  signal?.throwIfAborted()
  const timeout = AbortSignal.timeout(Math.max(1, Math.min(20000, Number(requestTimeoutMs) || 20000)))
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    redirect: 'follow', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  return { status: response.status, url: response.url, html: await response.text() }
}
export const hasOfficialHomepageSignal = html => {
  const raw = String(html ?? ''), text = normalizeWhitespace(raw)
  return /Aculife Healthcare Private Limited/i.test(text) && /Health is Happiness/i.test(text)
    && /1 in every 6 IV fluids & diluents in India/i.test(text)
    && /corporate@aculife\.co\.in/i.test(raw) && /resource\/career\.aspx/i.test(raw)
}
export const hasOfficialCareerFormSignal = html => {
  const raw = String(html ?? ''), text = normalizeWhitespace(raw)
  const formTag = raw.match(/<form\b[^>]*>/i)?.[0] || ''
  const action = formTag.match(/\baction=["']([^"']+)["']/i)?.[1]
  return /Apply Here/i.test(text) && (/Apply via the form given below/i.test(text) || /We nurture and cultivate a sense/i.test(text))
    && /First name/i.test(text) && /Position you are applying for/i.test(text)
    && /Upload Resume/i.test(text) && /Years Of Experience/i.test(text)
    && /<input\b(?=[^>]*\bname=["']Position["'])(?=[^>]*\btype=["']text["'])[^>]*>/i.test(raw)
    && /\bmethod=["']post["']/i.test(formTag)
    && Boolean(action && matchesOfficialPage(new URL(action, CAREER_PAGE_URL).href, CAREER_PAGE_URL))
}
const hasNewJobsSurface = html => {
  const raw = String(html ?? '')
  if (/\bJobPosting\b|\bcurrent openings\b|\bopen positions?\b|\bjob openings?\b|\bvacancies\b|jobs\.lever\.co|greenhouse\.io|ashbyhq\.com|workable\.com|myworkdayjobs|darwinbox|zwayam|peoplestrong|successfactors/i.test(raw)) return true
  return [...raw.matchAll(/\b(?:href|src|data-src|action)\s*=\s*["']([^"']+)["']/gi)].some(match => {
    try {
      const url = new URL(match[1].replace(/&amp;/g, '&'), HOMEPAGE_URL)
      const hiring = /^(?:careers?|jobs?)\./i.test(url.hostname) || /(?:^|\/)(?:careers?|jobs?|openings?|current-openings|join-us|work-with-us)(?:\/|$)/i.test(url.pathname)
      return hiring && !matchesOfficialPage(url.href, CAREER_PAGE_URL)
    } catch { return false }
  })
}
export const isMissingPublicJobRoute = page => Number(page?.status) === 404
export const createAculifeScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal, requestTimeoutMs = 20000, now = () => new Date().toISOString() } = {}) {
    const request = { signal, requestTimeoutMs }
    signal?.throwIfAborted()
    const homepage = await fetchPage(HOMEPAGE_URL, request)
    signal?.throwIfAborted()
    if (homepage.status !== 200) throw new Error('HTTP ' + homepage.status + ' for ' + HOMEPAGE_URL)
    if (!matchesOfficialPage(homepage.url, HOMEPAGE_URL) || !hasOfficialHomepageSignal(homepage.html)) throw new Error('Aculife verified official homepage authority changed')
    if (hasNewJobsSurface(homepage.html)) throw new Error('Aculife public jobs or hiring handoff surface changed')
    const career = await fetchPage(CAREER_PAGE_URL, request)
    signal?.throwIfAborted()
    if (career.status !== 200) throw new Error('HTTP ' + career.status + ' for ' + CAREER_PAGE_URL)
    if (!matchesOfficialPage(career.url, CAREER_PAGE_URL) || !hasOfficialCareerFormSignal(career.html)) throw new Error('Aculife verified first-party career form authority changed')
    if (hasNewJobsSurface(career.html)) throw new Error('Aculife public jobs or hiring handoff surface changed')
    return attachInventoryEvidence([], {
      status: 'discovery-only', surface: CAREER_PAGE_URL, firstParty: true, listingComplete: false,
      pagesFetched: 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
      reason: 'first-party-general-application-form-does-not-enumerate-or-prove-active-vacancy-inventory',
    })
  },
})
export const run = (options = {}) => createAculifeScraper().run(options)

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
