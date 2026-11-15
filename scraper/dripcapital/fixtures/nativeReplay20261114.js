import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'

export const originalFixture = JSON.parse(gunzipSync(readFileSync(new URL('./dripcapital20261114-native.json.gz', import.meta.url))))
export const originalResponse = index => originalFixture.responses.find(row => row.index === index)
export const originalBody = index => Buffer.from(originalResponse(index).bodyBase64, 'base64')
export const responseFromOriginal = (receipt, body, {status = receipt.status, headers = receipt.headers, url = receipt.url, redirected = false} = {}) => {
  const response = new Response(body, {status, headers})
  Object.defineProperty(response, 'url', {value: url})
  Object.defineProperty(response, 'redirected', {value: redirected})
  return response
}
const sequence = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 6, 12, 1, 11]

// Every reply uses an original complete entity and original HTTP metadata.
// Repeated index6 is a fixture replay, not a second current live observation.
export const replayNative = ({mutate, beforeRead} = {}) => {
  const reads = []
  const fetchImpl = async (url, options = {}) => {
    const requestIndex = reads.length
    const receipt = originalResponse(sequence[requestIndex])
    if (!receipt || String(url) !== receipt.requestedUrl) throw new Error('No original Drip response for ' + String(url))
    reads.push({url: String(url), method: options.method, redirect: options.redirect, credentials: options.credentials})
    await beforeRead?.({url: String(url), options, requestIndex, receipt})
    const raw = originalBody(receipt.index)
    const replacement = await mutate?.({url: String(url), options, requestIndex, receipt, raw})
    if (replacement instanceof Response) return replacement
    return responseFromOriginal(receipt, replacement ?? raw)
  }
  return {fetchImpl, reads}
}
