import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { TURTLEMINT_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'turtlemint'
export const COMPANY = 'Turtlemint'
export const FIRST_PARTY_ROOT_URL = 'https://www.turtlemint.com/careers/'
export const PROVIDER_METADATA = TURTLEMINT_CATALOG

const requirePage = (condition, reason) => { if (!condition) throw new Error('Turtlemint official inventory: ' + reason) }
const one = (nodes, label) => { requirePage(nodes.length === 1, 'missing or ambiguous ' + label); return nodes[0] }
const HEADING = 'Accelerate Your Career at Turtlemint'
const EMPTY = 'There are no active openings at the moment'
const MODULE_TEXT = HEADING + ' Join us to reshape the insurance landscape-explore the perfect role for you. ' + EMPTY
  + ' But we’re always excited to meet exceptional talent. If you believe you’d thrive at Turtlemint and want to be part of something meaningful, we’d love to hear from you. Reach out to us at: careers@turtlemint.com'
const SCRIPT_URLS = new Set([
  'https://www.googletagmanager.com/gtag/js?id=G-Q464ED3KJ2',
  'https://www.turtlemint.com/wp-includes/js/dist/script-modules/block-library/navigation/view.min.js?ver=96a846e1d7b789c39ab9',
  'https://www.turtlemint.com/wp-includes/js/dist/script-modules/block-library/navigation/view.min.js?ver=1bf28ded04f9f188bdcb',
  'https://www.turtlemint.com/wp-content/themes/fintech/assets/js/jquery.min.js?ver=3.7.1',
  'https://www.turtlemint.com/wp-content/themes/fintech/assets/js/tmf-scripts.min.js',
  'https://www.turtlemintinsurance.com/wp-content/themes/turtlemint/expert-calling-widget/widget.js',
])
const purpose = value => {
  let decoded = String(value || '')
  try { decoded = decodeURIComponent(decoded) } catch { /* Malformed targets retain their visible hints. */ }
  const words = decoded.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[^a-z0-9]+/gi, ' ')
  return /\b(?:careers?|jobs?|roles|opportunities|vacanc(?:y|ies)|openings?|positions?|recruit(?:ing|ment)?|hiring|apply)\b|\bjoin (?:us|our team)\b/i.test(words)
}

