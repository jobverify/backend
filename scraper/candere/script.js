import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CANDERE_CATALOG as PROVIDER_METADATA } from './catalog.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const defaultFetchPage = async (url, { signal, requestTimeoutMs = 20000 } = {}) => {
  signal?.throwIfAborted()
  const timeout = AbortSignal.timeout(Math.max(1, Math.min(30000, Number(requestTimeoutMs) || 20000)))
  const response = await fetch(url, {
    headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  return { status: response.status, url: response.url, html: await response.text() }
}

export const createCandereScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal, requestTimeoutMs = 20000, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    const page = await fetchPage(CAREERS_URL, { signal, requestTimeoutMs })
    signal?.throwIfAborted()
    if (page?.status !== 200) throw new Error(`Candere careers HTTP ${page?.status}`)
    const actual = new URL(page.url)
    if (actual.origin !== new URL(CAREERS_URL).origin || actual.pathname !== '/' || actual.search) {
      throw new Error('Candere careers redirected outside the verified board')
    }
    const doc = document(page.html)
    const envelopes = doc.nodes(node => node.tag === 'html')
    const bodies = envelopes.length === 1 ? doc.nodes(node => node.tag === 'body', envelopes[0]) : []
    if (envelopes.length !== 1 || bodies.length !== 1) {
      throw new Error('Candere careers response is missing its native page envelope')
    }
    // The reader retains unclosed nodes. An explicit empty heading in a
    // truncated response cannot establish a complete current inventory.
    doc.outer(envelopes[0])
    doc.outer(bodies[0])
    const heading = (tag, expected) => doc.nodes(node => node.tag === tag)
      .some(node => doc.text(node).toLowerCase() === expected)
    const list = doc.nodes(node => node.tag === 'section' && node.attrs.id === 'list')
    const sections = list.length === 1 ? doc.nodes(node => node.tag === 'section'
      && node.attrs.id === 'sectionContainer' && doc.hasClass(node, 'current-openings'), list[0]) : []
    const companyLink = doc.nodes(node => node.tag === 'a' && /^https?:\/\/(?:www\.)?candere\.com\/?$/i.test(node.attrs.href || ''))
    if (!heading('h1', 'candere - careers') || !heading('h2', 'current openings')
      || sections.length !== 1 || companyLink.length === 0) {
      throw new Error('Candere careers identity or listing schema changed')
    }
    doc.outer(list[0])
    doc.outer(sections[0])
    const newOpenings = doc.nodes(node => node.tag === 'a' && /(?:^|\/)(?:j|jobs)\//i.test(node.attrs.href || '')).length
      || /["']@type["']\s*:\s*["']JobPosting["']/i.test(page.html)
    if (newOpenings || !heading('h3', 'no current openings')
      || doc.text(sections[0]).toLowerCase() !== 'current openings no current openings') {
      throw new Error('Candere openings require a verified native listing parser; empty inventory cannot be asserted')
    }
    return attachInventoryEvidence([], {
      status: 'verified-empty', surface: CAREERS_URL, firstParty: true, listingComplete: true,
      pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0, verifiedAt: now(),
      reason: 'official-jobsoid-board-explicit-no-current-openings',
    })
  },
})

export const run = async (options = {}) => createCandereScraper().run(options)

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
