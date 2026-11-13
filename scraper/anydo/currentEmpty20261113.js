import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readNativeDocument, activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { readBreezyEmptyState } from '../../scraper-support/utils/recruitmentBreezyEmptyState.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const contract = JSON.parse(readFileSync(new URL('./reviewedEmptyContract20261113.json', import.meta.url)))
const hash = body => createHash('sha256').update(body).digest('hex')
const requireNative = (condition, reason) => {
  if (!condition) throw Object.assign(new Error('Any.do native empty inventory: ' + reason), {
    softFailure: true, abortRetries: true, failureKind: 'coverage_gap',
  })
}
const normalizeTemplate = html => html.replace(/share_id=0\.\d+/g, 'share_id=0.REVIEWED')
const bounded = (operation, signal) => new Promise((resolve, reject) => {
  const abort = () => reject(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) { signal.removeEventListener('abort', abort); reject(signal.reason); return }
  Promise.resolve().then(() => { signal.throwIfAborted(); return operation() })
    .then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
})

export async function runAnyDoCurrentEmpty(options = {}) {
  options.signal?.throwIfAborted()
  const controller = new AbortController()
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90000), ...(options.signal ? [options.signal] : [])])
  try { return await collectCurrentEmpty(options, signal) }
  finally { controller.abort() }
}

