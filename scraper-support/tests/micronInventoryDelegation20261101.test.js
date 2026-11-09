import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {parse} from 'acorn'
import {runApiPortalScraper} from '../apiPortal/engine.js'
import {INVENTORY_EVIDENCE,readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {buildMicronTechnologyIndiaApiProvider,createMicronTechnologyIndiaScraper,OFFICIAL_CAREERS_URL,buildListingApiUrl,buildDetailApiUrl} from '../../scraper/microntechnologyindia/script.js'

const NOW='2026-08-04T00:00:00.000Z'
const requestClockNow=Date.now
const tree=parse(readFileSync(new URL('./micronTechnologyIndiaScript.test.js',import.meta.url),'utf8'),{sourceType:'module',ecmaVersion:'latest'})
const read=node=>node.type==='Literal'?node.value:node.type==='ArrayExpression'?node.elements.map(read):node.type==='ObjectExpression'?Object.fromEntries(node.properties.map(p=>[p.key.name??p.key.value,read(p.value)])):node.type==='TemplateLiteral'&&!node.expressions.length?node.quasis[0].value.cooked:(()=>{throw Error('Unsupported original static fixture')})()
const fixture=name=>read(tree.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations).find(n=>n.id.name===name).init)
const original=fixture('SEARCH_PAYLOAD'),official=fixture('OFFICIAL_CAREERS_HTML')
const transport=()=>{
 const requests=[],payloads=[]
 return {requests,fetchText:async url=>{requests.push(url);assert.equal(url,OFFICIAL_CAREERS_URL);return official},fetchJson:async url=>{
  requests.push(url)
  if(url!==buildListingApiUrl()){
   assert.ok(original.data.positions.some(row=>url===buildDetailApiUrl(row.id)))
   throw new Error('Controlled optional Micron detail unavailable')
  }
  const value=structuredClone(original);payloads.push([value,structuredClone(value)]);return value
 },assertUnchanged:()=>{for(const [value,copy] of payloads)assert.deepEqual(value,copy)}}
}
const checkPartial=jobs=>{
 assert.equal(jobs.length,1)
 const evidence=readInventoryEvidence(jobs)
 assert.ok(evidence,'source mapping must retain the upstream inventory carrier')
 assert.equal(evidence.status,'discovery-only');assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,original.data.count);assert.equal(evidence.pagesFetched,1)
 assert.equal(evidence.verifiedAt,NOW)
 assert.equal(Object.getOwnPropertyDescriptor(jobs,INVENTORY_EVIDENCE).enumerable,false)
 assert.equal(jobs[0].jobId,original.data.positions[0].id)
 assert.equal(jobs[0].requisitionId,original.data.positions[0].displayJobId)
 assert.equal(jobs[0].location,original.data.positions[0].locations[0])
 assert.equal(jobs[0].sourceListingComplete,false)
 assert.ok(jobs[0].jobDescription==null)
 assert.notEqual(jobs[0].sourceScopeComplete,true)
 assert.ok(jobs[0].sourceGlobalJobCount==null&&jobs[0].sourceIndiaJobCount==null)
 return evidence
}
test('Micron original native-format input produces partial nonenumerable evidence before source decoration',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(NOW).getTime()})
 // Freeze observation timestamps while request pacing retains an advancing clock.
 t.mock.method(Date,'now',requestClockNow)
 const input=transport(),snapshot=structuredClone(original),jobs=await runApiPortalScraper({provider:buildMicronTechnologyIndiaApiProvider(),fetchJson:input.fetchJson})
 checkPartial(jobs);assert.equal(input.requests.length,3);input.assertUnchanged();assert.deepEqual(original,snapshot)
})
test('Micron source decoration preserves the full partial envelope and existing native role facts',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date(NOW).getTime()})
 t.mock.method(Date,'now',requestClockNow)
 const reference=transport(),upstream=await runApiPortalScraper({provider:buildMicronTechnologyIndiaApiProvider(),fetchJson:reference.fetchJson})
 const input=transport(),jobs=await createMicronTechnologyIndiaScraper().run(input)
 const evidence=checkPartial(jobs)
 assert.deepEqual(evidence,readInventoryEvidence(upstream),'all upstream diagnostics and its controlled observation clock must survive')
 for(const key of Reflect.ownKeys(upstream[0])){
  if(['postingDate','experienceRequired'].includes(key))continue // Existing source decoration, unchanged by this fix.
  assert.deepEqual(jobs[0][key],upstream[0][key],'original field '+String(key))
 }
 assert.equal(jobs[0].postingDate,'2026-06-09T00:00:00.000Z')
 assert.equal(jobs[0].experienceRequired,null);assert.equal(jobs[0].publicExperienceChecked,false)
 assert.equal(input.requests.length,4);reference.assertUnchanged();input.assertUnchanged()
})
