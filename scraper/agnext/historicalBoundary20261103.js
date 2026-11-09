import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence, normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'agnext'
export const COMPANY = 'AgNext'
export const OFFICIAL_CAREERS_URL = 'https://www.agnext.com/'
export const JOB_OPENINGS_URL = 'https://agnext.keka.com/careers'

export const createAgNextScraper = ({ fetchImpl = fetch, timeoutMs = 15000 } = {}) => ({
  async run({ signal } = {}) {
    signal?.throwIfAborted()
    let lastResponse, firstParty = false, pagesFetched = 0
    const evidence = reason => normalizeInventoryEvidence({ status: 'coverage-gap', surface: JOB_OPENINGS_URL,
      firstParty, listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: new Date().toISOString(), reason })
    const contractError = message => Object.assign(new Error(message), { abortRetries: true, failureKind: 'parser_or_contract_error' })
    const request = async (url) => {
      try {
        return await fetchTextWithRetry(url, {
          fetchImpl: async (requestedUrl, init) => {
            const response = await fetchImpl(requestedUrl, init)
            pagesFetched++
            lastResponse = { status: response.status, requestUrl: requestedUrl, finalUrl: response.url || requestedUrl }
            return response
          }, signal, timeoutMs, attempts: 1,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify)', Accept: 'text/html' },
        })
      } catch (error) {
        if (lastResponse?.requestUrl === url) {
          Object.assign(error, lastResponse, { stage: url === OFFICIAL_CAREERS_URL ? 'home' : 'board' })
          if ([202, 401, 403, 429, 451].includes(lastResponse.status)) Object.assign(error, {
            softFailure: true, upstreamOutage: false, failureKind: 'blocked_or_access_denied', abortRetries: true,
          })
        }
        throw error
      }
    }
    try {
    const homepage = await request(OFFICIAL_CAREERS_URL)
    if (lastResponse.finalUrl !== OFFICIAL_CAREERS_URL) throw contractError('AgNext official response URL identity changed')
    const doc = readNativeDocument(homepage), visible = readVisibleNativeDocument(homepage, { strict: true }), head = activeHead(homepage)
    const advertisedTarget = node => {
        try {
          return new URL(node.attrs.href, OFFICIAL_CAREERS_URL).href.replace(/\/$/, '') === JOB_OPENINGS_URL
        } catch { return false }
    }
    const hasHandoff = doc.nodes(node => node.tag === 'a' && node.attrs.href).some(advertisedTarget)
    if (head.titles.length !== 1 || head.titles[0] !== 'AgNext' || !hasHandoff) throw contractError('AgNext official careers handoff is missing')
    // The current SSR advertises this exact configured URL under opacity:0
    // animation ancestors. It permits a diagnostic read of the advertised
    // board, but cannot establish an active employer handoff or native jobs.
    firstParty = visible.nodes(node => node.tag === 'a' && node.attrs.href).some(advertisedTarget)
    const board = await request(JOB_OPENINGS_URL)
    signal?.throwIfAborted()
    if (![JOB_OPENINGS_URL, JOB_OPENINGS_URL + '/', JOB_OPENINGS_URL + '/Content/403.html'].includes(lastResponse.finalUrl)) {
      throw contractError('AgNext native redirect URL identity changed')
    }
    if (!board.trim() || /<title[^>]*>[^<]*(?:access denied|forbidden|just a moment)/i.test(board)) {
      throw Object.assign(new Error('AgNext careers board is blocked or empty'), lastResponse, {
        stage: 'board', softFailure: true, upstreamOutage: false,
        failureKind: 'blocked_or_access_denied', abortRetries: true,
      })
    }
    if (lastResponse.finalUrl === JOB_OPENINGS_URL + '/Content/403.html') throw contractError('AgNext native denial URL returned an unreviewed document')
    return attachInventoryEvidence([], {
      status: 'discovery-only', surface: JOB_OPENINGS_URL, firstParty,
      listingComplete: false, pagesFetched: 2, verifiedAt: new Date().toISOString(),
      reason: firstParty ? 'official-keka-handoff-observed-listing-contract-unverified' : 'official-keka-target-advertised-but-current-visibility-and-listing-contract-unverified',
    })
    } catch (error) {
      if (signal?.aborted) throw signal.reason
      Object.assign(error, { partial: true, sourceListingComplete: false, sourceScopeComplete: false,
        sourceHandoffVerified: firstParty, lifecycleCleanupAllowed: false,
        inventoryEvidence: evidence((firstParty ? '' : 'Current handoff visibility unverified; ') + error.message) })
      throw error
    }
  },
})

export const run = async (options = {}) => createAgNextScraper(options).run(options)

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/scraper/agnext/script.js')) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
