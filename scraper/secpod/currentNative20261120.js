import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { parse } from 'acorn'
import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { nativeCountryName, nativeDate } from '../../scraper-support/shared/nativeJobPosting.js'
import { boundedDeclaredPublicRead } from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import { requireNativeHttpResponse } from '../../scraper-support/shared/nativeHttpResponse.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const CAREERS = 'https://www.secpod.com/careers'
const CLIENT = 'https://www.secpod.com/_next/static/chunks/1rlegxh7vrma8.js'
const CLIENT_SHA = '7b822b19690ff082cea82a2911d19aa49fec282f558cbd4ef051cefa27b1d57b'
const ROOT = 'https://secpod.keka.com/careers/'
const IDENTIFIER = '8010166a-b48d-4997-9d93-64a354522150'
const RENDERER = ROOT + 'api/embedjobs/js/' + IDENTIFIER
const INFO = ROOT + 'api/organization/default/careerportalinfo'
const ACTIVE = ROOT + 'api/embedjobs/default/active/' + IDENTIFIER
const allowed = new Set([CAREERS, CLIENT, RENDERER, INFO, ACTIVE])
const sha = value => createHash('sha256').update(value).digest('hex')
const contractError = message => Object.assign(Error('SecPod current recruitment: ' + message), {
  code: 'SECPOD_NATIVE_CONTRACT', abortRetries: true, failureKind: 'parser_or_contract_error',
  sourceScopeComplete: false, lifecycleCleanupAllowed: false,
})
const need = (condition, message) => { if (!condition) throw contractError(message) }
const walk = (node, visit) => {
  if (!node || typeof node !== 'object') return
  visit(node)
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit))
    else if (value && typeof value === 'object') walk(value, visit)
  }
}
const field = (node, key) => node?.type === 'ObjectExpression'
  ? node.properties.filter(property => property.type === 'Property' && !property.computed
    && (property.key.name ?? property.key.value) === key).map(property => property.value) : []
const one = (values, label) => { need(values.length === 1, 'missing or ambiguous ' + label); return values[0] }

function declaration(html, client) {
  const doc = readNativeDocument(html)
  need(!doc.nodes(node => node.tag === 'base').length, 'unreviewed document base')
  need(doc.nodes(node => node.tag === 'title').some(node => /SecPod Careers/.test(node.raw || ''))
    && doc.nodes(node => node.tag === 'h1' && doc.text(node) === 'Shape the Future of Preventive Cybersecurity with SecPod').length === 1
    && doc.nodes(node => node.attrs.id === 'khembedjobs').length === 1, 'current corporate publisher or jobs mount changed')
  need(doc.nodes(node => node.tag === 'script' && node.attrs.src
    && !Object.hasOwn(node.attrs, 'nomodule') && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || ''))
    .some(node => new URL(node.attrs.src, CAREERS).href === CLIENT), 'current careers client is not actively declared')
  // This is the reviewed active careers component (module 88793), not a
  // search for an ATS token in arbitrary downloaded JavaScript. A new build
  // needs review before it may delegate this publisher's acquisition.
  need(sha(client) === CLIENT_SHA, 'reviewed careers client program changed')
  const candidates = [], renderers = []
  walk(parse(client, { ecmaVersion: 'latest' }), node => {
    if (node.type !== 'ObjectExpression') return
    const id = field(node, 'id'), children = field(node, 'children'), strategy = field(node, 'strategy')
    if (id.length === 1 && id[0].value === 'keka-config' && strategy.length === 1 && strategy[0].value === 'afterInteractive') {
      const value = one(children, 'native configuration child')
      need(value.type === 'TemplateLiteral' && value.expressions.length === 0 && value.quasis.length === 1, 'nonliteral native configuration')
      candidates.push(value.quasis[0].value.cooked)
    }
    if (field(node, 'src').some(value => value.value === RENDERER)
      && strategy.length === 1 && strategy[0].value === 'lazyOnload') renderers.push(node)
  })
  one(renderers, 'native renderer declaration')
  const program = parse(one(candidates, 'native Keka configuration'), { ecmaVersion: 'latest' })
  need(program.body.length === 1, 'native configuration statement changed')
  const assignment = program.body[0].expression
  need(assignment?.type === 'AssignmentExpression' && assignment.operator === '='
    && assignment.left.type === 'MemberExpression' && !assignment.left.computed
    && assignment.left.object.name === 'window' && assignment.left.property.name === 'khConfig', 'native configuration assignment changed')
  const config = {}
  need(assignment.right.type === 'ObjectExpression', 'nonliteral native configuration object')
  for (const property of assignment.right.properties) {
    need(property.type === 'Property' && !property.computed && !property.method && property.kind === 'init'
      && property.value.type === 'Literal', 'nonliteral native configuration field')
    const key = property.key.name ?? property.key.value
    need(['identifier', 'domain', 'targetContainer', 'portalName'].includes(key) && !Object.hasOwn(config, key), 'unknown or duplicate native configuration field')
    config[key] = property.value.value
  }
  need(config.identifier === IDENTIFIER && config.domain === ROOT && config.targetContainer === '#khembedjobs'
    && (!config.portalName || config.portalName === 'default'), 'native account declaration changed')
  return config
}

