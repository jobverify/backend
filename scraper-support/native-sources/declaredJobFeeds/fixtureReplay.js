import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readNativeDocument } from '../../utils/activeNativeHtml.js'
import { appData } from '../declaredAshby/nativeData.js'
export const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
const entities = new Map(fixture.entities.map(entity => [entity.receipt.url, entity]))
export const replay = (mutate = (url, page) => page) => {
  const audits = [], records = [], requests = [], visits = new Map()
  const fetchPage = async url => {
    requests.push(url)
    const entity = entities.get(url)
    assert.ok(entity, 'No unretained GETs, network, applications or website execution: ' + url)
    const visit = (visits.get(url) || 0) + 1;visits.set(url, visit)
    return mutate(url, { url, status: entity.receipt.status, headers: entity.receipt.headers, bodyBase64: entity.bodyBase64 }, visit)
  }
  const fetchImpl = async url => {
    const page = await fetchPage(String(url)), response = new Response(Buffer.from(page.bodyBase64, 'base64'), { status: page.status, headers: page.headers })
    Object.defineProperty(response, 'url', { value: page.url });return response
  }
  const fetchText = async url => Buffer.from((await fetchPage(url)).bodyBase64, 'base64').toString('utf8')
  const fetchJson = async url => JSON.parse(await fetchText(url))
  return { audits, records, requests, options: { fetchPage, fetchImpl, fetchText, fetchJson,
    onAudit: async audit => audits.push(audit), onRecords: async all => records.push(all), now: () => '2026-10-31T15:30:00.000Z' } }
}
export const mutateJSON = (page, change) => {
  const value = JSON.parse(Buffer.from(page.bodyBase64, 'base64').toString('utf8'))
  change(value)
  return { ...page, bodyBase64: Buffer.from(JSON.stringify(value)).toString('base64') }
}
// Synthetic boundary edits are test data only, never original live evidence.
export const mutateHTML = (page, change) => {
  let html = Buffer.from(page.bodyBase64, 'base64').toString('utf8')
  const doc = readNativeDocument(html), scripts = doc.nodes(node => node.tag === 'script' && !node.attrs.src)
  const appScript = scripts.find(node => /^\s*window\.__appData\s*=/.test(node.raw || ''))
  const data = appScript ? appData(doc) : null
  const schemas = scripts.filter(node => node.attrs.type === 'application/ld+json').map(node => ({ node, value: JSON.parse(node.raw) }))
  change(data, schemas.map(item => item.value))
  if (appScript) html = html.replace(appScript.raw, 'window.__appData = ' + JSON.stringify(data).replaceAll('</script', '<\\/script') + ';')
  for (const schema of schemas) html = html.replace(schema.node.raw, JSON.stringify(schema.value).replaceAll('</script', '<\\/script'))
  return { ...page, bodyBase64: Buffer.from(html).toString('base64') }
}
