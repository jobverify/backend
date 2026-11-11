import https from 'node:https'
import {INDIA_URL, CLIENT_URL, CORE_URL, ORIGIN, attListingUrl} from './nativeContract.js'

const error = message => Error('AT&T native: ' + message)
const permanentTlsCodes = new Set(['CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_NOT_YET_VALID'])
function permanentTlsCode(failure) {
  const queue = [failure]
  const seen = new Set()
  while (queue.length) {
    const current = queue.shift()
    if (!current || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)
    if (permanentTlsCodes.has(current.code)) return current.code
    if (current.cause) queue.push(current.cause)
    if (Array.isArray(current.errors)) queue.push(...current.errors)
  }
  return null
}
function allowedUrl(value) {
  let url
  try { url = new URL(value) } catch { throw error('Native HTTP URL malformed') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) throw error('Native HTTP URL unsafe')
  if ([INDIA_URL, CLIENT_URL, CORE_URL].includes(value)) return
  if (url.origin !== ORIGIN) throw error('Native HTTP host outside source scope')
  if (!url.search && /^\/job\/[^/]+\/[^/]+\/117\/[1-9]\d*$/.test(url.pathname)) return
  if (url.pathname === '/search-jobs/results') {
    const page = Number(url.searchParams.get('CurrentPage'))
    const total = Number(url.searchParams.get('FacetFilters[0].Count'))
    if (attListingUrl(page, total) === value) return
  }
  throw error('Native HTTP URL/path/query outside source scope')
}

export async function getAttNative(url, options = {}) {
  const timeoutMs=options.timeoutMs??20000,started=Date.now()
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) throw error('Invalid request timeout bound')
  for(let attempt=0;attempt<2;attempt++){
    const remaining=timeoutMs-(Date.now()-started)
    if(remaining<1)throw error('Request timeout')
    try{return await getAttNativeAttempt(url,{...options,timeoutMs:remaining})}
    catch(failure){
      if(options.signal?.aborted)throw options.signal.reason
      if(attempt===1||failure?.code!=='ATT_NATIVE_BODY_ABORTED')throw failure
    }
  }
}

async function getAttNativeAttempt(url, {requestImpl = https.request, timeoutMs = 20000, signal} = {}) {
  allowedUrl(url)
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20000) throw error('Invalid request timeout bound')
  if (signal?.aborted) throw signal.reason
  const controller = new AbortController()
  const stop = () => controller.abort(signal.reason)
  signal?.addEventListener('abort', stop, {once: true})
  const timer = setTimeout(() => controller.abort(error('Request timeout')), timeoutMs)
  let request, response, abortListener
  try {
    return await new Promise((resolve, reject) => {
      let settled = false
      const disposed = new WeakSet()
      const ignoreLateError = () => {}
      const dispose = owned => {
        if (!owned || !['object', 'function'].includes(typeof owned) || disposed.has(owned)) return
        disposed.add(owned)
        // Disposal is best effort; terminal handle errors cannot replace the primary.
        try { owned.on('error', ignoreLateError) } catch {}
        try { owned.destroy() } catch {}
      }
      const fail = failure => {
        if (settled) return
        settled = true
        dispose(response)
        dispose(request)
        if (controller.signal.aborted) { reject(controller.signal.reason); return }
        const code = permanentTlsCode(failure)
        if (code) {
          const failureError = new Error('AT&T native: Native HTTP TLS ' + code, {cause: failure})
          Object.assign(failureError, {code, abortRetries: true})
          reject(failureError)
          return
        }
        // Unknown implementation failures remain the original thrown value;
        // source transport errors cannot conceal programmer errors or causes.
        reject(failure)
      }
      abortListener = () => fail(controller.signal.reason)
      controller.signal.addEventListener('abort', abortListener, {once: true})
      try {
        request = requestImpl(url, {
          method: 'GET', maxHeaderSize: 65536, signal: controller.signal,
          headers: {Accept: 'text/html,application/javascript,application/json', 'User-Agent': 'Mozilla/5.0'},
        }, incoming => {
          if (settled) { dispose(incoming); return }
          response = incoming
          if (incoming.statusCode !== 200 || incoming.headers.location) {
            const statusError = error('Native HTTP status/redirect unavailable: ' + incoming.statusCode)
            statusError.status = incoming.statusCode
            statusError.requestUrl = url
            if ([202, 401, 403, 429, 451].includes(incoming.statusCode)) {
              Object.assign(statusError, {softFailure: true, upstreamOutage: false, failureKind: 'blocked_or_access_denied', abortRetries: true})
            }
            fail(statusError)
            return
          }
          const contentType = incoming.headers['content-type']
          if (typeof contentType !== 'string' || !/^(?:text\/(?:html|javascript)|application\/(?:json|(?:x-)?javascript))(?:\s*;|$)/i.test(contentType)) {
            fail(error('Native HTTP body MIME unavailable'))
            return
          }
          const chunks = []
          let size = 0
          incoming.on('data', chunk => {
            if (settled) return
            size += chunk.length
            if (size > 2097152) { fail(error('Native HTTP body exceeds 2MiB bound')); return }
            chunks.push(chunk)
          })
          incoming.once('error', fail)
          incoming.once('aborted', () => fail(Object.assign(error('Native HTTP body aborted'),{code:'ATT_NATIVE_BODY_ABORTED',requestUrl:url})))
          incoming.once('end', () => {
            if (settled) return
            let body
            try { body = new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)) }
            catch { fail(error('Native HTTP body has invalid UTF-8')); return }
            if (!body.trim()) { fail(error('Native HTTP body empty')); return }
            settled = true
            resolve({body, url, status: 200, contentType})
          })
        })
        if (settled) { dispose(request); return }
        request.once('error', fail)
        if (!settled) request.end()
      } catch (failure) { fail(failure) }
    })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', stop)
    if (abortListener) controller.signal.removeEventListener('abort', abortListener)
  }
}
