import { createHash } from 'node:crypto'
import { parse } from 'acorn'
import { readNativeDocument, activeHead } from './activeNativeHtml.js'
import { createPublishingGapAtsScraper } from './publishingGapAts.js'
import { attachInventoryEvidence, readInventoryEvidence } from './inventoryEvidence.js'

const BOT = /verify you are human|checking your browser|just a moment\.\.\.|captcha challenge|access denied/i
export const corporateFeedHash = value => createHash('sha256').update(value).digest('hex')
export const requireCorporateFeed = (condition, reason) => { if (!condition) throw Error(reason) }
const exactName = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

// Parse executable script elements without evaluating publisher JavaScript.
// Ordinary function bodies are considered only when called or registered as a
// page-ready handler; comments, data scripts and inert HTML grant no authority.
export function corporateScriptNodes(html, { publisherHTML = html, pageReadyFunctions = [] } = {}) {
  const document = readNativeDocument(html), result = []
  const publisher = publisherHTML === html ? document : readNativeDocument(publisherHTML)
  const scripts = document.nodes(node => node.tag === 'script' && !node.attrs.src
    && (!node.attrs.type || /^(?:module|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type)))
  for (const script of scripts) {
    let program
    try { program = parse(script.raw || '', { ecmaVersion: 'latest', sourceType: script.attrs.type === 'module' ? 'module' : 'script' }) }
    catch { continue }
    const called = new Set(), UNKNOWN = Symbol('unknown')
    const literal = (node, scope, seen = new Set()) => {
      if (!node || seen.has(node)) return UNKNOWN
      seen.add(node)
      if (node.type === 'Literal' && !node.regex) return node.value
      if (node.type === 'Identifier') return literal(scope.get(node.name), scope, seen)
      if (node.type === 'UnaryExpression' && node.operator === '!') {
        const value = literal(node.argument, scope, seen)
        return value === UNKNOWN ? UNKNOWN : !value
      }
      if (node.type === 'LogicalExpression') {
        const left = literal(node.left, scope, seen)
        if (left === UNKNOWN) return UNKNOWN
        if (node.operator === '&&') return left ? literal(node.right, scope, seen) : left
        if (node.operator === '||') return left ? left : literal(node.right, scope, seen)
        if (node.operator === '??') return left == null ? literal(node.right, scope, seen) : left
      }
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed
        && node.callee.object.name === 'document' && node.callee.property.name === 'getElementById'
        && node.arguments.length === 1 && node.arguments[0].type === 'Literal') {
        return publisher.nodes(item => item.attrs.id === node.arguments[0].value).length === 1
      }
      return UNKNOWN
    }
    const visit = (node, scope = new Map()) => {
      if (!node || typeof node !== 'object' || !node.type) return
      result.push(node)
      if (node.type === 'Program' || node.type === 'BlockStatement') {
        const local = new Map(scope)
        for (const child of node.body) {
          if (child.type === 'FunctionDeclaration' && child.id) local.set(child.id.name, child)
        }
        for (const child of node.body) {
          if (visit(child, local) === true) return true
        }
        return false
      }
      if (node.type === 'VariableDeclaration' && node.kind === 'const') {
        for (const item of node.declarations) {
          visit(item, scope)
          if (item.id.type === 'Identifier') scope.set(item.id.name, item.init)
        }
        return false
      }
      if (['ReturnStatement', 'ThrowStatement'].includes(node.type)) { visit(node.argument, scope); return true }
      if (/Function(?:Declaration|Expression)$/.test(node.type)) return
      // Runtime iteration and switch reachability are outside this narrow
      // declaration reader. They cannot confer feed authority.
      if (['WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'SwitchStatement'].includes(node.type)) return
      if (node.type === 'TryStatement') {
        const ended = visit(node.block, scope)
        const finallyEnded = visit(node.finalizer, scope)
        return ended === true || finallyEnded === true
      }
      if (node.type === 'IfStatement' || node.type === 'ConditionalExpression') {
        const value = literal(node.test, scope)
        return value !== UNKNOWN ? visit(value ? node.consequent : node.alternate, scope) : false
      }
      if (node.type === 'LogicalExpression') {
        visit(node.left, scope)
        const value = literal(node.left, scope)
        if (value !== UNKNOWN && (node.operator === '&&' && value || node.operator === '||' && !value
          || node.operator === '??' && value == null)) visit(node.right, scope)
        return
      }
      if (node.type === 'CallExpression') {
        const invoke = fn => {
          if (fn && !called.has(fn)) { called.add(fn); visit(fn.body, scope) }
        }
        if (node.callee.type === 'Identifier' && /Function(?:Declaration|Expression)$/.test(scope.get(node.callee.name)?.type || '')) invoke(scope.get(node.callee.name))
        else if (/FunctionExpression$/.test(node.callee.type)) invoke(node.callee)
        if (node.callee.type === 'Identifier' && pageReadyFunctions.includes(node.callee.name)
          && node.arguments.length === 1 && /FunctionExpression$/.test(node.arguments[0].type)) invoke(node.arguments[0])
        if (node.callee.type === 'MemberExpression' && !node.callee.computed
          && node.callee.object.type === 'Identifier' && ['document', 'window'].includes(node.callee.object.name)
          && node.callee.property.name === 'addEventListener' && ['DOMContentLoaded', 'load'].includes(node.arguments[0]?.value)) {
          const handler = node.arguments[1]
          invoke(handler?.type === 'Identifier' ? scope.get(handler.name) : handler)
        }
        if (node.callee.type === 'MemberExpression' && !node.callee.computed && node.callee.property.name === 'push'
          && node.callee.object.type === 'MemberExpression' && !node.callee.object.computed
          && node.callee.object.object.name === 'window' && node.callee.object.property.name === 'Webflow') {
          for (const handler of node.arguments) invoke(handler.type === 'Identifier' ? scope.get(handler.name) : handler)
        }
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) for (const child of value) visit(child, scope)
        else if (value && typeof value === 'object') visit(value, scope)
      }
    }
    visit(program)
  }
  return result
}

