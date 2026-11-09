import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { normalizeInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'waycool'
export const COMPANY = 'WayCool'
export const FIRST_PARTY_ROOT_URL = 'https://www.waycool.in/job-opportunities.php'
export const OFFICIAL_CAREERS_URL = 'https://waycool.in/career'
export const OFFICIAL_CAREERS_WWW_URL = 'https://www.waycool.in/career'
const activeDocument = body => {
  const doc = document(body)
  const prune = (node, inherited = false) => {
    const style = (node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, '')
    node.inactive ||= inherited || node.attrs['aria-hidden']?.toLowerCase() === 'true'
      || /(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(style)
    for (const child of node.children.filter(c => typeof c !== 'string')) prune(child, node.inactive)
  }
  prune(doc.root)
  return doc
}

export const createWayCoolScraper = () => ({
  async run({fetchImpl = globalThis.fetch, signal, timeoutMs = 45000} = {}) {
    signal?.throwIfAborted()
    const retainedResponses = [], attempts = []
    let surface = OFFICIAL_CAREERS_URL, firstParty = false, pagesFetched = 0
    const gap = (reason, cause) => Object.assign(new Error(`WayCool coverage gap: ${reason}`, {cause}), {
      code:'WAYCOOL_COVERAGE_GAP', partial:true, sourceListingComplete:false, lifecycleCleanupAllowed:false,
      softFailure:true, upstreamOutage:false, failureKind:'coverage_gap', abortRetries:true,
      retainedResponses, nativeAttempts:attempts,
      inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap', surface, firstParty,
        listingComplete:false, pagesFetched, reportedTotal:null, indiaFacetCount:null,
        verifiedAt:new Date().toISOString(), reason}),
    })
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw gap('Invalid aggregate deadline')
    const controller = new AbortController()
    let timer, onAbort
    const interrupted = new Promise((_, reject) => {
      onAbort = () => { controller.abort(signal.reason); reject(signal.reason) }
      signal?.addEventListener('abort', onAbort, {once:true})
      timer = setTimeout(() => {
        const error = gap('Aggregate deadline exceeded during official inventory revalidation')
        controller.abort(error); reject(error)
      }, timeoutMs)
    })
    const collect = async () => {
      const read = async url => {
        controller.signal.throwIfAborted(); surface = url
        try {
          const response = await fetchImpl(url, {signal:controller.signal, redirect:'manual', headers:{accept:'text/html'}})
          controller.signal.throwIfAborted()
          const body = await response.text()
          controller.signal.throwIfAborted()
          if (typeof body !== 'string' || Buffer.byteLength(body) > 5000000) throw Error('Body unavailable or exceeds bound')
          pagesFetched++
          retainedResponses.push({url, finalUrl:response.url, status:response.status, body,
            bodySHA256:createHash('sha256').update(body).digest('hex')})
          if (response.status !== 200 || response.url !== url || !body.trim()) throw Error('Native status, final identity or body unavailable')
          return activeDocument(body)
        } catch (error) {
          controller.signal.throwIfAborted()
          attempts.push({url, reason:error.message}); return null
        }
      }
      let official
      for (const url of [OFFICIAL_CAREERS_URL, OFFICIAL_CAREERS_WWW_URL]) {
        const doc = await read(url)
        if (!doc) continue
        // The current official page advertises this exact brand and handoff.
        // Marketing text and generic application forms never certify zero jobs.
        if (!doc.nodes(n => n.tag === 'h1' && /WayCoolWarrior/.test(doc.text(n))).length
          || !doc.nodes(n => n.tag === 'a' && n.attrs.href === FIRST_PARTY_ROOT_URL && /Join Us/i.test(doc.text(n))).length) {
          attempts.push({url, reason:'Official career identity or Join Us handoff changed'}); continue
        }
        official = doc; firstParty = true; break
      }
      const native = await read(FIRST_PARTY_ROOT_URL)
      if (!official) throw gap('Current official employer career binding unavailable')
      if (!native) throw gap('Official Join Us native inventory is inaccessible')
      // No current native inventory body or role contract could be captured.
      // A newly accessible endpoint requires review of every page and its roles;
      // neither an empty page nor a new widget can safely trigger cleanup.
      throw gap('Official Join Us body requires native inventory and pagination contract verification')
    }
    try { return await Promise.race([collect(), interrupted]) }
    catch (error) {
      if (signal?.aborted) throw signal.reason
      if (error?.code === 'WAYCOOL_COVERAGE_GAP') throw error
      throw gap('Official inventory revalidation failed', error)
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', onAbort); controller.abort()
    }
  },
})

export const run = async (options = {}) => createWayCoolScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/waycool/script.js')

if (isDirectExecution) {
  const jobs = await run()
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
