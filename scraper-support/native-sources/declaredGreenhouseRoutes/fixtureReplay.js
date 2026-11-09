import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
export const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
const entities = new Map(fixture.entities.map(entity => [entity.receipt.url, entity]))
export const replay = (mutate = (_url, page) => page) => {
  const audits = [], records = [], requests = [], visits = new Map()
  const fetchPage = async url => {
    requests.push(url)
    const entity = entities.get(url)
    assert.ok(entity, 'No unretained URLs, network, page execution, forms or applications: ' + url)
    const visit = (visits.get(url) || 0) + 1;visits.set(url, visit)
    return mutate(url, { url, status: entity.receipt.status, headers: entity.receipt.headers, bodyBase64: entity.bodyBase64 }, visit)
  }
  const fetchText = async url => Buffer.from((await fetchPage(url)).bodyBase64, 'base64').toString('utf8')
  const fetchJson = async url => JSON.parse(await fetchText(url))
  return { audits, records, requests, options: { fetchPage, fetchText, fetchJson,
    onAudit: async audit => { audits.push(audit) }, onRecords: async all => { records.push(all) }, now: () => '2026-10-31T20:15:00.000Z' } }
}
export const editHTML = (page, change) => ({ ...page, bodyBase64: Buffer.from(change(Buffer.from(page.bodyBase64, 'base64').toString('utf8'))).toString('base64') })
export const editJSON = (page, change) => editHTML(page, raw => { const value = JSON.parse(raw);change(value);return JSON.stringify(value) })
