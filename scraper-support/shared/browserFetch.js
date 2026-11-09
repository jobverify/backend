import http from 'node:http'
import https from 'node:https'
import { setTimeout as sleep } from 'node:timers/promises'

import { composeAbortSignals } from '../utils/fetch.js'

const DEFAULT_BROWSER_TIMEOUT_MS = 60000

const TEXT_CONTENT_TYPE_PATTERN = /(?:javascript|json|text\/plain|xml)/i
const PDF_CONTENT_TYPE_PATTERN = /application\/pdf/i
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 5
const CERTIFICATE_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
])

const checkAbort = ({ callerSignal, signal }) => {
  callerSignal?.throwIfAborted()
  signal?.throwIfAborted()
}
const checkedRead = async (operation, context) => {
  checkAbort(context)
  try {
    const value = await operation()
    checkAbort(context)
    return value
  } catch (error) {
    checkAbort(context)
    throw error
  }
}

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || typeof AbortSignal?.timeout !== 'function') {
    return undefined
  }

  return AbortSignal.timeout(timeoutMs)
}

const buildHeaders = (userAgent, headers = {}, referer = null) => {
  const mergedHeaders = {
    ...(userAgent ? { 'User-Agent': userAgent } : {}),
    ...headers,
  }

  if (referer) {
    mergedHeaders.Referer = referer
  }

  return mergedHeaders
}

const buildHeaderReader = (headers = {}) => {
  const normalized = new Map(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value]),
  )

  return {
    get(name) {
      const value = normalized.get(String(name ?? '').toLowerCase())
      if (Array.isArray(value)) return value.join(', ')
      return value == null ? null : String(value)
    },
  }
}

const createResponseLike = ({ status, url, headers = {}, body = Buffer.alloc(0) }) => ({
  ok: status >= 200 && status < 300,
  status,
  url,
  headers: buildHeaderReader(headers),
  text: async () => body.toString('utf8'),
  arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
})

const isCertificateVerificationFailure = (error) => {
  const code = String(error?.code ?? error?.cause?.code ?? '').trim()
  const message = String(error?.message ?? error?.cause?.message ?? error ?? '').trim()

  return CERTIFICATE_ERROR_CODES.has(code)
    || /unable to verify the first certificate|self[- ]signed certificate|unable to get local issuer certificate|certificate has expired|certificate(?:'s)? altnames/i.test(message)
}

const shouldUseInsecureHttpsFallback = (url, error, ignoreHTTPSErrors) => {
  try {
    if (new URL(url).protocol !== 'https:') {
      return false
    }
  } catch {
    return false
  }

  return false
}

const serializeRequestBody = (body) => {
  if (body == null) return null
  if (Buffer.isBuffer(body)) return body
  if (body instanceof URLSearchParams) return Buffer.from(body.toString())
  if (typeof body === 'string') return Buffer.from(body)
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength)
  if (body instanceof ArrayBuffer) return Buffer.from(body)

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const params = new URLSearchParams()
    for (const [key, value] of body.entries()) {
      params.append(key, String(value))
    }
    return Buffer.from(params.toString())
  }

  return Buffer.from(String(body))
}

const requestWithInsecureHttps = (url, {
  method = 'GET',
  headers = {},
  body = null,
  timeoutMs = DEFAULT_BROWSER_TIMEOUT_MS,
} = {}, redirectCount = 0) => new Promise((resolve, reject) => {
  const targetUrl = new URL(url)
  const transport = targetUrl.protocol === 'http:' ? http : https
  const requestHeaders = { ...headers }
  const serializedBody = serializeRequestBody(body)

  if (serializedBody != null) {
    if (!Object.keys(requestHeaders).some((key) => key.toLowerCase() === 'content-length')) {
      requestHeaders['Content-Length'] = String(serializedBody.byteLength)
    }
    if (
      typeof FormData !== 'undefined'
      && body instanceof FormData
      && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === 'content-type')
    ) {
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
    }
  }

  const request = transport.request(targetUrl, {
    method,
    headers: requestHeaders,
    rejectUnauthorized: true,
  }, (response) => {
    const chunks = []

    response.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })

    response.on('end', async () => {
      const responseBody = Buffer.concat(chunks)
      const location = response.headers.location
      const status = Number(response.statusCode || 0)

      if (
        location
        && REDIRECT_STATUSES.has(status)
        && redirectCount < MAX_REDIRECTS
      ) {
        try {
          const redirectUrl = new URL(location, targetUrl).toString()
          const redirectMethod = status === 303 ? 'GET' : method
          const redirectHeaders = { ...requestHeaders }
          let redirectBody = serializedBody

          if (status === 303) {
            redirectBody = null
            for (const key of Object.keys(redirectHeaders)) {
              if (/^content-(?:length|type)$/i.test(key)) {
                delete redirectHeaders[key]
              }
            }
          }

          resolve(await requestWithInsecureHttps(redirectUrl, {
            method: redirectMethod,
            headers: redirectHeaders,
            body: redirectBody,
            timeoutMs,
          }, redirectCount + 1))
          return
        } catch (error) {
          reject(error)
          return
        }
      }

      resolve(createResponseLike({
        status,
        url: targetUrl.toString(),
        headers: response.headers,
        body: responseBody,
      }))
    })
  })

  request.setTimeout(timeoutMs, () => {
    request.destroy(new Error(`Request timed out after ${timeoutMs}ms for ${url}`))
  })

  request.on('error', reject)

  if (serializedBody != null) {
    request.write(serializedBody)
  }

  request.end()
})

