import http from 'node:http'
import https from 'node:https'

import { withRetry } from './retry.js'

const buildTimeoutError = (url, timeoutMs) => {
  const error = new Error(`Request timed out after ${timeoutMs}ms for ${url}`)
  error.code = 'ETIMEDOUT'
  return error
}

const buildRedirectError = (url, maxRedirects) => {
  const error = new Error(`Too many redirects for ${url}; exceeded ${maxRedirects}`)
  error.abortRetries = true
  return error
}

const requestPageOnce = (url, {
  headers = {},
  timeoutMs = 15000,
  maxRedirects = 5,
} = {}) => new Promise((resolve, reject) => {
  let urlObject

  try {
    urlObject = new URL(url)
  } catch (error) {
    error.abortRetries = true
    reject(error)
    return
  }

  const isHttps = urlObject.protocol === 'https:'
  const client = isHttps ? https : http
  const request = client.request(urlObject, {
    method: 'GET',
    headers: {
      'Accept-Encoding': 'identity',
      ...headers,
    },
    rejectUnauthorized: isHttps ? true : undefined,
  }, (response) => {
    const status = Number(response.statusCode || 0)
    const redirectLocation = response.headers.location

    if (
      redirectLocation
      && [301, 302, 303, 307, 308].includes(status)
    ) {
      if (maxRedirects <= 0) {
        response.resume()
        reject(buildRedirectError(urlObject.toString(), 0))
        return
      }

      const nextUrl = new URL(redirectLocation, urlObject).toString()
      response.resume()
      requestPageOnce(nextUrl, {
      headers,
      timeoutMs,
      maxRedirects: maxRedirects - 1,
    }).then(resolve, reject)
      return
    }

    const chunks = []

    response.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })

    response.on('end', () => {
      resolve({
        status,
        url: urlObject.toString(),
        headers: response.headers,
        html: Buffer.concat(chunks).toString('utf8'),
      })
    })
  })

  request.setTimeout(timeoutMs, () => {
    request.destroy(buildTimeoutError(urlObject.toString(), timeoutMs))
  })

  request.on('error', reject)
  request.end()
})

export const fetchPageWithRetry = async (url, {
  attempts = 3,
  baseDelayMs = 2000,
  timeoutMs = 15000,
  headers = {},
  label = 'fetch-page',
  maxRedirects = 5,
} = {}) => withRetry(async () => {
  try {
    return await requestPageOnce(url, {
      headers,
      timeoutMs,
      maxRedirects,
    })
  } catch (error) {
    throw error
  }
}, {
  attempts,
  baseDelayMs,
  label,
})

export default fetchPageWithRetry