const cleanup = operation => { try { void Promise.resolve(operation()).catch(() => {}) } catch {} }
const awaitCorporateRead = (operation, signal, disposeLate) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason); return }
  let ended = false
  const aborted = () => { ended = true; signal.removeEventListener('abort', aborted); reject(signal.reason) }
  signal.addEventListener('abort', aborted, { once: true })
  Promise.resolve().then(operation).then(value => {
    if (ended) { if (disposeLate) cleanup(() => disposeLate(value)); return }
    ended = true; signal.removeEventListener('abort', aborted); resolve(value)
  }, error => { if (!ended) { ended = true; signal.removeEventListener('abort', aborted); reject(error) } })
})

export function requireCorporatePublisher(html, companyName) {
  const words = value => ' ' + String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' '
  const key = words(companyName)
  requireCorporateFeed(key.trim() && activeHead(html).titles.some(title => words(title).includes(key)), 'Current corporate employer title is unavailable')
}

export function createCorporateFeedReader(source, options = {}) {
  const timeout = options.sourceTimeoutMs ?? 90000
  requireCorporateFeed(Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 180000, 'Invalid corporate source timeout')
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(timeout)])
  const maxRequests = options.maxRequests ?? 48
  requireCorporateFeed(Number.isSafeInteger(maxRequests) && maxRequests > 0 && maxRequests <= 128, 'Invalid corporate request budget')
  const receipts = []
  let stopped = false, bytes = 0
  const read = async (value, json = false) => {
    signal.throwIfAborted()
    requireCorporateFeed(!stopped, 'Corporate feed requests stopped after access denial')
    const url = new URL(value)
    requireCorporateFeed(url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'Invalid public corporate feed URL')
    requireCorporateFeed(receipts.length < maxRequests, 'Corporate feed request budget reached')
    const receipt = { source, requestedURL: url.href, method: 'GET' }
    receipts.push(receipt)
    try {
      let raw, body
      if (json && options.fetchJson) {
        const payload = await awaitCorporateRead(() => options.fetchJson(url.href, { signal }), signal)
        raw = { status: 200, url: url.href }; body = JSON.stringify(payload)
      } else if (!json && options.fetchPage) {
        const page = await awaitCorporateRead(() => options.fetchPage(url.href, { signal }), signal,
          late => late?.body?.cancel(signal.reason))
        raw = typeof page === 'string' ? { status: 200, url: url.href } : page
        body = typeof page === 'string' ? page : page.html
      } else {
        raw = await awaitCorporateRead(() => (options.fetchImpl || globalThis.fetch)(url.href, { method: 'GET', credentials: 'omit',
          redirect: json ? 'error' : 'follow', signal,
          headers: { Accept: json ? 'application/json' : 'text/html,application/javascript',
            'User-Agent': 'Mozilla/5.0 (compatible; Jobverify current careers feed check)' } }), signal,
        late => late?.body?.cancel(signal.reason))
        requireCorporateFeed(Number(raw.headers?.get('content-length') || 0) <= 4e6, 'Corporate feed response exceeds body limit')
        const reader = raw.body?.getReader()
        if (reader) {
          const chunks = []; let count = 0
          try {
            for (;;) {
              const item = await awaitCorporateRead(() => reader.read(), signal); signal.throwIfAborted(); if (item.done) break
              count += item.value.byteLength
              requireCorporateFeed(count <= 4e6, 'Corporate feed response exceeds body limit')
              chunks.push(Buffer.from(item.value))
            }
            body = Buffer.concat(chunks).toString('utf8')
          } finally { cleanup(() => reader.cancel()); cleanup(() => reader.releaseLock()) }
        } else body = await awaitCorporateRead(() => raw.text(), signal)
      }
      signal.throwIfAborted()
      receipt.status = raw.status; receipt.finalURL = raw.url || url.href
      requireCorporateFeed(new URL(receipt.finalURL).origin === url.origin, 'Corporate feed cross-origin redirect refused')
      requireCorporateFeed(typeof body === 'string' && Buffer.byteLength(body) <= 4e6, 'Missing or oversized corporate feed body')
      bytes += Buffer.byteLength(body)
      requireCorporateFeed(bytes <= 16e6, 'Corporate feed aggregate body budget reached')
      receipt.bodySHA256 = corporateFeedHash(body)
      if ([401, 403, 429].includes(raw.status) || BOT.test(body)) {
        stopped = true
        throw Object.assign(Error('Corporate feed access denied: HTTP ' + raw.status), { status: raw.status, abortRetries: true })
      }
      requireCorporateFeed(raw.status === 200, 'Corporate feed HTTP ' + raw.status)
      return { url: receipt.finalURL, html: body, bodySHA256: receipt.bodySHA256,
        ...(json ? { payload: JSON.parse(body) } : {}) }
    } catch (error) { receipt.error = error?.message || String(error); throw error }
  }
  return { signal, receipts, readPage: url => read(url), readJson: async url => (await read(url, true)).payload }
}