const readResponseContent = async (response, {
  pdfTextExtractionTimeoutMs = DEFAULT_BROWSER_TIMEOUT_MS,
  signal,
  callerSignal,
} = {}) => {
  const context = { signal, callerSignal }
  checkAbort(context)
  const contentType = response.headers?.get?.('content-type') || ''
  const responseUrl = response.url || ''

  if (TEXT_CONTENT_TYPE_PATTERN.test(contentType)) {
    return checkedRead(() => response.text(), context)
  }

  if (PDF_CONTENT_TYPE_PATTERN.test(contentType) || /\.pdf(?:$|\?)/i.test(responseUrl)) {
    try {
      const bytes = await checkedRead(() => response.arrayBuffer(), context)
      return await checkedRead(async () => {
        // HTML/JSON sources do not require the PDF renderer's native addons.
        const { extractTextFromPdfBuffer } = await import('./pdfText.js')
        checkAbort(context)
        return extractTextFromPdfBuffer(new Uint8Array(bytes), { timeoutMs: pdfTextExtractionTimeoutMs, signal })
      }, context)
    } catch {
      checkAbort(context)
      return ''
    }
  }

  return checkedRead(() => response.text(), context)
}

export const createBrowserFetchSession = async ({
  userAgent = null,
  timeoutMs = DEFAULT_BROWSER_TIMEOUT_MS,
  waitUntil = 'domcontentloaded',
  settleTimeMs = 0,
  ignoreHTTPSErrors = false,
  signal,
} = {}) => {
  signal?.throwIfAborted()
  const request = async (url, options = {}) => {
    const callerSignal = composeAbortSignals(signal, options.signal)
    callerSignal?.throwIfAborted()
    const requestSignal = composeAbortSignals(callerSignal, createTimeoutSignal(timeoutMs))
    const context = { callerSignal, signal: requestSignal }
    const method = options.method || 'GET'
    const headers = buildHeaders(userAgent, options.headers, options.referer)
    const requestOptions = {
      method,
      headers,
      ...(options.body != null ? { body: options.body } : {}),
      signal: requestSignal,
    }
    let response

    return checkedRead(async () => {
      try {
        response = await fetch(url, requestOptions)
      } catch (error) {
        checkAbort(context)
        if (!shouldUseInsecureHttpsFallback(url, error, ignoreHTTPSErrors)) {
          throw error
        }

        response = await requestWithInsecureHttps(url, {
          method,
          headers,
          body: options.body,
          timeoutMs,
        })
      }
      checkAbort(context)
      if (settleTimeMs > 0) await sleep(settleTimeMs, undefined, { signal: requestSignal })
      return { response, ...context }
    }, context)
  }

  return {
    close: async () => {},
    fetchText: async (url, options = {}) => {
      const context = await request(url, options), { response } = context
      return checkedRead(async () => {
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
        return readResponseContent(response, { ...context, pdfTextExtractionTimeoutMs: timeoutMs })
      }, context)
    },
    fetchPage: async (url, options = {}) => {
      const context = await request(url, options), { response } = context
      return checkedRead(async () => ({
        status: response.status, url: response.url,
        html: await readResponseContent(response, { ...context, pdfTextExtractionTimeoutMs: timeoutMs }),
      }), context)
    },
    fetchFinalUrl: async (url, options = {}) => {
      const context = await request(url, options), { response } = context
      return checkedRead(async () => {
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
        return response.url || url
      }, context)
    },
    fetchJson: async (url, options = {}) => {
      if (options.landingUrl) {
        const landing = await request(options.landingUrl, options)
        await checkedRead(async () => {
          if (!landing.response.ok) throw new Error(`HTTP ${landing.response.status} for ${options.landingUrl}`)
        }, landing)
      }

      const context = await request(url, options), { response } = context
      return checkedRead(async () => {
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
        const text = await checkedRead(() => response.text(), context)
        try { return JSON.parse(text) }
        catch (error) { throw new Error(`Expected JSON from ${url} but received an invalid API payload`, { cause: error }) }
      }, context)
    },
  }
}
