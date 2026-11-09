import { createHash } from 'node:crypto'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const TOKEN = 'globalhealthcareexchangeinc'
const JOB_ID = '4730895005'
const BOARD = `https://job-boards.greenhouse.io/${TOKEN}`
const UNAVAILABLE = `${BOARD}?error=true`
// Greenhouse's observed publisher metadata serializes its own URL with http.
// Requests and redirects must remain the exact HTTPS authorities above.
const PUBLISHER_URL = UNAVAILABLE.replace('https:', 'http:')
const sha = value => createHash('sha256').update(value).digest('hex')
const modelHash = value => sha(JSON.stringify(value))
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [null, Object.prototype].includes(Object.getPrototypeOf(value))
const need = (value, reason) => { if (!value) throw new Error('GHX advertised-role audit: ' + reason) }
const once = (rows, reason) => { need(rows.length === 1, reason); return rows[0] }

const abortable = (operation, signal) => {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const aborted = () => { cleanup(); reject(signal.reason) }
    const cleanup = () => signal.removeEventListener('abort', aborted)
    signal.addEventListener('abort', aborted, { once: true })
    let pending
    try { pending = operation() } catch (error) { cleanup(); reject(error); return }
    Promise.resolve(pending).then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
  })
}
// Structured-data scripts remain metadata under visual hiding attributes.
// Only true semantic/inert raw fallback boundaries exclude their contents.
const metadataFallbacks = new Set(['template', 'iframe', 'noscript', 'style', 'textarea', 'title', 'xmp', 'noembed', 'noframes', 'plaintext'])
const structuredDataCarriers = node => {
  if (typeof node === 'string' || metadataFallbacks.has(node.tag)) return []
  const own = node.tag === 'script' && (node.attrs.type || '').split(';')[0].trim().toLowerCase() === 'application/ld+json'
  return [...(own ? [node] : []), ...(node.children || []).flatMap(structuredDataCarriers)]
}