const validateNativeRecordIdentities = (payload, feed, companyName) => {
  requireCorporateFeed(Array.isArray(payload?.jobs), 'Native corporate feed records unavailable')
  const ids = new Set()
  for (const row of payload.jobs) {
    const key = String(row?.id || '')
    requireCorporateFeed(key && !ids.has(key), 'Duplicate or unavailable corporate native identity')
    ids.add(key)
    if (feed.kind === 'greenhouse') {
      requireCorporateFeed(exactName(row.company_name) === exactName(companyName), 'Native corporate feed employer mismatch')
      const url = new URL(row.absolute_url)
      const corporateRoute = feed.corporateRoleRoute
      const ownCorporateRole = corporateRoute && corporateRoute.origins.includes(url.origin)
        && url.pathname === corporateRoute.path && url.searchParams.get(corporateRoute.idParameter) === key
        && [...url.searchParams.keys()].length === 1 && !url.username && !url.password && !url.hash
      requireCorporateFeed(ownCorporateRole || ['job-boards.greenhouse.io', 'boards.greenhouse.io'].includes(url.hostname)
        && url.pathname.replace(/\/$/, '') === `/${feed.token}/jobs/${key}`
        && url.protocol === 'https:' && !url.username && !url.password && !url.hash, 'Native corporate feed job account or identity mismatch')
    } else {
      for (const [field, suffix] of [['jobUrl', ''], ['applyUrl', '/application']]) {
        const url = new URL(row[field])
        requireCorporateFeed(url.origin === 'https://jobs.ashbyhq.com'
          && url.pathname.replace(/\/$/, '') === `/${feed.token}/${key}${suffix}`
          && !url.username && !url.password && !url.hash, 'Native corporate feed job account or identity mismatch')
      }
    }
  }
}