async function collectCurrentEmpty(options, signal) {
  requireNative(options.maxJobs == null && options.maxPages == null, 'caps and page limits cannot qualify empty scope')
  requireNative(!options.fetchText && !options.fetchJson && !options.fetchPage, 'native response metadata is required')
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const verifiedAt = new Date().toISOString(), receipts = []
  let requests = 0, aggregateBytes = 0
  const read = async (url, kind) => {
    signal.throwIfAborted()
    requireNative(++requests <= 48, 'reviewed native request budget exceeded')
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(15000)])
    const response = await bounded(() => fetchImpl(url, { method: 'GET', redirect: 'error', credentials: 'omit',
      signal: requestSignal, cache: 'no-store', headers: { Accept: kind === 'page' ? 'text/html' : '*/*',
        'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' } }), requestSignal)
    requireNative(response.status === 200 && response.url === url, 'native response status or authority changed')
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    requireNative(kind === 'page' ? ['text/html', 'application/xhtml+xml'].includes(mime)
      : /\.(?:css)(?:\?|$)/.test(url) ? mime === 'text/css' : ['text/javascript', 'application/javascript'].includes(mime),
    'native response MIME changed')
    requireNative(response.body?.getReader, 'native response stream unavailable')
    const reader = response.body.getReader(), chunks = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await bounded(() => reader.read(), requestSignal)
        if (done) break
        requireNative(value instanceof Uint8Array && value.byteLength <= 2000000 - size, 'native byte budget exceeded')
        size += value.byteLength
        requireNative(aggregateBytes + size <= 12000000, 'native aggregate byte budget exceeded')
        chunks.push(Buffer.from(value))
      }
    } catch (error) {
      try { void Promise.resolve(reader.cancel(error)).catch(() => {}) } catch { /* Disposal must not delay cancellation. */ }
      throw error
    } finally {
      try { reader.releaseLock() } catch { /* A pending native read may retain its lock. */ }
    }
    const bytes = Buffer.concat(chunks, size)
    requestSignal.throwIfAborted()
    aggregateBytes += bytes.byteLength
    requireNative(bytes.byteLength <= 2000000 && aggregateBytes <= 12000000, 'native byte budget exceeded')
    const digest = hash(bytes)
    receipts.push({ url, status: response.status, contentType: mime, bytes: bytes.byteLength, sha256: digest })
    return { body: new TextDecoder('utf8', { fatal: true }).decode(bytes), bytes: bytes.byteLength, sha256: digest }
  }
  const homepage = async () => {
    const { body } = await read(contract.officialHomepage, 'page')
    requireNative(activeHead(body).titles.length === 1 && /Any\.do/i.test(activeHead(body).titles[0]), 'current employer identity changed')
    const raw = readNativeDocument(body), parents = new Map(), all = []
    const walk = node => {
      all.push(node)
      for (const child of node.children.filter(value => typeof value !== 'string')) { parents.set(child, node); walk(child) }
    }
    walk(raw.nodes(node => node.tag === 'root')[0])
    const identity = node => ({ tag: node.tag, attrs: Object.fromEntries(Object.entries(node.attrs).sort(([left], [right]) => left.localeCompare(right))) })
    const rawLinks = raw.nodes(node => node.tag === 'a' && node.attrs.href === contract.nativeBoard)
    requireNative(rawLinks.length === 1, 'corporate handoff identity changed')
    const ancestry = []
    for (let node = rawLinks[0]; node; node = parents.get(node)) ancestry.push(identity(node))
    requireNative(JSON.stringify(ancestry) === JSON.stringify(contract.corporateHandoffAncestry), 'reviewed corporate handoff ancestry or style changed')
    requireNative(JSON.stringify(all.filter(node => node.tag === 'style').map(node => hash(node.raw || '')))
      === JSON.stringify(contract.corporateInlineStyleSha256), 'reviewed corporate inline styles changed')
    requireNative(JSON.stringify(all.filter(node => node.tag === 'link' && /stylesheet/.test(node.attrs.rel || '')).map(identity))
      === JSON.stringify(contract.corporateStylesheetDeclarations), 'reviewed corporate stylesheet declarations changed')
    const styles = []
    for (let offset = 0; offset < contract.corporateStylesheetAssets.length; offset += 3) {
      const loaded = await Promise.all(contract.corporateStylesheetAssets.slice(offset, offset + 3).map(async asset => {
        const result = await read(asset.requestedUrl, 'asset')
        requireNative(result.bytes === asset.bytes && result.sha256 === asset.sha256, 'reviewed corporate stylesheet changed')
        return result.body
      }))
      styles.push(...loaded)
    }
    const document = readVisibleNativeDocument(body + styles.map(css => '<style>' + css + '</style>').join(''), { strict: true })
    const links = document.nodes(node => node.tag === 'a' && node.attrs.href === contract.nativeBoard)
    requireNative(links.length === 1 && /hiring/i.test(document.text(links[0])), 'active corporate careers handoff changed')
    return { verified: true, checkedAt: verifiedAt, officialURL: contract.officialHomepage,
      matchedLinks: [contract.nativeBoard], bindingMethod: 'runtime-current-careers-link' }
  }
  const epoch = async () => {
    const bindingEvidence = await homepage()
    const page = await read(contract.nativeBoard, 'page')
    // This exact unfiltered, server-rendered empty template is qualified as a
    // whole. Referral entropy cannot alter executable, vacancy or CSS bytes.
    // Changed or hidden rows, continuation, filtering or visibility all reject.
    requireNative(hash(normalizeTemplate(page.body)) === contract.boardNormalizedSha256, 'reviewed native template changed')
    const document = readNativeDocument(page.body)
    const empty = readBreezyEmptyState(document, contract.nativeBoard, {
      companyName: contract.company, officialHomepageUrl: contract.officialHomepage, bindingEvidence,
    })
    requireNative(empty, 'unfiltered native empty identity changed')
    for (let offset = 0; offset < contract.assets.length; offset += 3) {
      await Promise.all(contract.assets.slice(offset, offset + 3).map(async asset => {
        const result = await read(asset.requestedUrl, 'asset')
        requireNative(result.bytes === asset.bytes && result.sha256 === asset.sha256, 'reviewed declared native asset changed')
      }))
    }
    // The exact reviewed translation maps %LABEL_NO_POSITIONS% to the native
    // English no-open-positions statement. No publisher program is executed.
    return { ...empty, translationResolved: true, nativeEnglishStatement: contract.knownNativeEnglishEmptyStatement,
      normalizedTemplateSha256: contract.boardNormalizedSha256 }
  }
  const opening = await epoch(), closing = await epoch()
  signal.throwIfAborted()
  requireNative(JSON.stringify(opening) === JSON.stringify(closing), 'closing native inventory changed')
  const audit = { source: 'anydo', recordKind: 'vacancy-rows', observedRecordCount: 0, observedVacancyCount: 0,
    configuredBoardComplete: true, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null,
    lifecycleCleanupAllowed: false, closingStable: true, opening, closing, retainedResponses: receipts }
  if (options.onAudit) await bounded(() => options.onAudit(structuredClone(audit)), signal)
  signal.throwIfAborted()
  const jobs = []
  attachSourceObservationEvidence(jobs, audit)
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
  return attachInventoryEvidence(jobs, { status: 'verified-empty', firstParty: true, listingComplete: true,
    lifecycleCleanupAllowed: false, surface: contract.nativeBoard, reportedTotal: 0, indiaFacetCount: 0,
    pagesFetched: requests, verifiedAt, reason: 'current-corporate-declared-unfiltered-native-board;reviewed-empty-template-and-declared-assets;fresh-closing;company-wide-scope-unverified;cleanup-forbidden' })
}
