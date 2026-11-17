import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../utils/activeNativeHtml.js'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/ats-followup-20261107/payoda.json.gz',import.meta.url))))
for(const row of [fixture.careers,...fixture.provenance])assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)

test('Payoda November7 originals have five native city-only buttons without role-country proof',()=>{
 const document=readNativeDocument(fixture.careers.body)
 const buttons=document.nodes(node=>node.tag==='button'&&document.hasClass(node,'role-toggle'))
 assert.equal(buttons.length,5)
 assert.equal(new Set(buttons.map(node=>node.attrs['aria-controls'])).size,5)
 assert.ok(buttons.every(node=>/Bengaluru/.test(document.text(node))&&node.attrs['aria-expanded']==='false'))
 const program=fixture.provenance.find(row=>row.requestUrl.endsWith('.js'))
 assert.ok(document.nodes(node=>node.tag==='script'&&node.attrs.src==='/_next/static/chunks/0fg64yqkli8uf.js').length===1)
 assert.match(program.body,/onClick:\(\)=>t\(i\?-1:n\)/)
 assert.match(program.body,/inert:!i/)
 const contact=fixture.provenance.find(row=>row.requestUrl.endsWith('/contact'))
 const offices=readNativeDocument(contact.body),text=offices.text(offices.nodes(node=>node.tag==='root')[0])
 assert.match(text,/Coimbatore/)
 assert.match(text,/Chennai/)
 assert.doesNotMatch(text,/Bengaluru|Bangalore/i)
 assert.doesNotMatch(fixture.careers.body,/\bIndia\b/i)
})


function currentNativeReplay(source,change=()=>{}){
 const captures=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/'+source+'/fixtures/current-native-20261117.json.gz',import.meta.url)))),calls=[],seen=new Map()
 return{calls,fetchImpl:async(url,init)=>{
  const original=captures.find(row=>row.requestedUrl===url);assert.ok(original,'Unbound current native URL '+url)
  assert.equal(init.method??'GET','GET');assert.equal(init.redirect,'manual');assert.ok(init.signal instanceof AbortSignal)
  const nth=(seen.get(url)||0)+1;seen.set(url,nth);calls.push({url,nth})
  const row={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString()};change(row,url,nth)
  const response=new Response(row.body,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
 }}
}

const registeredPayoda=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='payoda'))
test('registered Payoda reconciles current source originals while preserving unknown country and company inventory',async()=>{
 const transport=currentNativeReplay('payoda'),jobs=await registeredPayoda().run({fetchImpl:transport.fetchImpl})
 assert.equal(jobs.length,0);assert.equal(transport.calls.length,10)
 assert.equal(readSourceObservationEvidence(jobs,'payoda').observedVacancyCount,5)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.wholeCareerOwnedModelClosingReconciled,true)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null);assert.equal(jobs.nativeCollectionEvidence.companyIndiaZeroProven,false)
})
test('registered Payoda rejects a different original response employer authority',async()=>{
 const transport=currentNativeReplay('payoda',row=>{row.url='https://other.example/careers'})
 await assert.rejects(registeredPayoda().run({fetchImpl:transport.fetchImpl}),/original.*URL|authority/i)
 assert.equal(transport.calls.length,1)
})
test('registered Payoda rejects a changed closing-only native eligibility criterion',async()=>{
 const transport=currentNativeReplay('payoda',(row,url,nth)=>{if(url.includes('/0~57~9h~3~4ms.js')&&nth===2){assert.ok(row.body.includes('Own the AI side'));row.body=row.body.replace('Own the AI side','New mandatory criterion. Own the AI side')}})
 await assert.rejects(registeredPayoda().run({fetchImpl:transport.fetchImpl}),/opening.*closing.*model changed/i)
 assert.equal(transport.calls.length,10)
})
for(const inflight of [false,true])test('registered Payoda preserves exact frozen opaque caller cancellation '+(inflight?'during native read':'before callbacks'),async()=>{
 const controller=new AbortController(),reason=Object.freeze({opaque:true,caller:'payoda',inflight});let reads=0
 if(!inflight)controller.abort(reason)
 await assert.rejects(registeredPayoda().run({signal:controller.signal,fetchImpl:async()=>{reads++;controller.abort(reason);throw Object.freeze(Error('Replacement transport failure'))}}),error=>error===reason)
 assert.equal(reads,inflight?1:0)
})
