import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'moneytap'
export const COMPANY = 'MoneyTap'
export const OFFICIAL_ATS_URL = 'https://moneytap-1.jobsoid.com/'

const requirePage = (condition, message) => { if (!condition) throw Error('MoneyTap native board: ' + message) }
const validatePage = html => {
  requirePage(typeof html === 'string' && html.length <= 4 * 1024 * 1024, 'missing or oversized response')
  const doc = document(html)
  const only = (predicate, container) => {
    const nodes = doc.nodes(predicate, container)
    requirePage(nodes.length === 1, 'missing, hidden or duplicated native section')
    doc.outer(nodes[0])
    return nodes[0]
  }
  const root = only(node => node.tag === 'html')
  const body = only(node => node.tag === 'body', root)
  only(node => node.tag === 'h1' && doc.text(node).toLowerCase() === 'moneytap - careers', body)
  requirePage(doc.nodes(node => node.tag === 'a' && /^https:\/\/(?:www\.)?moneytap\.com\/?$/i.test(node.attrs.href || ''), body).length > 0,
    'employer identity changed')
  const list = only(node => node.tag === 'section' && node.attrs.id === 'list', body)
  const section = only(node => node.tag === 'section' && node.attrs.id === 'sectionContainer' && doc.hasClass(node, 'current-openings'), body)
  const parents = new Map(), pending = [doc.root]
  while (pending.length) {
    const parent = pending.pop()
    for (const child of parent.children.filter(child => typeof child === 'object')) { parents.set(child, parent); pending.push(child) }
  }
  for (let ancestor = section; ancestor; ancestor = parents.get(ancestor)) {
    const style = (ancestor.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, '')
    requirePage(!/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(style), 'empty listing is not visible')
  }
  requirePage(doc.nodes(node => node === section, list).length === 1, 'listing container moved')
  only(node => node.tag === 'h2' && doc.text(node).toLowerCase() === 'current openings', section)
  only(node => node.tag === 'h3' && doc.text(node).toLowerCase() === 'no current openings', section)
  requirePage(doc.text(section).toLowerCase() === 'current openings no current openings', 'native openings need extraction')
  requirePage(!/<iframe\b/i.test(html) && !/["']@type["']\s*:\s*["']JobPosting["']/i.test(html), 'new embedded openings need extraction')
  const purpose = /\b(?:jobs?|careers?|vacanc(?:y|ies)|opportunit(?:y|ies)|openings?|open\s+roles|apply\s+now)\b/i
  for (const node of doc.nodes(node => ['a', 'button', 'form'].includes(node.tag)
    || node.tag === 'input' && /^(?:submit|button|image)$/i.test(node.attrs.type || ''), body)) {
    const targets = ['href', 'action', 'formaction', 'data-url', 'data-href'].map(key => node.attrs[key]).filter(Boolean)
    if (node.tag === 'input' && !node.attrs.formaction) {
      let form = node.attrs.form ? doc.nodes(candidate => candidate.tag === 'form' && candidate.attrs.id === node.attrs.form)[0] : parents.get(node)
      while (form && form.tag !== 'form') form = parents.get(form)
      if (form?.attrs.action) targets.push(form.attrs.action)
    }
    const submitLabels = node.tag === 'form' ? doc.nodes(child => child.tag === 'input', node).flatMap(child => [child.attrs.value, child.attrs.alt, child.attrs['aria-label']]) : []
    const advertised = [doc.text(node), node.attrs['aria-label'], node.attrs.title, node.attrs.value, node.attrs.alt, ...submitLabels, ...targets].filter(Boolean).join(' ')
    if (!purpose.test(advertised) && !targets.some(value => /(?:^|\/)j\//i.test(value))) continue
    // Native self-navigation may remain; any newly advertised external feed
    // needs verification even if its destination resembles a vendor credit.
    requirePage(targets.length > 0 && targets.every(value => {
      let target; try { target = new URL(value, OFFICIAL_ATS_URL) } catch { return false }
      return target.origin === new URL(OFFICIAL_ATS_URL).origin && target.pathname === '/' && !target.search && ['', '#list'].includes(target.hash)
    }), 'new recruiting handoff needs a verified parser')
  }
}

export const createMoneyTapScraper = () => ({
  async run({ fetchPage, fetchImpl = fetch, signal, timeoutMs = 20000, now = () => new Date().toISOString() } = {}) {
    requirePage(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300000, 'invalid request budget')
    signal?.throwIfAborted()
    const deadline = new AbortController(), combined = composeAbortSignals(signal, deadline.signal)
    const timer = setTimeout(() => deadline.abort(Error('MoneyTap source timed out')), timeoutMs)
    let onAbort
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(combined.reason)
      combined.addEventListener('abort', onAbort, { once: true })
    })
    try {
      const collect = async () => {
        const getPage = fetchPage || (async (url, options) => {
          const response = await fetchImpl(url, { ...options, headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' } })
          combined.throwIfAborted()
          return { status: response.status, url: response.url, html: await response.text() }
        })
        const page = await getPage(OFFICIAL_ATS_URL, { signal: combined })
        combined.throwIfAborted()
        requirePage(page?.status === 200, 'HTTP ' + page?.status)
        requirePage(page.url === OFFICIAL_ATS_URL, 'unverified redirect')
        validatePage(page.html)
        const checkedAt = now()
        requirePage(typeof checkedAt === 'string' && Number.isFinite(Date.parse(checkedAt)), 'invalid check time')
        return attachInventoryEvidence([], { status: 'verified-empty', surface: OFFICIAL_ATS_URL,
          firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0,
          verifiedAt: checkedAt, reason: 'official-jobsoid-board-explicit-current-no-openings' })
      }
      return await Promise.race([collect(), aborted])
    } finally {
      clearTimeout(timer)
      combined.removeEventListener('abort', onAbort)
    }
  },
})

export const run = async (options = {}) => createMoneyTapScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/moneytap/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
