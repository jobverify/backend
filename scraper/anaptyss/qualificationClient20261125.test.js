import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/qualification-client-20261125.json.gz',import.meta.url))))
const legacy=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261113.json.gz',import.meta.url))))
const client='https://www.anaptyss.com/_next/static/chunks/05sfgikk--cx9.js'
const legacyClient='https://www.anaptyss.com/_next/static/chunks/1sr4oigy47isl.js'
const affected='https://www.anaptyss.com/job-post/servicenow-developer'
const packetText=packet=>Buffer.from(packet.bodyBase64,'base64').toString('utf8')
const replay=(change=()=>{},options={})=>{
 const visits=new Map(),calls=[]
 return{calls,promise:run({...options,now:()=>fixture.capturedAt,fetchPage:async(url,init)=>{
  const candidates=fixture.packets.filter(packet=>packet.url===url)
  if(!candidates.length&&url===legacyClient){
   const original=legacy.find(packet=>packet.requestedUrl===url)
   candidates.push({status:original.status,finalURL:original.url,bodyBase64:Buffer.from(original.html).toString('base64')})
  }
  assert.ok(candidates.length,'Only actual publisher-declared captured public GET URLs: '+url)
  const visit=(visits.get(url)||0)+1;visits.set(url,visit);calls.push(url)
  const original=candidates[Math.min(visit-1,candidates.length-1)]
  const page={status:original.status,url:original.finalURL,html:packetText(original)}
  change(page,url,visit,init)
  return page
 }})}
}

test('Anaptyss current qualification fixture preserves all63 complete native HTTP originals and exact reviewed client hash',()=>{
 assert.equal(fixture.packets.length,63)
 for(const packet of fixture.packets){
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(bytes.length,packet.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
  assert.equal(packet.status,200)
 }
 assert.equal(fixture.packets.find(packet=>packet.url===client).bodySHA256,'2c846a0f327be9322c3f0b65b4b8d0cf026278eafce8886b7bfe2358b126a979')
})

test('Anaptyss current public qualification activation module remains byte-identical to the previously reviewed module',()=>{
 const oldText=legacy.find(packet=>packet.requestedUrl.endsWith('/1sr4oigy47isl.js')).html,newText=packetText(fixture.packets.find(packet=>packet.url===client))
 const activation=source=>{
  const elements=parse(source,{ecmaVersion:'latest'}).body[0].expression.arguments[0].elements
  const index=elements.findIndex(node=>node.type==='Literal'&&node.value===51116)
  assert.ok(index>0)
  return source.slice(elements[index+1].start,elements[index+1].end)
 }
 assert.equal(activation(newText),activation(oldText))
 assert.equal(createHash('sha256').update(activation(newText)).digest('hex'),'2c371219205303ab0b7acb84aab84d6fcbdf08ef9575f36e21454c9e10e6f5e9')
})

test('Anaptyss current27 declared roles recover explicit India country and every public qualification panel with company cleanup held',async()=>{
 const {calls,promise}=replay(),jobs=await promise
 assert.equal(jobs.length,27)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete===true&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(job=>/Educational Qualification/.test(job.jobDescription)&&/Experience/.test(job.jobDescription)&&/Skills/.test(job.jobDescription)))
 assert.equal(readInventoryEvidence(jobs).reportedTotal,27)
 assert.equal(jobs.nativeCollectionEvidence.failures.length,0)
 assert.equal(jobs.nativeCollectionEvidence.sourceCompanyWideScopeComplete,false)
 assert.equal(calls.filter(url=>url===client).length,2)
})

for(const phase of ['opening','closing'])test('Anaptyss altered current '+phase+' qualification client cannot publish unchanged-looking hidden panels',async()=>{
 await assert.rejects(replay((page,url,visit)=>{
  if(url===client&&visit===(phase==='opening'?1:2)){
   const original=page.html;page.html=original.replace('onClick:()=>i(l)','onClick:()=>i(0)');assert.notEqual(page.html,original)
  }
 }).promise,/tab.*client.*contract/i)
})

test('Anaptyss unknown declared tab client retains observations without certifying an empty India inventory',async()=>{
 const jobs=await replay((page,url)=>{if(url.includes('/job-post/'))page.html=page.html.replaceAll('05sfgikk--cx9.js','unknown-qualification.js')}).promise
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,27)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.sourceCompanyWideScopeComplete,false)
 assert.ok(jobs.nativeCollectionEvidence.failures.length>0)
})

test('Anaptyss reviewed client cannot qualify a contradictory country on an independently held role',async()=>{
 const jobs=await replay((page,url)=>{if(url===affected)page.html=page.html.replace('<dt>Country</dt><dd>India</dd>','<dt>Country</dt><dd>United Kingdom</dd>')}).promise
 assert.equal(jobs.length,26)
 assert.ok(!jobs.some(job=>job.sourceUrl===affected))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
})

test('Anaptyss reviewed client cannot expand an unbound qualification panel for one current role',async()=>{
 const jobs=await replay((page,url)=>{if(url===affected){const original=page.html;page.html=original.replace(/aria-controls="[^"]+-p1"/,'aria-controls="unbound-panel"');assert.notEqual(page.html,original)}}).promise
 assert.equal(jobs.length,26)
 assert.ok(!jobs.some(job=>job.sourceUrl===affected))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Anaptyss current qualification client cancellation preserves the caller reason and stops subsequent reads',async()=>{
 const controller=new AbortController(),reason={cancelled:'current-qualification-client'}
 const {calls,promise}=replay((_page,url)=>{if(url===client)controller.abort(reason)},{signal:controller.signal})
 await assert.rejects(promise,error=>error===reason)
 assert.equal(calls.at(-1),client)
})

test('Anaptyss a second reviewed client in one phase is fetched and checked independently of its peer',async()=>{
 const {calls,promise}=replay((page,url)=>{
  if(url===affected)page.html=page.html.replaceAll('05sfgikk--cx9.js','1sr4oigy47isl.js')
  if(url===legacyClient){const original=page.html;page.html=original.replace('onClick:()=>i(l)','onClick:()=>i(0)');assert.notEqual(page.html,original)}
 })
 await assert.rejects(promise,/tab.*client.*contract/i)
 assert.ok(calls.includes(client))
 assert.equal(calls.at(-1),legacyClient)
})