export function attachCorporateFeedResult(jobs, { source, surface, nativeBoards, reader, failures = [], nativeScopeComplete = false }) {
  for (const job of jobs) Object.assign(job, { sourceScopeComplete: false, sourceListingComplete: nativeScopeComplete, lifecycleCleanupAllowed: false })
  const audit = { source, nativeBoards, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    companyScopeComplete: false, nativeConfiguredScopeComplete: nativeScopeComplete,
    receipts: reader.receipts, failures, observedNativeRecordCount: nativeBoards.reduce((sum, board) => sum + board.nativeRecords.length, 0) }
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: audit })
  Object.defineProperty(jobs, Symbol.for('jobverify.verified-recruitment-observations'), { configurable: true,
    value: { source, observedAt: new Date().toISOString(), requestCount: reader.receipts.length,
      nativeRecords: audit.observedNativeRecordCount, returnedIndiaJobs: jobs.length, receipts: reader.receipts,
      failures, nativeInventoryReads: nativeBoards.map(b => ({ kind: b.kind, surface: b.surface, reportedTotal: b.nativeRecords.length })),
      sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      unresolved: nativeScopeComplete ? ['company-wide-channel-coverage-unverified'] : ['current-native-scope-or-country-coverage-unverified'],
      boards: nativeBoards.map(b => ({ kind: b.kind, token: b.boardToken })) } })
  return attachInventoryEvidence(jobs, { status: nativeScopeComplete ? audit.observedNativeRecordCount ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
    surface, firstParty: true, listingComplete: nativeScopeComplete,
    lifecycleCleanupAllowed: false, pagesFetched: reader.receipts.length,
    reportedTotal: nativeScopeComplete ? audit.observedNativeRecordCount : null, indiaFacetCount: nativeScopeComplete ? jobs.length : null,
    verifiedAt: new Date().toISOString(), reason: (nativeScopeComplete ? 'current-corporate-declared-native-configured-inventory-opening-and-closing-reconciled'
      : 'current-corporate-bound-native-feeds;native-configured-scope-or-country-unverified') + ';company-wide-channel-coverage-unverified'
      + (failures.length ? ';native-failures=' + failures.length : '') })
}

