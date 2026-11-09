import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { CODING_NINJAS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'codingninjas'
export const COMPANY = 'Coding Ninjas'
export const PROVIDER_METADATA = CODING_NINJAS_CATALOG
export const OFFICIAL_HOME_URL = 'https://www.codingninjas.com/'
export const OFFICIAL_KEKA_CAREERS_URL = 'https://codingninjas.keka.com/careers'
export const OFFICIAL_KEKA_ACTIVE_JOBS_FEED_URL =
  'https://codingninjas.keka.com/careers/api/embedjobs/default/active/0ec89a02-c247-4dc7-b554-64ae46e3ffc5'
const TENANT = '0ec89a02-c247-4dc7-b554-64ae46e3ffc5'
const CLIENT_URL = `${OFFICIAL_KEKA_CAREERS_URL}/api/embedjobs/js/${TENANT}`
const PORTAL_URL = `${OFFICIAL_KEKA_CAREERS_URL}/api/organization/default/careerportalinfo`
const GROUP_STATUS_URL = `${OFFICIAL_KEKA_CAREERS_URL}/api/embedjobs/grouplinkstatus/${TENANT}`
// Captured client makes one unfiltered active GET and assigns that entire array
// to jobList before applying any client-side filters. Pin changes fail closed.
const CLIENT_SHA256 = '176878893ddcd1a0dabb3b84d1c8a98bde7c16c6ace1af2871db06c741fa022b'
const activeDocument = body => {
  const html = document(body)
  for (const node of html.nodes(() => true)) {
    if (/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, ''))) node.inactive = true
  }
  return html
}

export const createCodingNinjasScraper = (defaults = {}) => ({
  async run(options = {}) {
    const { fetchImpl = fetch, timeoutMs = 15000, signal } = { ...defaults, ...options }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120000) throw Error('Coding Ninjas invalid request budget')
    signal?.throwIfAborted()
    const controller = new AbortController()
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    const timer = setTimeout(() => controller.abort(Error('Coding Ninjas source timed out')), timeoutMs)
    let onAbort, pagesFetched = 0, firstParty = false
    const stopped = new Promise((_, reject) => {
      onAbort = () => reject(combined.reason)
      combined.addEventListener('abort', onAbort, { once: true })
    })
    const gap = reason => attachInventoryEvidence([], {
      status: 'coverage-gap', surface: OFFICIAL_KEKA_CAREERS_URL, firstParty,
      listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: new Date().toISOString(), reason,
    })
    const request = async url => {
      combined.throwIfAborted()
      const response = await fetchImpl(url, { signal: combined, redirect: 'error', headers: { Accept: 'text/html,application/json', 'User-Agent': 'Mozilla/5.0' } })
      combined.throwIfAborted()
      if (response.status !== 200) throw Error(`Coding Ninjas upstream HTTP ${response.status}`)
      if (response.url !== url) throw Error('Coding Ninjas upstream redirect identity changed')
      const body = await response.text()
      combined.throwIfAborted()
      if (typeof body !== 'string' || !body.trim() || body.length > 4 * 1024 * 1024) throw Error('Coding Ninjas upstream body unavailable or exceeds bound')
      pagesFetched++
      return body
    }
    const collect = async () => {
      const html = activeDocument(await request(OFFICIAL_HOME_URL))
      const handoff = html.nodes(n => n.tag === 'a').some(n => {
        try { return new URL(n.attrs.href, OFFICIAL_HOME_URL).href.replace(/\/$/, '') === OFFICIAL_KEKA_CAREERS_URL } catch { return false }
      })
      if (!handoff || !/coding\s*ninjas/i.test(html.text(html.root))) throw Error('Coding Ninjas active official careers handoff missing')
      firstParty = true
      const shell = activeDocument(await request(OFFICIAL_KEKA_CAREERS_URL))
      const shellScripts = shell.nodes(n => n.tag === 'script' && !n.attrs.src).map(n => n.raw || '').join('\n')
      const embeddedPath = [...shellScripts.matchAll(/fetch\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1])
      if (embeddedPath.length !== 1 || !new RegExp(`^/ats/documents/${TENANT}/careerportal/[a-f0-9]+\\.html$`).test(embeddedPath[0])) throw Error('Coding Ninjas native shell tenant unavailable')
      const embedded = activeDocument(await request(new URL(embeddedPath[0], OFFICIAL_KEKA_CAREERS_URL).href))
      const configs = embedded.nodes(n => n.tag === 'script' && !n.attrs.src).map(n => n.raw || '').filter(s => /window\.khConfig\s*=/.test(s))
      const config = configs[0]?.match(/^\s*window\.khConfig\s*=\s*\{\s*identifier:\s*'([^']+)'\s*,\s*domain:\s*'([^']+)'\s*,\s*targetContainer:\s*'([^']+)'\s*\}\s*;?\s*$/)
      if (configs.length !== 1 || !config || config[1] !== TENANT || config[2] !== 'https://codingninjas.keka.com/careers/' || config[3] !== '#khembedjobs' || embedded.nodes(n => n.attrs.id === 'khembedjobs').length !== 1 || embedded.nodes(n => n.tag === 'script' && n.attrs.src === CLIENT_URL).length !== 1) throw Error('Coding Ninjas embedded tenant config changed')
      const client = await request(CLIENT_URL)
      if (createHash('sha256').update(client).digest('hex') !== CLIENT_SHA256) throw Error('Coding Ninjas native client contract-unverified')
      const portal = JSON.parse(await request(PORTAL_URL))
      if (portal?.careersPortalDomain !== 'codingninjas.keka.com' || portal?.companyWebsite !== OFFICIAL_HOME_URL) throw Error('Coding Ninjas native portal employer identity mismatch')
      const groupStatus = JSON.parse(await request(GROUP_STATUS_URL))
      if (groupStatus?.isGroupLinked !== false) throw Error('Coding Ninjas native group-linked contract-unverified')
      const inventory = JSON.parse(await request(OFFICIAL_KEKA_ACTIVE_JOBS_FEED_URL))
      if (!Array.isArray(inventory)) throw Error('Coding Ninjas native active inventory is not an array')
      if (inventory.length) return gap('nonempty-native-job-detail-contract-unverified')
      return attachInventoryEvidence([], { status: 'verified-empty', surface: OFFICIAL_KEKA_ACTIVE_JOBS_FEED_URL,
        firstParty: true, listingComplete: true, pagesFetched, reportedTotal: 0, indiaFacetCount: 0,
        verifiedAt: new Date().toISOString(), reason: 'fresh-official-handoff-tenant-portal-and-unfiltered-native-empty-array' })
    }
    try {
      return await Promise.race([collect(), stopped])
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      return gap(String(error?.message || error))
    } finally {
      clearTimeout(timer)
      controller.abort(Error('Coding Ninjas source check finished'))
      combined.removeEventListener('abort', onAbort)
    }
  },
})

export const run = async (options = {}) => createCodingNinjasScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/codingninjas/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  // Failed coverage must never persist an empty replacement inventory.
  if (readInventoryEvidence(jobs)?.listingComplete !== true) throw Error('Coding Ninjas coverage gap: native inventory unavailable')

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
