import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {profile,readListing,readShell} from './nativeContract20261111.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261117.json.gz',import.meta.url))))
const text=p=>Buffer.from(p.rawBodyBase64,'base64').toString('utf8'),saved=url=>text(fixture.responses.find(p=>p.url===url))
function replay(change=(_url,p)=>p){
 const requests=[],counts=new Map()
 const fetchImpl=async(url,init={})=>{
  url=String(url);init.signal?.throwIfAborted();assert.equal(init.method??'GET','GET')
  const index=counts.get(url)??0;counts.set(url,index+1);requests.push(url)
  const p=fixture.responses.filter(p=>p.url===url)[index];assert.ok(p,'Unexpected original read '+url+' #'+index)
  const packet=change(url,{...p,body:text(p)},index+1),response=new Response(packet.body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl});return response
 }
 return{fetchImpl,requests,counts}
}
test('current one-page capture preserves all54 original HTTP entities and complete closing models',()=>{
 assert.equal(fixture.responses.length,54);assert.equal(fixture.models.closingMatches,true)
 for(const p of fixture.responses){assert.equal(createHash('sha256').update(Buffer.from(p.rawBodyBase64,'base64')).digest('hex'),p.sha256);assert.equal(p.status,200);assert.equal(p.finalUrl,p.url)}
})
test('same current reviewed executable permits its explicitly declared one-page20role terminal cohort',()=>{
 const shell=readShell(saved(profile.shellURL)),page=readListing(saved(profile.frameURL),{maxPages:shell.listingPageLimit})
 assert.equal(shell.listingPageLimit,2);assert.equal(page.declaredPageCount,1);assert.equal(page.rows.length,20);assert.equal(page.nextURL,null)
})
test('registered current source reconciles all20 full criteria models and canonical observations while holding company scope',async()=>{
 let audit
 const provider=getScraperCatalog().find(p=>p.source==='lennoxinternational'),io=replay(),jobs=await createCatalogScraper(provider).run({fetchImpl:io.fetchImpl,softFailureRecovery:false,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,20);assert.equal(io.requests.length,54);assert.equal(audit.closingInventoryMatches,true)
 assert.equal(audit.listing.listingPageCount,1);assert.equal(audit.closingOwnModelsMatch,true)
 assert.ok(jobs.every(j=>j.country==='India'&&j.fullSourceDetailQualified&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.deepEqual(audit.nativeRecords,fixture.models.models)
 assert.equal(readSourceObservationEvidence(jobs,'lennoxinternational').observedRecordCount,20)
 assert.equal(readSourceObservationEvidence(jobs,'lennoxinternational').observedVacancyCount,20)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition(provider,jobs);assert.equal(assessment.runnerOutcome.success,true);assert.equal(assessment.runnerOutcome.partial,true);assert.equal(assessment.cleanupOptions.replaceExisting,false)
})
for(const [name,extra]of[
 ['query-only continuation','<a href="?pr=1&amp;in_iframe=1&amp;searchLocation=13228--Chennai">Continue</a>'],
 ['foreign continuation','<a href="https://other.example/jobs">Open positions</a>'],
 ['head continuation','<link rel="next" href="?pr=1">'],
 ['empty hidden native pagination owner','<div class="iCIMS_Paginator_Bottom"></div>'],
])test('current single-page native model rejects '+name,()=>{
 assert.throws(()=>readListing(saved(profile.frameURL).replace('</body>',extra+'</body>'),{maxPages:2}),/pagination|navigation/)
})
test('a full20row single page does not authorize an unadvertised second page or fabricated total',()=>{
 assert.throws(()=>readListing(saved(profile.frameURL).replaceAll('Page 1 of 1','Page 1 of 2'),{maxPages:2}),/pagination/)
 assert.throws(()=>readListing(saved(profile.frameURL).replaceAll('Page 1 of 1','Page 1 of 3'),{maxPages:2}),/pagination/)
})
test('current closing full listing metadata is compared despite unchanged page and row counts',async()=>{
 const title=fixture.models.rows[0].title,io=replay((url,p,count)=>{if(url===profile.frameURL&&count===2)p.body=p.body.replaceAll(title,title+' changed');return p})
 await assert.rejects(run({fetchImpl:io.fetchImpl}),/closing native listing/);assert.equal(io.requests.length,48)
})
test('current source retains opaque caller cancellation during hydration',async()=>{
 const controller=new AbortController(),reason={caller:'current-cohort-stop'},io=replay((url,p)=>{if(url===fixture.models.rows[0].requestedURL)controller.abort(reason);return p})
 await assert.rejects(run({fetchImpl:io.fetchImpl,signal:controller.signal}),error=>error===reason)
 assert.equal(io.requests.length,8)
})
