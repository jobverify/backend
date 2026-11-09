import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'pixis'
export const COMPANY = 'Pixis'
export const FIRST_PARTY_ROOT_URL = 'https://pixis.ai/careers/'

const requirePage = (condition, reason) => { if (!condition) throw new Error(`Pixis official inventory: ${reason}`) }
const EMPTY_TEXT = 'There are no vacancies at this time, but we are always on the lookout for passionate people to join our team. Tell us what you are looking for at [email protected] — and don’t forget to attach your résumé!'

// A recruiting handoff can use any provider or an opaque URL. Read the
// advertised purpose as well as the target, instead of trusting an ATS list.
const recruitingPurpose = value => {
  let decoded = String(value || '')
  try { decoded = decodeURIComponent(decoded) } catch { /* Keep malformed hints conservative. */ }
  const words = decoded.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[^a-z0-9]+/gi, ' ')
  return /\b(?:careers?|jobs?|vacanc(?:y|ies)|openings?|positions?|recruit(?:ing|ment)?|hiring|apply)\b|\b(?:open|view|browse|explore|find|search|see|current|available)\b.{0,30}\b(?:roles|opportunities)\b|\bjoin (?:us|our team)\b/i.test(words)
}
const newlyAdvertisedRecruiting = (doc, node) => {
  const hints = [doc.text(node), node.attrs.href, node.attrs.action, node.attrs.title,
    node.attrs['aria-label'], node.attrs['data-href'], node.attrs['data-url'], node.attrs.id, node.attrs.class]
  if (!hints.some(recruitingPurpose)) return false
  if (node.tag === 'a') {
    try {
      const target = new URL(node.attrs.href, FIRST_PARTY_ROOT_URL).href
      if ([FIRST_PARTY_ROOT_URL, FIRST_PARTY_ROOT_URL + '#vacancies'].includes(target)) return false
    } catch { /* An invalid advertised target cannot support verified zero. */ }
  }
  return true
}

const validateEmptyPage = html => {
  requirePage(typeof html === 'string' && html.length < 4 * 1024 * 1024, 'missing or oversized source body')
  const doc = document(html)
  for (const tag of ['html', 'body', 'main']) {
    const nodes = doc.nodes(node => node.tag === tag)
    requirePage(nodes.length === 1, 'incomplete native page envelope')
    doc.outer(nodes[0])
  }
  requirePage(/<title[^>]*>Careers at Pixis \| Join the team \| Pixis<\/title>/.test(html)
    && doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && node.attrs.href === FIRST_PARTY_ROOT_URL).length === 1,
  'careers identity changed')
  const sections = doc.nodes(node => node.tag === 'section' && doc.hasClass(node, 'job-listing'))
  requirePage(sections.length === 1 && sections[0].attrs.id === 'vacancies', 'native listing section changed')
  const section = sections[0]
  doc.outer(section)
  const empty = doc.nodes(node => doc.hasClass(node, 'job-listing__no-jobs-text'), section)
  const headings = doc.nodes(node => node.tag === 'h2' && doc.text(node) === 'Open roles', section)
  requirePage(empty.length === 1 && headings.length === 1 && doc.text(empty[0]) === EMPTY_TEXT
    && doc.text(section) === 'Open roles ' + EMPTY_TEXT, 'explicit active empty section changed')
  doc.outer(empty[0])
  const ctas = doc.nodes(node => node.tag === 'a' && /See vacancies/.test(doc.text(node)))
  requirePage(ctas.length >= 1 && ctas.every(node => new URL(node.attrs.href, FIRST_PARTY_ROOT_URL).href === FIRST_PARTY_ROOT_URL + '#vacancies'), 'vacancies handoff changed')
  requirePage(!doc.nodes(node => ['a', 'button', 'form'].includes(node.tag) && newlyAdvertisedRecruiting(doc, node)).length,
    'new recruiting handoff needs a verified parser')
  requirePage(!/<iframe\b/i.test(html) && !/["']@type["']\s*:\s*["']JobPosting["']/i.test(html)
    && !doc.nodes(node => node.tag === 'a' && /(?:jobs\.lever\.co|apply\.workable\.com|greenhouse\.io|teamtailor\.com|keka\.com|ashbyhq\.com|\/careers\/[^/#?]+|\/jobs\/)/i.test(node.attrs.href || '')).length,
  'new native vacancy or external board needs a verified parser')
  requirePage(doc.nodes(node => node.tag === 'a', section).every(node => /^\/cdn-cgi\/l\/email-protection#[a-f0-9]+$/i.test(node.attrs.href || '')), 'new listing link contradicts empty state')
  const stateNodes = doc.nodes(node => node.tag === 'script' && node.attrs.id === '__NUXT_DATA__')
  requirePage(stateNodes.length === 1 && stateNodes[0].attrs['data-ssr'] === 'true', 'native server-rendered state missing')
  const data = JSON.parse(stateNodes[0].raw)
  const errors = data[data[data[0]?._errors]?.[1]]
  requirePage(errors && ['header', 'careers', 'footer', 'job-listing'].every(key => Number.isInteger(errors[key]) && data[errors[key]] === null), 'native CMS listing load failed')
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { signal, headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' } })
  return { status: response.status, url: response.url, html: await response.text() }
}

export const createPixisScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal, timeoutMs = 20000 } = {}) {
    requirePage(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120000, 'invalid request timeout')
    signal?.throwIfAborted()
    const deadline = new AbortController()
    const combined = composeAbortSignals(signal, deadline.signal)
    const timer = setTimeout(() => deadline.abort(new Error('Pixis source timed out')), timeoutMs)
    let onAbort
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(combined.reason)
      combined.addEventListener('abort', onAbort, { once: true })
    })
    try {
      const collect = async () => {
        const page = await fetchPage(FIRST_PARTY_ROOT_URL, { signal: combined })
        combined.throwIfAborted()
        requirePage(page?.status === 200 && page.url === FIRST_PARTY_ROOT_URL, 'HTTP failure or unverified redirect')
        validateEmptyPage(page.html)
        return attachInventoryEvidence([], { status: 'verified-empty', surface: FIRST_PARTY_ROOT_URL,
          firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0,
          verifiedAt: new Date().toISOString(), reason: 'closed-native-open-roles-section-explicit-empty-with-error-free-cms-state',
        })
      }
      return await Promise.race([collect(), aborted])
    } finally {
      clearTimeout(timer)
      combined.removeEventListener('abort', onAbort)
    }
  },
})

export const run = async (options = {}) => createPixisScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/pixis/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