const readPublicBoard = (html, payload) => {
  const document = readNativeDocument(html)
  const title = once(document.nodes(node => node.tag === 'title'), 'missing or ambiguous public board title')
  need(title.raw?.trim() === 'Jobs at GHX', 'foreign public board title')
  const canonical = once(document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'missing or ambiguous public canonical')
  const og = once(document.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:url'), 'missing or ambiguous public URL')
  need(canonical.attrs.href === PUBLISHER_URL && og.attrs.content === PUBLISHER_URL, 'public canonical identity differs')
  const allScripts = document.nodes(node => node.tag === 'script')
  // The retained unavailable-board model has no structured-data carriers.
  // Any new active carrier introduces unreviewed role scope, including aliases
  // and contexts that a partial JSON-LD interpreter could silently miss.
  const rootNode = once(document.nodes(node => node.tag === 'root'), 'missing or ambiguous public document root')
  need(structuredDataCarriers(rootNode).length === 0,
    'new active structured-data carrier leaves public role scope unverified')
  const scripts = allScripts.filter(node => !node.attrs.src)
  const script = once(scripts.filter(node => /window\.__remixContext/.test(node.raw || '')), 'missing or ambiguous current public board model')
  need(!Object.hasOwn(script.attrs, 'nomodule') && /^(?:|module|(?:text|application)\/javascript)$/i.test(script.attrs.type || ''), 'inactive public model carrier')
  const match = /^\s*window\.__remixContext\s*=\s*([\s\S]+);\s*$/.exec(script.raw)
  need(match, 'malformed public model assignment')
  const app = readLiteralModel(match[1]).value, state = app?.state, loader = state?.loaderData
  need(app?.isSpaMode === false && state?.errors === null && state.actionData === null && plain(loader)
    && Object.keys(loader).length === 2 && Object.hasOwn(loader, 'root') && Object.hasOwn(loader, 'routes/$url_token'), 'unknown, failed or active-role public state')
  const root = loader.root, route = loader['routes/$url_token']
  need(root?.internal === false && root.preview === false && root.embedded === false && root.isJobPost === false
    && root.urlToken === TOKEN && root.href === PUBLISHER_URL
    && root.boardConfiguration?.job_board_id === 4001903005 && root.boardConfiguration.job_board_public_url === BOARD,
  'public root is not the current non-role GHX board')
  need(route?.urlToken === TOKEN && route.url === PUBLISHER_URL && route.board?.name === 'GHX'
    && route.board.public_url === BOARD && route.board.redirect_to === null, 'foreign or redirected public employer model')
  const index = route.jobPosts, native = new Map(payload.jobs.map(row => [row.id, row])), seen = new Set()
  need(plain(index) && index.page === 1 && index.total_pages === 1 && index.total === native.size
    && index.count === native.size && Array.isArray(index.data) && index.data.length === native.size, 'public/native inventory count or pagination differs')
  const reconcile = row => {
    const original = native.get(row?.id)
    need(plain(row) && Number.isSafeInteger(row.id) && row.id > 0 && original
      && row.title === original.title && row.absolute_url === original.absolute_url
      && row.location === original.location?.name && row.internal_job_id === original.internal_job_id
      && row.requisition_id === original.requisition_id && row.isListed !== false
      && (!Object.hasOwn(row, 'isListed') || typeof row.isListed === 'boolean')
      && (row.company_name == null || row.company_name === 'GHX'), 'public/native role identity or scope differs')
  }
  for (const row of index.data) {
    reconcile(row); need(!seen.has(row.id), 'repeated public native role'); seen.add(row.id)
  }
  need(seen.size === native.size && !seen.has(Number(JOB_ID)), 'public active role contradicts unavailable role')
  need(plain(route.featuredPosts) && Array.isArray(route.featuredPosts.data), 'unknown public featured-role shape')
  for (const row of route.featuredPosts.data) reconcile(row)
  return { nativeCount: native.size, modelSha256: modelHash({ root: { token: root.urlToken, boardId: root.boardConfiguration.job_board_id,
    publicUrl: root.boardConfiguration.job_board_public_url, isJobPost: root.isJobPost },
  jobPosts: index, featuredPosts: route.featuredPosts, board: { name: route.board.name, public_url: route.board.public_url,
    redirect_to: route.board.redirect_to } }) }
}

// A single currently observed stale advertisement is eligible for this audit.
// It is accounted as unavailable on public native surfaces, never as an active
// role or an inferred country. New missing IDs keep the company coverage gap.
export const verifyCurrentUnavailableGhxRole = async ({ jobIds, payload, officialHtml, nativeUrl, officialUrl,
  fetchJson, fetchText, validateNative, readOfficialJobIds, signal, fetchImpl = globalThis.fetch }) => {
  const result = { verified: false, proofs: [], failures: [], requestsAttempted: 0, responsesReceived: 0 }
  if (jobIds.length !== 1 || jobIds[0] !== JOB_ID) {
    result.failures.push({ reason: 'unreviewed-advertised-role-scope', jobIds: [...jobIds] })
    return result
  }
  const auditSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(45000)])
  const read = async (url, { status, contentType = null, limit = 65536 }) => {
    auditSignal.throwIfAborted()
    const requestSignal = AbortSignal.any([auditSignal, AbortSignal.timeout(15000)])
    result.requestsAttempted++
    const response = await abortable(() => fetchImpl(url, { redirect: 'manual', signal: requestSignal,
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json,text/html;q=0.9,*/*;q=0.8' } }), requestSignal)
    result.responsesReceived++
    requestSignal.throwIfAborted()
    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const cancel = () => { response.body?.cancel().catch(() => {}) }
    if (response.url !== url || response.status !== status || contentType && type !== contentType
      || Number(response.headers.get('content-length')) > limit) {
      cancel(); need(false, 'unavailability response status, URL, type or size unverified')
    }
    let bytes = 0; const chunks = [], reader = response.body?.getReader()
    try {
      if (reader) while (true) {
        const part = await abortable(() => reader.read(), requestSignal)
        requestSignal.throwIfAborted()
        if (part.done) break
        bytes += part.value.length
        need(bytes <= limit, 'unavailability response exceeds bounded evidence budget')
        chunks.push(Buffer.from(part.value))
      }
    } catch (error) { reader?.cancel().catch(() => {}); throw error }
    const body = Buffer.concat(chunks).toString('utf8')
    return { body, url, status, contentType: type || null, location: response.headers.get('location'),
      bytes, sha256: sha(body), observedAt: new Date().toISOString() }
  }
  const observeUnavailable = async current => {
    const api = await read(`https://boards-api.greenhouse.io/v1/boards/${TOKEN}/jobs/${JOB_ID}?content=true`, { status: 404, contentType: 'application/json' })
    const data = readLiteralModel(api.body).value
    need(plain(data) && Object.keys(data).length === 2 && data.status === 404 && data.error === 'Job not found', 'unknown native API404 body')
    const publicRole = await read(`${BOARD}/jobs/${JOB_ID}`, { status: 302, limit: 4096 })
    need(publicRole.location === `/${TOKEN}?error=true`, 'unreviewed public redirect destination')
    const publicBoard = await read(UNAVAILABLE, { status: 200, contentType: 'text/html', limit: 3 * 1024 * 1024 })
    const reconciled = readPublicBoard(publicBoard.body, current)
    const metadata = ({ body, ...proof }) => proof
    return { api: metadata(api), publicRole: metadata(publicRole), publicBoard: { ...metadata(publicBoard), ...reconciled } }
  }
  try {
    const opening = await observeUnavailable(payload)
    auditSignal.throwIfAborted()
    result.requestsAttempted++
    const closingNative = await abortable(() => fetchJson(nativeUrl, { method: 'GET', signal: auditSignal }), auditSignal)
    result.responsesReceived++
    auditSignal.throwIfAborted()
    validateNative(closingNative)
    const nativeSha256 = modelHash(payload)
    need(modelHash(closingNative) === nativeSha256, 'full opening/closing native state changed')
    const closing = await observeUnavailable(closingNative)
    need(closing.publicBoard.modelSha256 === opening.publicBoard.modelSha256, 'opening/closing public board state changed')
    result.requestsAttempted++
    const closingOfficial = await abortable(() => fetchText(officialUrl, { signal: auditSignal }), auditSignal)
    result.responsesReceived++
    auditSignal.throwIfAborted()
    const openingIds = readOfficialJobIds(officialHtml), closingIds = readOfficialJobIds(closingOfficial)
    need(JSON.stringify([...openingIds].sort()) === JSON.stringify([...closingIds].sort()), 'opening/closing official role handoff changed')
    result.proofs.push({ jobId: JOB_ID, method: 'ghx-current-api404-public-non-role-board-opening-closing',
      opening, closing, nativeFeedModelSha256: nativeSha256,
      openingOfficialSha256: sha(officialHtml), closingOfficialSha256: sha(closingOfficial),
      verifiedAt: new Date().toISOString() })
    result.verified = true
  } catch (error) {
    signal?.throwIfAborted()
    result.failures.push({ jobId: JOB_ID, reason: error.message })
  }
  return result
}
