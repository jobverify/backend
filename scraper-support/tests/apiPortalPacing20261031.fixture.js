import { readFileSync } from 'node:fs'
import { buildHttpError } from '../utils/fetch.js'

const input = JSON.parse(readFileSync(new URL('../apiPortal/test-data/api-pacing-20261031.json', import.meta.url), 'utf8'))
export const pacingProvider = (rateLimit, { detail = true } = {}) => {
  const provider = structuredClone(input.provider)
  provider.config.detail.enabled = detail
  if (rateLimit !== undefined) provider.config.rateLimit = rateLimit
  return provider
}
export const pacingPayload = url => {
  const endpoint = new URL(url)
  if (endpoint.pathname === '/api/jobs') return structuredClone(input.listing)
  const id = /^\/api\/job\/(one|two|three)$/.exec(endpoint.pathname)?.[1]
  const record = input.listing.jobs.find(record => record.id === id)
  if (!record) throw Error('Unexpected pacing fixture URL: ' + url)
  return structuredClone(record)
}
export const pacingHttpError = (url, status = 429, retryAfter = '0') => buildHttpError(new Response(null, {
  status, headers: retryAfter == null ? {} : { 'Retry-After': retryAfter },
}), url)
