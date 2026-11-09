import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
export const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
const entities = new Map(fixture.entities.map(entity => [entity.receipt.url, entity]))
export const replay = (mutate = (url, page) => page) => {
  const audits = [], requests = [], visits = new Map()
  const fetchPage = async url => {
    requests.push(url)
    const entity = entities.get(url)
    assert.ok(entity, 'Only original current public URLs may be replayed: ' + url)
    const visit = (visits.get(url) || 0) + 1;visits.set(url, visit)
    return await mutate(url, { url, status: entity.receipt.status, headers: entity.receipt.headers, bodyBase64: entity.bodyBase64 }, visit)
  }
  const fetchImpl = async url => {
    const page = await fetchPage(String(url)), response = new Response(Buffer.from(page.bodyBase64, 'base64'), { status: page.status, headers: page.headers })
    Object.defineProperty(response, 'url', { value: page.url });return response
  }
  const fetchText = async url => Buffer.from((await fetchPage(url)).bodyBase64, 'base64').toString('utf8')
  const fetchJson = async url => JSON.parse(await fetchText(url))
  return { audits, requests, options: { fetchPage, fetchImpl, fetchText, fetchJson, onAudit: async audit => audits.push(audit), now: () => '2026-10-31T13:00:00.000Z' } }
}

