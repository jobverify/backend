import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {parse} from 'acorn'
import {buildMicronTechnologyIndiaApiProvider,PROVIDER_METADATA,buildListingApiUrl,buildDetailApiUrl} from '../../scraper/microntechnologyindia/script.js'
import {runApiPortalScraper} from '../apiPortal/engine.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

// Read the existing literal without running its test module or upstream code.
const ast=parse(readFileSync(new URL('./micronTechnologyIndiaScript.test.js',import.meta.url),'utf8'),{sourceType:'module',ecmaVersion:'latest'})
const node=ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations).find(n=>n.id.name==='SEARCH_PAYLOAD').init
const read=n=>n.type==='Literal'?n.value:n.type==='ArrayExpression'?n.elements.map(read):n.type==='ObjectExpression'?Object.fromEntries(n.properties.map(p=>[p.key.name??p.key.value,read(p.value)])):(()=>{throw Error('Unsupported existing static fixture')})()
const original=read(node)
test('Micron builder forwards its declared Eightfold type without qualifying the missing original descriptions',async()=>{
 const provider=buildMicronTechnologyIndiaApiProvider(),untouched=structuredClone(original),requests=[]
 assert.equal(PROVIDER_METADATA.atsPlatform,'eightfold')
 assert.equal(provider.atsPlatform,PROVIDER_METADATA.atsPlatform)
 // Original listing bytes remain exact. Detail unavailability is a controlled
 // injected failure, not evidence that native details are absent or disabled.
 const jobs=await runApiPortalScraper({provider,fetchJson:async url=>{
  requests.push(url)
  if(url===buildListingApiUrl())return structuredClone(original)
  assert.ok(original.data.positions.some(row=>url===buildDetailApiUrl(row.id)))
  throw new Error('Controlled optional Micron detail unavailable')
 }})
 assert.equal(requests.length,3);assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,original.data.positions[0].id)
 assert.equal(jobs[0].location,original.data.positions[0].locations[0])
 assert.equal(jobs[0].postingDate,original.data.positions[0].postedTs)
 assert.ok(jobs[0].jobDescription==null,'the injected unavailable detail cannot supply a description')
 assert.equal(jobs[0].sourceListingComplete,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.deepEqual(original,untouched)
})
test('Micron typed configuration still rejects nonempty upstream error envelopes without another read',async()=>{
 const provider=buildMicronTechnologyIndiaApiProvider(),payload=structuredClone(original)
 payload.error.message='controlled upstream denial'
 let calls=0
 await assert.rejects(runApiPortalScraper({provider,fetchJson:async()=>{calls++;return payload}}),/upstream error/)
 assert.equal(calls,1)
})