const waitForText = (operation, signal) => new Promise((resolve, reject) => {
  const abort = () => reject(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  else Promise.resolve().then(operation).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
})

export async function runCurrentSecPod(options, legacy) {
  options.signal?.throwIfAborted()
  const maxRequests = options.maxRequests ?? 8, sourceMs = options.sourceTimeoutMs ?? 45000
  const requestMs = options.requestTimeoutMs ?? 15000, interval = options.requestIntervalMs ?? 300
  need(Number.isSafeInteger(maxRequests) && maxRequests > 0 && maxRequests <= 16
    && Number.isSafeInteger(sourceMs) && sourceMs > 0 && sourceMs <= 180000
    && Number.isSafeInteger(requestMs) && requestMs > 0 && requestMs <= 20000
    && Number.isSafeInteger(interval) && interval >= 0 && interval <= 5000, 'invalid request bounds')
  need(!options.fetchPage && !options.fetchJson && !options.probeUrl, 'unsupported transport; use fetchImpl or fetchText')
  const owner = new AbortController(), timer = setTimeout(() => owner.abort(new DOMException('SecPod source deadline exceeded', 'TimeoutError')), sourceMs)
  const signal = options.signal ? AbortSignal.any([options.signal, owner.signal]) : owner.signal
  const receipts = [], now = typeof options.now === 'function' ? options.now() : new Date().toISOString()
  let totalBytes = 0
  const read = async (url, kind) => {
    signal.throwIfAborted()
    need(allowed.has(url) && receipts.length < maxRequests, 'unbound request or request budget reached')
    if (receipts.length && interval) await delay(interval, undefined, { signal })
    const receipt = { requestedURL: url, requestedAt: new Date().toISOString() }
    receipts.push(receipt)
    let bytes
    if (options.fetchText) {
      const value = await waitForText(() => options.fetchText(url, { signal }), AbortSignal.any([signal, AbortSignal.timeout(requestMs)]))
      need(typeof value === 'string', 'injected text transport returned a non-string')
      bytes = Buffer.from(value)
      receipt.transport = 'injected-text'
    } else {
      const original = await boundedDeclaredPublicRead(url, { signal, timeoutMs: requestMs,
        overflowError: contractError('native response byte budget reached'),
        fetchImpl: async (requested, init) => {
          const response = await (options.fetchImpl ?? globalThis.fetch)(requested, { ...init, credentials: 'omit', cache: 'no-store' })
          await requireNativeHttpResponse(response, requested, { context: 'SecPod current recruitment', signal: init.signal, callerSignal: options.signal })
          return response
        } })
      bytes = Buffer.from(original.bodyBase64, 'base64')
      const mime = original.headers['content-type'] || ''
      const expected = kind === 'json' ? /^application\/json(?:;|$)/i : kind === 'js'
        ? /^(?:application|text)\/(?:x-)?(?:java|ecma)script(?:;|$)/i : /^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i
      need(expected.test(mime) || url === RENDERER && /^text\/js(?:;|$)/i.test(mime), 'native response content type changed')
      Object.assign(receipt, { status: original.status, finalURL: original.url, contentType: mime })
    }
    signal.throwIfAborted()
    totalBytes += bytes.length
    need(bytes.length <= 16 * 1024 * 1024 && totalBytes <= 32 * 1024 * 1024, 'native response byte budget reached')
    Object.assign(receipt, { bytes: bytes.length, sha256: sha(bytes), bodyBase64: bytes.toString('base64'), completedAt: new Date().toISOString() })
    return new TextDecoder('utf8', { fatal: true }).decode(bytes)
  }
  try {
    const page = await read(CAREERS, 'html'), doc = readNativeDocument(page)
    if (!doc.nodes(node => node.attrs.id === 'khembedjobs').length) return legacy(page)
    declaration(page, await read(CLIENT, 'js'))
    const renderer = await read(RENDERER, 'js')
    need(['api/organization/${portalName}/careerportalinfo', 'api/embedjobs/${portalName}/active/', 'khConfig.identifier', 'job.jobLocations', 'jobdetails/']
      .every(value => renderer.includes(value)), 'native Keka renderer contract changed')
    const account = JSON.parse(await read(INFO, 'json'))
    need(account && account.name === 'SecPod Careers' && account.shortName === 'SecPod Careers'
      && account.careersPortalDomain === 'secpod.keka.com' && !account.error && account.success !== false, 'native account publisher changed')
    const rows = JSON.parse(await read(ACTIVE, 'json'))
    need(Array.isArray(rows) && rows.length <= 5000, 'invalid active native inventory')
    const ids = new Set(), jobs = [], holds = []
    for (const row of rows) {
      need(row && Number.isSafeInteger(row.id) && row.id > 0 && !ids.has(row.id) && typeof row.title === 'string' && row.title.trim()
        && typeof row.description === 'string' && extractActiveDescription(row.description).length >= 100
        && Array.isArray(row.jobLocations), 'invalid or duplicate full native role')
      ids.add(row.id)
      // The current feed has no per-role employer field. A new declaration
      // must be reviewed, rather than overwritten with the portal publisher.
      need(!['hiringOrganization', 'employer', 'companyName'].some(key => Object.hasOwn(row, key)),
        'unreviewed native role employer declaration')
      // New row-level publication declarations require review before this
      // source may rely on the native active endpoint for their status.
      need(!['isActive', 'active', 'isPublished', 'published', 'isDeleted', 'deleted', 'isClosed', 'closed',
        'isPublic', 'public', 'isInternal', 'internal', 'status', 'publicationStatus'].some(key => Object.hasOwn(row, key)),
      'unreviewed native role publication declaration')
      nativeDate(row.publishedOn, { required: true })
      const locations = row.jobLocations.map(location => {
        const code = nativeCountryName(location?.countryCode), name = nativeCountryName(location?.countryName)
        need(!code || !name || code === name, 'contradictory native work countries')
        return { original: location, code, name }
      })
      const india = locations.filter(location => location.code === 'India' && location.name === 'India')
      if (!india.length) {
        if (!locations.length || locations.some(location => !location.code || !location.name)) holds.push({ id: row.id, reason: 'native-work-country-unqualified' })
        continue
      }
      const sourceUrl = ROOT + 'jobdetails/' + row.id
      jobs.push({ source: 'secpod', company: 'SecPod', jobId: String(row.id), id: String(row.id), title: row.title,
        sourceUrl, applyUrl: sourceUrl, link: sourceUrl, country: 'India', city: india[0].original.city || india[0].original.name || null,
        location: india.map(({ original: location }) => [location.city || location.name, location.state, 'India'].filter(Boolean).join(', ')).join(' / '),
        jobDescription: row.description, sourceDescription: row.description, postingDate: row.publishedOn, postedAt: row.publishedOn,
        nativePublicationDate: row.publishedOn, nativeJobNumber: row.jobNumber ?? null, requisitionId: null,
        nativeSourceRecord: row, nativePublisherName: account.name, nativeHiringOrganization: null, legalEmployer: null,
        nativeEmployerBinding: { method: 'current-corporate-client-keka-account', officialURL: CAREERS, clientURL: CLIENT,
          clientSHA256: CLIENT_SHA, identifier: IDENTIFIER, portalPublisher: account.name, legalEmployer: null },
        sourceDetailComplete: true, sourceDetailStatus: 'complete', sourceEmployerQualified: true,
        sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, applicationVisited: false })
    }
    attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CAREERS, firstParty: true, listingComplete: false,
      lifecycleCleanupAllowed: false, pagesFetched: receipts.length, reportedTotal: null, indiaFacetCount: null, verifiedAt: now,
      reason: 'current-corporate-client-declared-keka-active-roles;company-wide-and-legal-employer-inventory-unverified' })
    attachSourceObservationEvidence(jobs, { source: 'secpod', recordKind: 'vacancy-rows', observedRecordCount: rows.length,
      observedVacancyCount: rows.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: { source: 'secpod', nativeAccount: account,
      nativeActiveInventory: rows, observedListingCount: rows.length, extractedDetailJobs: jobs.length, holds, retainedResponses: receipts,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false, companyGlobalTotal: null, companyIndiaTotal: null } })
    signal.throwIfAborted()
    return jobs
  } finally { clearTimeout(timer); owner.abort() }
}
