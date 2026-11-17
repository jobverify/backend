import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
const fixture=name=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url))))
const api=fixture('hard-openai-current-20261116.json.gz').packets[0]
const detail=fixture('openai-current-empty-title-originals.json.gz').packets[0]
const raw=p=>Buffer.from(p.bodyBase64,'base64')
const inventory=JSON.parse(raw(api)),id='1ae64ddb-505f-4ad2-a731-3a857e94edee'
test('actual listed native row has an empty title and explicit US country, with no duplicate ID ambiguity',()=>{
 for(const p of [api,detail])assert.equal(createHash('sha256').update(raw(p)).digest('hex'),p.sha256)
 assert.equal(inventory.jobs.length,833);assert.equal(new Set(inventory.jobs.map(j=>j.id)).size,833)
 const invalid=inventory.jobs.filter(j=>typeof j.title!=='string'||!j.title.trim());assert.equal(invalid.length,1)
 const row=invalid[0];assert.equal(row.id,id);assert.equal(row.title,'');assert.equal(row.isListed,true)
 assert.equal(row.address.postalAddress.addressCountry,'United States')
 const html=raw(detail).toString('utf8'),schema=JSON.parse(html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1])
 assert.equal(schema.identifier.value,id);assert.equal(schema.title,'');assert.equal(schema.hiringOrganization.name,'OpenAI')
 assert.equal(schema.jobLocation.address.addressCountry,'United States');assert.match(html,/<title> @ OpenAI<\/title>/)
})
test('default source keeps malformed native inventory as failure rather than silently removing its foreign row',async()=>{
 let reads=0
 await assert.rejects(run({fetchJson:async url=>{reads++;assert.equal(url,api.requestedURL);return structuredClone(inventory)}}),/Invalid ashby inventory: missing title/)
 assert.equal(reads,1)
})