export async function runCurrentCorporateFeeds(config, options = {}) {
  const reader = createCorporateFeedReader(config.source, options), nativeBoards = [], failures = [], jobs = []
  let nativeScopeComplete = false
  try {
    const corporate = await reader.readPage(config.companyCareerPage)
    requireCorporatePublisher(corporate.html, config.companyName)
    const feeds = await config.discover(corporate, reader)
    requireCorporateFeed(feeds.length > 0 && feeds.length <= 4, 'Current corporate native feed declaration unavailable')
    for (const feed of feeds) {
      try {
        const binding = { bindingMethod: 'runtime-current-corporate-renderer-declaration', officialURL: corporate.url,
          officialPageSHA256: corporate.bodySHA256, ...feed.binding }
        const provider = { source: config.source, companyName: config.companyName, companyDomain: config.companyDomain,
          companyCareerPage: config.companyCareerPage, atsPlatform: feed.kind, boardToken: feed.token, sourceScopeComplete: false }
        const rows = await createPublishingGapAtsScraper(provider).run({ signal: reader.signal,
          fetchJson: async url => {
            const canonical = feed.kind === 'greenhouse'
              ? `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(feed.token)}/jobs?content=true`
              : `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(feed.token)}`
            requireCorporateFeed(url === canonical, 'Undeclared corporate native API request refused')
            const payload = await reader.readJson(feed.inventoryURL || canonical)
            validateNativeRecordIdentities(payload, feed, config.companyName)
            return payload
          }, fetchPage: async url => {
            requireCorporateFeed(feed.kind === 'ashby' && new URL(url).origin === 'https://jobs.ashbyhq.com'
              && new URL(url).pathname.startsWith('/' + feed.token + '/'), 'Unbound corporate native role request refused')
            return reader.readPage(url)
          } })
        const audit = rows.nativeCollectionEvidence
        requireCorporateFeed(audit && Array.isArray(audit.nativeRecords), 'Corporate native record evidence unavailable')
        const inventory = readInventoryEvidence(rows)
        // The existing adapter's company-scope hold remains intact. A distinct
        // proof can qualify its configured native feed only when no native
        // shape, identity, criteria or country uncertainty remains.
        const nativeValidationComplete = inventory?.reportedTotal === audit.nativeRecords.length
          && inventory.indiaFacetCount != null && (inventory.listingComplete
            || inventory.reason === `${feed.kind}-public-posting-api-incomplete:provider-source-scope-unresolved`)
        nativeBoards.push({ kind: feed.kind, boardToken: feed.token, surface: feed.inventoryURL,
          binding, ...audit, nativeValidationComplete, inventoryEvidence: inventory })
        for (const job of rows) jobs.push({ ...job, officialAtsBinding: binding })
      } catch (error) {
        reader.signal.throwIfAborted()
        failures.push({ stage: 'native-feed', surface: feed.inventoryURL, message: error.message })
        if ([401, 403, 429].includes(error.status)) break
      }
    }
    requireCorporateFeed(nativeBoards.length > 0 && (jobs.length > 0 || failures.length === 0), 'Current corporate native feed inventory unavailable')
    if (config.reconcileNativeScope && failures.length === 0 && nativeBoards.length === feeds.length
      && nativeBoards.every(board => board.nativeValidationComplete)) {
      try {
        for (const [index, feed] of feeds.entries()) {
          const closing = await reader.readJson(feed.inventoryURL)
          validateNativeRecordIdentities(closing, feed, config.companyName)
          requireCorporateFeed(JSON.stringify(closing) === JSON.stringify(nativeBoards[index].nativePayload),
            'Corporate native closing role inventory changed')
          nativeBoards[index].closingNativePayloadSHA256 = corporateFeedHash(JSON.stringify(closing))
        }
        const closingCorporate = await reader.readPage(config.companyCareerPage)
        requireCorporatePublisher(closingCorporate.html, config.companyName)
        const closingFeeds = await config.discover(closingCorporate, reader)
        requireCorporateFeed(JSON.stringify(feeds) === JSON.stringify(closingFeeds), 'Corporate closing native feed declarations changed')
        nativeScopeComplete = true
        for (const board of nativeBoards) board.closingCorporatePageSHA256 = closingCorporate.bodySHA256
      } catch (error) {
        reader.signal.throwIfAborted()
        failures.push({ stage: 'closing-native-scope', message: error.message })
      }
    }
  } catch (error) {
    reader.signal.throwIfAborted()
    error.nativeCollectionEvidence = { source: config.source, nativeBoards, receipts: reader.receipts, failures,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false }
    throw error
  }
  const unique = [...new Map(jobs.map(job => [job.applyUrl, job])).values()]
  return attachCorporateFeedResult(unique, { source: config.source, surface: config.companyCareerPage, nativeBoards, reader, failures, nativeScopeComplete })
}
