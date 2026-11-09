import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-publisher-20261106.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(p=>p.source==='gcore')
const execute=async(mutate=()=>{},options={})=>{
 const calls=[]
 let evidence
 const read=async(url,kind)=>{
  const address=new URL(url),packet=fixture.packets.find(p=>p.requestedURL===url)
   ??fixture.packets.find(p=>new URL(p.requestedURL).pathname===address.pathname&&new URL(p.requestedURL).origin===address.origin)
  assert.ok(packet,'genuine declared route only: '+url)
  assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
  const response={body:packet.body,status:packet.status,url:packet.finalURL,contentType:packet.contentType}
  mutate(response,url,calls)
  calls.push(url)
  return kind==='page'?response:kind==='json'?JSON.parse(response.body):response.body
 }
 const jobs=await createCatalogScraper(provider).run({...options,fetchText:url=>read(url,'text'),fetchJson:url=>read(url,'json'),fetchPage:url=>read(url,'page'),onAudit:value=>{evidence=value}})
 return{jobs,calls,evidence,inventory:readInventoryEvidence(jobs)}
}
test('registered current publisher mounts declared vacancy client and inspects all15 genuine foreign roles with unknown company scope',async()=>{
 const{jobs,calls,evidence,inventory}=await execute()
 assert.equal(jobs.length,0)
 assert.equal(evidence.observedNativeRecords,15)
 assert.equal(evidence.observedPublicRecords,15)
 // Genuine multi-country strings remain held by the original strict country
 // guard; typed primary country alone does not qualify their whole worksite.
 assert.equal(evidence.unknownCountryRecords,11)
 assert.equal(evidence.missingCriteriaRecords,0)
 assert.equal(evidence.nativeEnumerationComplete,true)
 assert.equal(evidence.sourceScopeComplete,false)
 assert.equal(evidence.companyGlobalTotal,null)
 assert.equal(evidence.companyIndiaTotal,null)
 assert.equal(evidence.currentPublisherProof.opening.resources.length,8)
 assert.equal(evidence.currentPublisherProof.closing.resources.length,8)
 assert.equal(evidence.rawNativeListingRecords.length,15)
 assert.equal(evidence.rawNativeDetailRecords.length,15)
 assert.equal(evidence.rawClosingNativeListingRecords.length,15)
 assert.equal(inventory.listingComplete,false)
 assert.notEqual(inventory.status,'verified-empty')
 assert.equal(readSourceObservationEvidence(jobs,'gcore').observedVacancyCount,15)
 assert.equal(calls.filter(url=>url==='https://gcore.com/open-positions').length,2)
})
for(const [label,mutate]of[
 ['unknown module bytes',(r,url)=>{if(url.endsWith('/chunk-ZZ33WBZD.js'))r.body+='/*changed*/'}],
 ['client redirect',(r,url)=>{if(url.endsWith('/chunk-ZZ33WBZD.js'))r.url='https://unrelated.example/client.js'}],
 ['client HTTP failure',(r,url)=>{if(url.endsWith('/chunk-ZZ33WBZD.js'))r.status=503}],
 ['client wrong MIME',(r,url)=>{if(url.endsWith('/chunk-ZZ33WBZD.js'))r.contentType='text/html'}],
 ['disabled module activation',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=r.body.replace('type="module"','type="text/plain"')}],
 ['missing widget mount',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=r.body.replace('data-block-type="widgets.vacancies"','data-block-type="widgets.unknown"')}],
 ['hidden vacancy mount',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=r.body.replace('data-angular-vacancies=""','data-angular-vacancies="" hidden')}],
 ['ambiguous vacancy mounts',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=r.body.replace('data-angular-vacancies=""','data-angular-vacancies=""')+'<div data-block-type="widgets.vacancies" data-angular-vacancies></div>'}],
 ['closing program changes',(r,url,calls)=>{if(url.endsWith('/chunk-ZZ33WBZD.js')&&calls.includes(url))r.body+='/*closing change*/'}],
 ['closing publisher loses mount',(r,url,calls)=>{if(url==='https://gcore.com/open-positions'&&calls.includes(url))r.body=r.body.replace('widgets.vacancies','widgets.unknown')}],
 ['unreviewed document base',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=r.body.replace('<head>','<head><base href="https://unreviewed.example/">')}],
 ['changed singleton base',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=r.body.replace('<base href="/">','<base href="https://unreviewed.example/">')}],
 ['missing reviewed base',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=r.body.replace('<base href="/">','')}],
 ['added inline vacancy removal',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=r.body.replace('<head>','<head><script>document.addEventListener("DOMContentLoaded",()=>document.querySelector("[data-angular-vacancies]").remove())</script>')}],
 ['hidden script vacancy removal',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=r.body.replace('<head>','<head><script hidden>document.querySelector("[data-angular-vacancies]").remove()</script>')}],
 ['added event program carrier',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body+='<img src="missing" onerror="document.querySelector(\'[data-angular-vacancies]\').remove()">'}],
 ['unreviewed volatile antiBot program',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=r.body.replace(/o="[a-f0-9]{32}"/,'o="00000000000000000000000000000000"')}],
])test('current publisher rejects '+label,async()=>{
 await assert.rejects(execute(mutate),/Gcore current publisher:/)
})
test('current publisher does not weaken native tenant or closing criteria identity',async()=>{
 await assert.rejects(execute((r,url)=>{if(url.includes('/postings/')&&url.includes('744000160119179')){const p=JSON.parse(r.body);p.company.identifier='Other';r.body=JSON.stringify(p)}}),/native detail company\/role identity/)
 const changed=await execute((r,url,calls)=>{if(new URL(url).pathname.endsWith('/postings')&&calls.some(u=>new URL(u).pathname.endsWith('/postings'))){const p=JSON.parse(r.body);p.content[0].name+=' changed';r.body=JSON.stringify(p)}})
 assert.equal(changed.evidence.nativeEnumerationComplete,false)
 assert.equal(changed.inventory.listingComplete,false)
 assert.match(changed.inventory.reason,/changed|snapshot|stale|reconcil/i)
})
test('current publisher preserves exact cancellation and stops before the next declared module',async()=>{
 const controller=new AbortController(),reason=Error('caller cancelled current publisher'),seen=[]
 await assert.rejects(execute((response,url)=>{
  seen.push(url)
  if(url.endsWith('/main-O7XHEPYM.js'))controller.abort(reason)
 },{signal:controller.signal}),error=>error===reason)
 assert.equal(seen.at(-1),'https://gcore.com/main-O7XHEPYM.js')
 assert.equal(seen.length,3)
})
