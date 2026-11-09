import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const load = name => { try { return JSON.parse(readFileSync(new URL('./fixtures/' + name, import.meta.url))) } catch { return JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/' + name + '.gz', import.meta.url)))) } }
export const replay = (change = () => {}) => {
 const official=load('official-responses.json'), initial=load('initial-native-responses.json'), pages=load('listing-responses.json'), details=load('detail-responses.json')
 const state={official,initial,pages,details}; change(state)
 return {fetchPage:async url=>{const r=[...official,...initial].find(r=>r.url===url); assert.ok(r,url); return {url:r.finalUrl,status:r.status,html:r.responseBody??r.body}},fetchJson:async (url,options)=>{const r=url.endsWith('/jobs')?pages.find(r=>r.requestBody.offset===JSON.parse(options.body).offset):details.find(r=>r.url===url);assert.ok(r,url);return JSON.parse(r.body)}}
}