export const validateEmptyPage = html => {
  requirePage(typeof html === 'string' && html.length <= 4 * 1024 * 1024, 'missing or oversized native body')
  const doc = document(html), all = []
  // Propagate content-visibility as well as ordinary HTML visibility through
  // ancestors; hidden messages cannot establish an active empty state.
  const visit = (node, inherited = false) => {
    const style = (node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, '')
    node.inactive ||= inherited || node.attrs['aria-hidden']?.toLowerCase() === 'true'
      || (node.attrs.class || '').split(/\s+/).some(value => ['d-none', 'hidden'].includes(value))
      || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(style)
    all.push(node)
    for (const child of node.children) if (typeof child === 'object') visit(child, node.inactive)
  }
  visit(doc.root)
  requirePage(!all.some(node => ['form', 'input', 'textarea', 'select', 'iframe'].includes(node.tag)), 'new native recruiting form or embedded surface')
  for (const tag of ['html', 'body']) doc.outer(one(doc.nodes(node => node.tag === tag), tag + ' envelope'))
  requirePage(/<title>Careers \| Turtlemint<\/title>/.test(html)
    && doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && node.attrs.href === FIRST_PARTY_ROOT_URL).length === 1,
  'official careers identity changed')
  const module = one(doc.nodes(node => node.tag === 'div' && node.children.some(child => typeof child === 'object' && child.tag === 'p' && doc.text(child) === HEADING)), 'active careers module')
  doc.outer(module)
  const empty = one(doc.nodes(node => node.tag === 'p' && doc.text(node) === EMPTY, module), 'explicit active empty message')
  doc.outer(empty)
  const card = one(doc.nodes(node => node.tag === 'div' && node.children.includes(empty), module), 'closed empty card')
  doc.outer(card)
  requirePage(doc.text(module) === MODULE_TEXT, 'explicit native careers module changed')
  const links = doc.nodes(node => node.tag === 'a', module)
  requirePage(links.length === 1 && links[0].attrs.href === 'mailto:careers@turtlemint.com'
    && doc.text(links[0]) === 'careers@turtlemint.com', 'native recruiting contact changed')
  const graph = []
  const inspect = value => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(inspect); return }
    const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']]
    requirePage(!types.includes('JobPosting'), 'new native JobPosting requires a verified parser')
    graph.push(value)
    Object.values(value).forEach(inspect)
  }
  for (const node of all.filter(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) {
    let data
    try { data = JSON.parse(node.raw) } catch { requirePage(false, 'malformed native structured data') }
    inspect(data)
  }
  requirePage(graph.some(value => value['@type'] === 'WebPage' && value.url === FIRST_PARTY_ROOT_URL && value.name === 'Careers | Turtlemint'), 'native careers metadata missing')
  for (const node of doc.nodes(() => true)) {
    requirePage(!['form', 'input', 'textarea', 'select', 'iframe'].includes(node.tag), 'new native recruiting form or embedded surface')
    if (node.tag === 'script') {
      if (node.attrs.src) requirePage(SCRIPT_URLS.has(node.attrs.src), 'new client resource requires verified recruiting checks')
      else if (!['application/ld+json', 'importmap', 'speculationrules'].includes(node.attrs.type)) {
        requirePage(!purpose(node.raw) && !/\bfetch\s*\(|XMLHttpRequest/.test(node.raw), 'new native listing client requires a verified parser')
      }
    }
    if (['a', 'button'].includes(node.tag)) {
      const hints = [doc.text(node), ...doc.nodes(() => true, node).flatMap(child => Object.values(child.attrs))]
      if (!hints.some(purpose)) continue
      const keys = Object.keys(node.attrs)
      const contact = node.tag === 'a' && node.attrs.href === 'mailto:careers@turtlemint.com' && doc.text(node) === 'careers@turtlemint.com' && keys.every(key => key === 'href')
      let self = false
      try { self = node.tag === 'a' && new URL(node.attrs.href, FIRST_PARTY_ROOT_URL).href === FIRST_PARTY_ROOT_URL
        && doc.text(node) === 'Careers' && keys.every(key => ['class', 'href', 'aria-current'].includes(key)) } catch { /* Invalid purpose-bearing URLs fail closed. */ }
      requirePage(contact || self, 'new recruiting handoff requires a verified parser')
    }
    requirePage(!/\b(?:job[-_ ]?(?:listing|card|opening)|vacanc(?:y|ies)|open[-_ ]?roles|recruit(?:ing|ment))\b/i.test((node.attrs.id || '') + ' ' + (node.attrs.class || '')), 'new native vacancy inventory requires a verified parser')
  }
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { signal, headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' } })
  return { status: response.status, url: response.url, html: await response.text() }
}

export const createTurtlemintScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal, timeoutMs = 20000 } = {}) {
    requirePage(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120000, 'invalid request timeout')
    signal?.throwIfAborted()
    const controller = new AbortController(), combined = composeAbortSignals(signal, controller.signal)
    const timer = setTimeout(() => controller.abort(new Error('Turtlemint source timed out')), timeoutMs)
    let onAbort
    const aborted = new Promise((_, reject) => { onAbort = () => reject(combined.reason); combined.addEventListener('abort', onAbort, { once: true }) })
    try {
      const collect = async () => {
        const page = await fetchPage(FIRST_PARTY_ROOT_URL, { signal: combined })
        combined.throwIfAborted()
        requirePage(page?.status === 200 && page.url === FIRST_PARTY_ROOT_URL, 'HTTP failure or unverified redirect')
        validateEmptyPage(page.html)
        return attachInventoryEvidence([], { status: 'verified-empty', surface: FIRST_PARTY_ROOT_URL,
          firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0,
          verifiedAt: new Date().toISOString(), reason: 'closed-visible-first-party-careers-module-explicit-no-active-openings-and-email-only-contact' })
      }
      return await Promise.race([collect(), aborted])
    } finally { clearTimeout(timer); combined.removeEventListener('abort', onAbort) }
  },
})

export const run = async (options = {}) => createTurtlemintScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/turtlemint/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
